"""Convert a multi-option budget into a Work Order (Fase 3, 2026-10-01).

End-to-end coverage of `POST /budgets/{id}/convert` →
`budget_option_conversion.convert_budget_to_work_order`:

* the work order is built from ONLY the winning option's pieces,
  materials, piletas and additional works — no cross-option leakage;
* the stock deduction is scoped to that option's piletas, so a sink
  quoted only in a LOSING option is never decremented;
* the order carries the OPTION's own price (not the whole budget's);
* a multi-option budget with no unambiguous winner is REFUSED (400) —
  the endpoint must never guess and convert the wrong scenario;
* a legacy budget (no `options_data`) still converts unchanged, with the
  historical `origin = "Budget"`.
"""
import json

import pytest

from app.core.exceptions import ValidationError
from app.models.budget import Budget
from app.models.client import Client
from app.models.pool_stock import PoolStock, StockMovement
from app.models.reference import Currency
from app.models.work_order import WorkOrder
from app.services.budget_option_conversion import convert_budget_to_work_order

from tests.conftest import TestingSessionLocal


# ────────────────────────────────────────────────────────────────────
# Fixtures
# ────────────────────────────────────────────────────────────────────


@pytest.fixture
def opt_db():
    db = TestingSessionLocal()
    try:
        # The testing engine is a shared file DB, so clear the tables this
        # module asserts on — otherwise a previous test's budget (id=1) or
        # work order leaks in and `convert_budget_to_work_order(db, 1, ...)`
        # converts the WRONG row.
        for model in (WorkOrder, Budget, StockMovement, PoolStock):
            db.query(model).delete()
        db.commit()

        if not db.query(Currency).first():
            db.add(Currency(id=1, code="ARS", symbol="$", name="Peso Argentino"))
        if not db.query(Client).first():
            db.add(Client(
                id=1, name="Opciones Test", phone="+54 11 0000-0000",
                address="Calle Test 1", email="opt@test.com",
            ))
        # Option 1 sink (GANADORA) and option 2 sink (perdedora).
        db.add(PoolStock(
            id=1, brand="JOHNSON", model="Q 76 A", material="Acero",
            quantity=5, price=850_000.0, currency_id=1,
        ))
        db.add(PoolStock(
            id=2, brand="MI PILETA", model="DESIGNA 787", material="Acero",
            quantity=5, price=1_100_000.0, currency_id=1,
        ))
        db.commit()
        yield db
    finally:
        db.close()


def _piece(pid: str, name: str, material: str, price_m2: float,
           pool_id: int | None = None) -> dict:
    piece = {
        "id": pid,
        "name": name,
        "mainMaterial": {
            "id": 1, "name": material, "price_m2": price_m2, "price_m2_usd": 0,
            "currency": "ARS", "quantity": 1, "length": 2, "width": 1,
            "is_alternative": False,
        },
        "alternativeMaterials": [],
        "fabrication_details": [],
        "additional_works_data": "[]",
        "pools": [],
    }
    if pool_id:
        price = {1: 850_000.0, 2: 1_100_000.0}[pool_id]
        brand = {1: "JOHNSON", 2: "MI PILETA"}[pool_id]
        model = {1: "Q 76 A", 2: "DESIGNA 787"}[pool_id]
        piece["pools"] = [{
            "pool_id": pool_id, "brand": brand, "model": model,
            "price": price, "currency": "ARS", "quantity": 1,
        }]
    return piece


def _option(opt_id: str, name: str, is_selected: bool, pieces: list) -> dict:
    return {
        "id": opt_id, "name": name, "is_selected": is_selected,
        "pieces": pieces,
    }


def _budget(options: list | None = None, pieces_data: str | None = None) -> Budget:
    b = Budget(
        number="P-OPT-001",
        client_id=1,
        status="APPROVED",
        currency="ARS",
        usd_rate=1000.0,
        # The BUDGET row totals describe the whole (multi-option) quote —
        # the conversion must NOT copy them onto the winning option's WO.
        subtotal=2_000_000.0, subtotal_usd=2_000.0,
        total=2_000_000.0, total_usd=2_000.0,
        balance_due=2_000_000.0, balance_due_usd=2_000.0,
        deposit_received=0, deposit_usd=0, deposit_currency="ARS",
        payment_method="EFECTIVO", installments=1,
        discount_percentage=0, discount_enabled=False, discount_target="total",
        stock_deducted=False,
        options_data=json.dumps(options) if options is not None else None,
        pieces_data=pieces_data,
    )
    return b


# ────────────────────────────────────────────────────────────────────
# 1. The winning option's pieces drive the work order
# ────────────────────────────────────────────────────────────────────


def test_converts_the_explicitly_selected_option(opt_db):
    db = opt_db
    options = [
        _option("opt-1", "Opción 1", True, [
            _piece("p1", "COCINA", "CALACATTA", 100_000, pool_id=1),
        ]),
        _option("opt-2", "Opción 2", False, [
            _piece("p2", "COCINA", "NEGRO BRASIL", 300_000, pool_id=2),
        ]),
    ]
    db.add(_budget(options=options))
    db.commit()

    order, option = convert_budget_to_work_order(db, 1, "opt-1")

    assert option["id"] == "opt-1"
    assert order.origin == "Opción: Opción 1"
    # Material comes from the WINNING option only.
    assert order.material == "CALACATTA"
    assert float(order.material_price_m2) == 100_000.0
    # The losing option's material must not appear anywhere.
    mats = json.loads(order.materials_data or "[]")
    assert [m.get("name") for m in mats] == ["CALACATTA"]
    # …nor its sink.
    pools = json.loads(order.pools_data or "[]")
    assert [p.get("pool_id") for p in pools] == [1]


def test_refuses_to_guess_when_no_option_is_marked(opt_db):
    db = opt_db
    options = [
        _option("opt-1", "Opción 1", False, [_piece("p1", "C", "CALACATTA", 100_000)]),
        _option("opt-2", "Opción 2", False, [_piece("p2", "C", "NEGRO", 300_000)]),
    ]
    db.add(_budget(options=options))
    db.commit()

    # No option_id and no `is_selected` → refuse (converting the wrong
    # option would bill the wrong price and deduct the wrong sink).
    with pytest.raises(ValidationError):
        convert_budget_to_work_order(db, 1, None)
    assert db.query(WorkOrder).count() == 0


def test_refuses_an_unknown_option_id(opt_db):
    db = opt_db
    options = [
        _option("opt-1", "Opción 1", True, [_piece("p1", "C", "A", 100_000)]),
        _option("opt-2", "Opción 2", False, [_piece("p2", "C", "B", 200_000)]),
    ]
    db.add(_budget(options=options))
    db.commit()

    with pytest.raises(ValidationError):
        convert_budget_to_work_order(db, 1, "opt-99")
    assert db.query(WorkOrder).count() == 0


def test_refuses_when_two_options_are_marked_selected(opt_db):
    db = opt_db
    options = [
        _option("opt-1", "Opción 1", True, [_piece("p1", "C", "A", 100_000)]),
        _option("opt-2", "Opción 2", True, [_piece("p2", "C", "B", 200_000)]),
    ]
    db.add(_budget(options=options))
    db.commit()

    with pytest.raises(ValidationError):
        convert_budget_to_work_order(db, 1, None)
    assert db.query(WorkOrder).count() == 0


# ────────────────────────────────────────────────────────────────────
# 2. Stock deduction scoped to the winning option
# ────────────────────────────────────────────────────────────────────


def test_stock_deduction_only_touches_the_winning_option_sink(opt_db):
    db = opt_db
    winner_pool = db.query(PoolStock).filter(PoolStock.id == 1).one()
    loser_pool = db.query(PoolStock).filter(PoolStock.id == 2).one()
    winner_qty, loser_qty = winner_pool.quantity, loser_pool.quantity

    options = [
        _option("opt-1", "Opción 1", True, [
            _piece("p1", "COCINA", "CALACATTA", 100_000, pool_id=1),
        ]),
        _option("opt-2", "Opción 2", False, [
            _piece("p2", "COCINA", "NEGRO BRASIL", 300_000, pool_id=2),
        ]),
    ]
    db.add(_budget(options=options))
    db.commit()

    order, _ = convert_budget_to_work_order(db, 1, "opt-1")

    db.refresh(winner_pool)
    db.refresh(loser_pool)
    # The WINNING sink was consumed…
    assert winner_pool.quantity == winner_qty - 1
    # …and the losing option's sink was NOT touched.
    assert loser_pool.quantity == loser_qty

    exit_moves = db.query(StockMovement).filter(StockMovement.type == "exit").all()
    assert [m.pool_id for m in exit_moves] == [1]
    assert order.number in exit_moves[0].notes


def test_option_without_pool_deducts_nothing(opt_db):
    db = opt_db
    winner_pool = db.query(PoolStock).filter(PoolStock.id == 1).one()
    before = winner_pool.quantity

    options = [
        _option("opt-1", "Opción 1", True, [
            _piece("p1", "COCINA", "CALACATTA", 100_000),  # no pool
        ]),
        _option("opt-2", "Opción 2", False, [
            _piece("p2", "COCINA", "NEGRO", 300_000, pool_id=2),
        ]),
    ]
    db.add(_budget(options=options))
    db.commit()

    order, _ = convert_budget_to_work_order(db, 1, "opt-1")

    db.refresh(winner_pool)
    assert winner_pool.quantity == before
    assert db.query(StockMovement).filter(StockMovement.type == "exit").count() == 0
    assert order.stock_deducted is False


# ────────────────────────────────────────────────────────────────────
# 3. Totals reflect the option, not the whole budget
# ────────────────────────────────────────────────────────────────────


def test_order_carries_the_option_price_not_the_budget_total(opt_db):
    db = opt_db
    options = [
        _option("opt-1", "Opción 1", True, [
            _piece("p1", "COCINA", "CALACATTA", 100_000),  # 2 m² → 200.000
        ]),
        _option("opt-2", "Opción 2", False, [
            _piece("p2", "COCINA", "NEGRO", 300_000),      # 2 m² → 600.000
        ]),
    ]
    db.add(_budget(options=options))
    db.commit()

    order, _ = convert_budget_to_work_order(db, 1, "opt-1")

    # The BUDGET row said 2.000.000 (both options + more) — the order
    # must carry ONLY the winning option's 200.000.
    assert float(order.total) == 200_000.0
    assert float(order.subtotal) == 200_000.0
    assert float(order.balance_due) == 200_000.0
    # Budgets are quotes → the order starts unpaid.
    assert float(order.deposit_received) == 0
    assert order.balance_paid is False


def test_budget_is_flagged_converted_and_cannot_convert_twice(opt_db):
    db = opt_db
    options = [
        _option("opt-1", "Opción 1", True, [_piece("p1", "C", "A", 100_000)]),
        _option("opt-2", "Opción 2", False, [_piece("p2", "C", "B", 200_000)]),
    ]
    db.add(_budget(options=options))
    db.commit()

    order, _ = convert_budget_to_work_order(db, 1, "opt-1")
    db.refresh(db.get(Budget, 1))
    assert db.get(Budget, 1).status == "CONVERTED_TO_OT"
    # Neither option quotes a pileta → nothing was debited.
    assert order.stock_deducted is False
    assert db.get(Budget, 1).stock_deducted is False
    assert db.query(StockMovement).filter(StockMovement.type == "exit").count() == 0

    # A second conversion is refused.
    with pytest.raises(ValidationError):
        convert_budget_to_work_order(db, 1, "opt-2")
    assert db.query(WorkOrder).count() == 1


# ────────────────────────────────────────────────────────────────────
# 4. Legacy budget (no options_data) — unchanged behaviour
# ────────────────────────────────────────────────────────────────────


def test_legacy_budget_converts_with_the_historical_origin(opt_db):
    db = opt_db
    pieces = json.dumps([_piece("p1", "COCINA", "CALACATTA", 100_000)])
    db.add(_budget(pieces_data=pieces))
    db.commit()

    order, option = convert_budget_to_work_order(db, 1, None)

    # Legacy keeps `origin = "Budget"` so existing dashboards/reports
    # keep their meaning, and resolves the synthetic SINGLE option.
    assert order.origin == "Budget"
    assert option["id"] == "SINGLE"
    assert order.material == "CALACATTA"
    assert float(order.total) == 200_000.0


def test_single_option_budget_converts_without_an_option_id(opt_db):
    db = opt_db
    options = [_option("opt-1", "Opción 1", False, [
        _piece("p1", "COCINA", "CALACATTA", 100_000),
    ])]
    db.add(_budget(options=options))
    db.commit()

    # One option → no ambiguity, resolves without an explicit id.
    order, option = convert_budget_to_work_order(db, 1, None)
    assert option["id"] == "opt-1"
    assert order.origin == "Opción: Opción 1"


def test_multi_piece_option_sums_only_that_option(opt_db):
    db = opt_db
    options = [
        _option("opt-1", "Opción 1", True, [
            _piece("p1", "COCINA", "CALACATTA", 100_000),  # 200.000
            _piece("p2", "BAÑO", "BLANCO", 50_000),          # 100.000
        ]),
        _option("opt-2", "Opción 2", False, [
            _piece("p3", "PARRILLA", "NEGRO", 150_000),       # 300.000
        ]),
    ]
    db.add(_budget(options=options))
    db.commit()

    order, _ = convert_budget_to_work_order(db, 1, "opt-1")

    # Opción 1 = COCINA + BAÑO = 300.000 (not 600.000 across options).
    assert float(order.total) == 300_000.0
    pieces = json.loads(order.pieces_data or "[]")
    assert [p["name"] for p in pieces] == ["COCINA", "BAÑO"]