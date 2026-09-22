"""Regression + correctness tests for `WorkOrderService.update`.

The user-facing flow that broke today (2026-08-26): the user converts a
budget to a work order, opens the OT in MEDICION, edits the m² of a
material, and hits "Guardar". The PUT hit `_recalculate_totals_from_items(merged)`
without the `db` argument, raising `TypeError: ... missing 1 required
positional argument: 'data'` and returning 500 to the browser.

These tests exercise the full `WorkOrderService.update` path end-to-end
against an in-memory SQLite DB. They would have caught the bug.

What we cover:

1. `update()` with just `materials_data` (the exact path that 500'd)
   - no exception, total is recomputed, materials persisted.
2. `update()` with `payment_method_id` + `installments` while in MEDICION
   - recargo lineal scales with N cuotas, persists correctly.
3. `update()` with `discount_percentage` patch
   - manual discount applied before catalogue method (matches the hook).
4. `update()` while in `WORKSHOP` (forward state transition)
   - VALID_TRANSITIONS check works, totals recomputed.
5. `update()` that does NOT include any line-item key
   - no recalc path taken; only status / deposit / metadata changes.
"""
import json

import pytest

from app.models.client import Client
from app.models.reference import PaymentMethod
from app.models.work_order import WorkOrder
from app.services.work_order import WorkOrderService

from tests.conftest import TestingSessionLocal


# ────────────────────────────────────────────────────────────────────
# Fixtures
# ────────────────────────────────────────────────────────────────────


@pytest.fixture
def fresh_db():
    """Yield a session pre-seeded with the 4 default payment methods
    and one work order in MEDICION (the user-facing scenario)."""
    db = TestingSessionLocal()
    try:
        # The 4 seeded payment methods (mirrors scripts/seeders/payment_methods.py).
        db.add(PaymentMethod(
            id=1, name="EFECTIVO", label="Efectivo",
            is_active=True, sort_order=10,
            type="NONE", value=0.0, is_percentage=False, applies_to_installments=False,
        ))
        db.add(PaymentMethod(
            id=2, name="TARJETA DE CRÉDITO", label="Tarjeta de crédito",
            is_active=True, sort_order=40,
            type="SURCHARGE", value=9.0, is_percentage=True, applies_to_installments=True,
        ))
        db.add(PaymentMethod(
            id=3, name="TRANSFER", label="Transferencia 5% desc",
            is_active=True, sort_order=20,
            type="DISCOUNT", value=5.0, is_percentage=True, applies_to_installments=False,
        ))
        db.add(Client(
            id=1, name="Test Client", phone="+54 11 0000-0000",
            address="Calle Test 123", email="test@test.com",
        ))
        order = WorkOrder(
            id=1,
            number="A-TEST-001",
            client_id=1,
            status="MEASUREMENT",
            origin="Budget",
            currency="ARS",
            usd_rate=1000.0,
            subtotal=0.0, total=0.0,
            subtotal_usd=0.0, total_usd=0.0,
            balance_due=0.0, balance_due_usd=0.0,
            material="Test Material",
            material_price_m2=1000.0,
            materials_data=None,
            fabrication_details=None,
            pools_data=None,
            additional_works_data=None,
            payment_method="EFECTIVO",
            installments=1,
        )
        db.add(order)
        db.commit()
        yield db
    finally:
        db.close()


def _materials_json(rows: list[dict]) -> str:
    return json.dumps(rows)


# ────────────────────────────────────────────────────────────────────
# 1. Regression del bug de hoy
# ────────────────────────────────────────────────────────────────────


def test_update_with_materials_data_does_not_500(fresh_db):
    """Exact reproduction of the user's complaint:

    Convert budget → OT in MEDICION → user edits m² of a material →
    hits Guardar → PUT /work-orders/{id} with `{materials_data: ...}`.

    Pre-fix: `_recalculate_totals_from_items(merged)` raised TypeError,
    bubbled to the FastAPI handler, returned 500.

    Post-fix: returns 200 with the new total and persists the JSON.
    """
    svc = WorkOrderService(fresh_db)
    new_materials = _materials_json([{
        "name": "Mármol Blanco",
        "length": 2.5, "width": 1.2, "quantity": 1,
        "price_m2": 1500, "currency": "ARS",
    }])
    result = svc.update(1, {"materials_data": new_materials})

    # Recompute fired: 2.5 × 1.2 × 1 × 1500 = 4500 ARS subtotal/total.
    assert result.materials_data == new_materials
    assert result.subtotal == pytest.approx(4500, abs=0.05)
    assert result.total == pytest.approx(4500, abs=0.05)
    # USD side: 4500 ARS / 1000 = 4.50 USD.
    assert result.total_usd == pytest.approx(4.5, abs=0.01)


def test_update_with_materials_data_and_payment_method(fresh_db):
    """Edit m² in MEDICION while the OT is paid with credit card 3 cuotas.

    Surcharge: linear, 3 × 9% = 27% on the total. Base = 4500 ARS →
    total = 4500 × 1.27 = 5715. Cuotas: 3 × 1905.00 ARS.
    """
    svc = WorkOrderService(fresh_db)
    new_materials = _materials_json([{
        "name": "Mármol Blanco",
        "length": 2.5, "width": 1.2, "quantity": 1,
        "price_m2": 1500, "currency": "ARS",
    }])
    result = svc.update(1, {
        "materials_data": new_materials,
        "payment_method_id": 2,
        "payment_method": "TARJETA DE CRÉDITO",
        "installments": 3,
    })

    assert result.total == pytest.approx(5715, abs=0.05)
    detail = json.loads(result.installment_detail_ars or "[]")
    assert len(detail) == 3
    assert all(row["interes"] == 9 for row in detail)
    # Cuotas uniformes: 5715 / 3 = 1905.00 ARS.
    expected_monto = round(5715 / 3, 2)
    for row in detail:
        assert row["monto"] == pytest.approx(expected_monto, abs=0.05)


def test_update_with_materials_data_and_discount_percentage(fresh_db):
    """Edit m² + apply a 10% manual discount. Order of operations must
    match the frontend hook: manual discount first, then catalogue method.
    With EFECTIVO (no surcharge) the total is just 4500 × 0.9 = 4050.
    """
    svc = WorkOrderService(fresh_db)
    new_materials = _materials_json([{
        "name": "Mármol Blanco",
        "length": 2.5, "width": 1.2, "quantity": 1,
        "price_m2": 1500, "currency": "ARS",
    }])
    result = svc.update(1, {
        "materials_data": new_materials,
        # `discount_enabled` is now the gate that decides whether the
        # configured % / fixed amount actually applies to the total.
        "discount_enabled": True,
        "discount_target": "total",
        "discount_percentage": 10,
        "discount_fixed_amount": 0,
    })
    assert result.subtotal == pytest.approx(4500, abs=0.05)
    assert result.total == pytest.approx(4050, abs=0.05)


# ────────────────────────────────────────────────────────────────────
# 2. Status transitions + line-item update in one call
# ────────────────────────────────────────────────────────────────────


def test_update_advances_status_measurement_to_workshop(fresh_db):
    """Same PATCH that edits m² also flips the status from MEDICION to
    TALLER. The two operations must coexist (the user clicks Guardar
    after both changing the measurement and clicking Avanzar estado).
    """
    svc = WorkOrderService(fresh_db)
    new_materials = _materials_json([{
        "name": "Mármol Blanco",
        "length": 2.5, "width": 1.2, "quantity": 1,
        "price_m2": 1500, "currency": "ARS",
    }])
    result = svc.update(1, {
        "status": "WORKSHOP",
        "materials_data": new_materials,
    })
    assert result.status == "WORKSHOP"
    assert result.materials_data == new_materials
    assert result.total == pytest.approx(4500, abs=0.05)


def test_update_with_no_line_item_keys_skips_recalc(fresh_db):
    """Pure metadata update (no fabrication_details / materials_data /
    pools_data / payment_method / installments / discounts / deposit) →
    the recalc branch is skipped, no error.
    """
    svc = WorkOrderService(fresh_db)
    # Persist a known subtotal first so we can assert it doesn't change.
    fresh_db.query(WorkOrder).filter(WorkOrder.id == 1).update(
        {"subtotal": 1234.0, "total": 1234.0,
         "subtotal_usd": 1.234, "total_usd": 1.234}
    )
    fresh_db.commit()

    result = svc.update(1, {
        "notes": "Cliente pide adelantar entrega",
    })
    assert result.notes == "Cliente pide adelantar entrega"
    # No recalc → the seeded totals stay.
    assert result.subtotal == 1234.0
    assert result.total == 1234.0


# ────────────────────────────────────────────────────────────────────
# 3. Deposit update during MEDICION (cash movement side-effect)
# ────────────────────────────────────────────────────────────────────


def test_update_deposit_persists_and_creates_cash_movement(fresh_db):
    """User registers a deposit in the OT form (MEDICION). The PATCH
    persists `deposit_received` and triggers `_create_cash_movement_on_deposit`
    via the side-effect branch in `update()`. We assert the deposit
    is persisted; the cash movement itself is covered by an integration
    test in test_daily_cash.py.
    """
    svc = WorkOrderService(fresh_db)
    result = svc.update(1, {
        "deposit_received": 50000,
        "deposit_currency": "ARS",
    })
    assert result.deposit_received == 50000
    assert result.deposit_currency == "ARS"


# ────────────────────────────────────────────────────────────────────
# Schema-level regression: `delivery_date` annotation must accept a date.
# ────────────────────────────────────────────────────────────────────

def test_work_order_update_accepts_delivery_date_string():
    """Regression sentinel for the Pydantic annotation collision bug.

    `WorkOrderBase` / `WorkOrderUpdate` both declare a `date` field
    (the document date). With `from datetime import date, datetime`,
    the class body created `cls.date = None`, and Pydantic's
    `ModelMetaclass.__new__` re-resolves `Optional[date]` (used on the
    `delivery_date` field) against `localns=cls.__dict__`, where `date`
    resolved to `None` — silently collapsing the annotation to
    `Optional[None]` = `NoneType`. PUT with a `delivery_date` then
    returned `Input should be None`. The fix switched the imports to
    `import datetime` and the annotation to `Optional[datetime.date]`.

    This test asserts the schema now parses a date string and the
    annotation is `datetime.date | None` (not `NoneType`).
    """
    from datetime import date as _date

    from app.schemas.work_order import WorkOrderUpdate

    ann = WorkOrderUpdate.model_fields["delivery_date"].annotation
    assert ann == _date | None, (
        f"WorkOrderUpdate.delivery_date annotation collapsed to {ann!r}; "
        "this means a Pydantic name-resolution collision with the `date` "
        "field rebroke — see test_work_order_update.py docstring."
    )
    parsed = WorkOrderUpdate(delivery_date="2026-09-11")
    assert parsed.delivery_date == _date(2026, 9, 11)


# ────────────────────────────────────────────────────────────────────
# `balance_due` must subtract the deposit in its NATIVE currency.
# ────────────────────────────────────────────────────────────────────

def test_update_with_usd_deposit_subtracts_ars_equivalent(fresh_db):
    """Regression sentinel for the USD-seña balance freeze.

    The form keeps `deposit_received` (ARS) and `deposit_usd` (USD) as
    parallel columns and toggles which carries the native value via
    `deposit_currency`. The earlier recalc only subtracted the ARS
    field, so a USD seña left `balance_due == total` (frozen at total).

    This test asserts `balance_due = total - deposit_usd × usd_rate`
    when `deposit_currency == 'USD'`.
    """
    svc = WorkOrderService(fresh_db)
    # First add an ARS fabrication line worth 1.000.000 so the total is
    # well-defined and > the ARS equivalent of the USD deposit.
    svc.update(1, {
        "fabrication_details": json.dumps([
            {"concept": "LENGTH", "length": 1, "width": 0, "m2": 1,
             "currency": "ARS", "price": 1000000, "quantity": 1},
        ]),
    })
    # Now register a USD seña of 650. Read total + balance from the SAME
    # result so the assertion is independent of fixture state. Compute the
    # expected ARS-equivalent of the deposit dynamically from the order's
    # usd_rate (which differs between fixtures).
    result = svc.update(1, {
        "deposit_received": 0,
        "deposit_usd": 650,
        "deposit_currency": "USD",
    })
    total_ars = result.total
    total_usd = result.total_usd
    rate = result.usd_rate
    deposit_ars = 650 * rate  # ARS equivalent of the USD seña
    expected_balance_ars = total_ars - deposit_ars
    expected_balance_usd = round(total_usd - 650, 2)
    assert result.balance_due == expected_balance_ars, (
        f"balance_due frozen at total — USD deposit not subtracted. "
        f"got {result.balance_due}, expected {expected_balance_ars}."
    )
    assert abs(result.balance_due_usd - expected_balance_usd) < 0.01


# ────────────────────────────────────────────────────────────────────
# Direct `create()` with a seña records the cash income movement.
# ────────────────────────────────────────────────────────────────────

def test_create_with_deposit_records_cash_income(fresh_db):
    """A WO created directly from the form (not converted from a budget)
    is a confirmed sale — the efiective seña must land in the open cash box.

    Pre-fix: `WorkOrderService.create()` persisted `deposit_received` on
    the order but never created the cash income movement, so the seña
    never showed up in the caja (only `create_from_budget` and `update`
    recorded it).
    """
    from app.models.daily_cash import DailyCash, CashMovement

    svc = WorkOrderService(fresh_db)
    order = svc.create({
        "client_id": 1,
        "status": "MEASUREMENT",
        "currency": "ARS",
        "usd_rate": 1000.0,
        "payment_method": "EFECTIVO",
        "payment_method_id": 1,
        "installments": 1,
        "deposit_received": 850000.0,
        "deposit_currency": "ARS",
        "deposit_usd": 0,
        "fabrication_details": json.dumps([
            {"concept": "LENGTH", "length": 1, "width": 0, "m2": 1,
             "currency": "ARS", "price": 1000000, "quantity": 1},
        ]),
    })
    assert order.deposit_received == 850000.0
    assert order.number is not None

    box = fresh_db.query(DailyCash).filter(DailyCash.is_closed == False).first()  # noqa: E712
    assert box is not None, "create() should have auto-opened a cash box"
    movs = (
        fresh_db.query(CashMovement)
        .filter(CashMovement.daily_cash_id == box.id, CashMovement.type == "INCOME")
        .all()
    )
    assert len(movs) == 1, (
        f"expected exactly 1 INCOME movement for the seña, got {len(movs)}"
    )
    assert movs[0].amount == 850000.0
    assert movs[0].payment_method == "EFECTIVO"
    assert movs[0].order_number == order.number
    # The movement is enriched with the work order's state + saldo so the
    # cash page can show "Estado" and "Saldo Restante" instead of "-".
    assert movs[0].folder_status == "MEASUREMENT"
    assert movs[0].remaining_balance == order.balance_due
    fresh_db.refresh(box)
    assert box.total_income == 850000.0


# ────────────────────────────────────────────────────────────────────
# Full-paid OTs must NOT re-book a phantom seña on every Guardar.
# ────────────────────────────────────────────────────────────────────

def test_update_fully_paid_does_not_book_phantom_delta(fresh_db):
    """Regression sentinel for the "señas fantasma" incident.

    When an OT is paid 100% by card (balance_paid=True, deposit_received=total),
    the frontend re-sends essentially the same deposit on every GUARDAR. Tiny
    rounding drift (e.g. a USD round-trip) used to make `new_deposit` a hair
    higher than the persisted value, and `update()` booked the *delta* as a
    brand-new INCOME movement — so clicking Guardar 5 times minted 5 phantom
    4.4-ARS payments in the cash box.

    Fix: `update()` only books a deposit-delta when the order is NOT fully
    paid. A fully-paid order has nothing left to top up, so re-saving it must
    never create a new cash movement.
    """
    from app.models.daily_cash import DailyCash, CashMovement
    from app.services.daily_cash import DailyCashService

    svc = WorkOrderService(fresh_db)
    # Ensure there is an open cash box, as there is in production.
    DailyCashService(fresh_db).open_cash(previous_balance=0)
    # Seed a material so the order has a real total, then fully pay it.
    svc.update(1, {
        "materials_data": _materials_json([{
            "name": "Mármol Blanco",
            "length": 2.5, "width": 1.2, "quantity": 1,
            "price_m2": 1500, "currency": "ARS",
        }]),
    })
    first = svc.update(1, {
        "deposit_received": 4500.0,
        "deposit_currency": "ARS",
        "balance_paid": True,
    })
    assert first.total == pytest.approx(4500, abs=0.05)
    assert first.balance_paid is True

    box = fresh_db.query(DailyCash).filter(DailyCash.is_closed == False).first()  # noqa: E712
    count_after_first = (
        fresh_db.query(CashMovement)
        .filter(CashMovement.daily_cash_id == box.id, CashMovement.type == "INCOME")
        .count()
    )

    # Re-save with a tiny deposit drift (the card-autofill USD round-trip
    # artifact). This MUST NOT add a movement for a fully-paid order.
    for _ in range(3):
        svc.update(1, {
            "deposit_received": 4500.4,  # rounding drift
            "deposit_currency": "ARS",
            "balance_paid": True,
        })

    count_after = (
        fresh_db.query(CashMovement)
        .filter(CashMovement.daily_cash_id == box.id, CashMovement.type == "INCOME")
        .count()
    )
    assert count_after == count_after_first, (
        f"fully-paid re-save minted a phantom seña: {count_after_first} → {count_after}"
    )



def test_update_with_deposit_books_sena_when_sena_registered_false(fresh_db):
    """Regression for the 2026-09-07 user-reported issue: the operator
    converts a budget to a WO (no senia yet), opens the WO during
    MEDICION, edits the real measures + senia (deposit_received), and
    saves. The senia must land in the open cash box on that first PUT;
    the create() / create_from_budget() path already ran with
    deposit_received=0.

    Idempotency: a second PUT (operator re-saves the form without
    changing anything) MUST NOT mint a second INCOME movement because
    sena_registered flips to True on the first save.
    """
    from app.models.daily_cash import DailyCash, CashMovement

    svc = WorkOrderService(fresh_db)

    # Force-open a cash box (create() with deposit=0 doesn't auto-open
    # because the helper bails out on amount <= 0).
    from app.services.daily_cash import DailyCashService
    DailyCashService(fresh_db).open_cash(previous_balance=0)

    # 1) Create a direct WO WITHOUT a senia (simulates a converted-
    #    from-budget OT that arrived with deposit_received=0). The cash
    #    box gets no INCOME from this path.
    order = svc.create({
        "client_id": 1,
        "status": "MEASUREMENT",
        "currency": "ARS",
        "usd_rate": 1000.0,
        "payment_method": "EFECTIVO",
        "payment_method_id": 1,
        "installments": 1,
        "deposit_received": 0,
        "deposit_currency": "ARS",
        "deposit_usd": 0,
        "fabrication_details": "[]",
        "materials_data": "[]",
        "additional_works_data": "[]",
    })
    assert order.deposit_received == 0
    assert order.sena_registered is False

    box = fresh_db.query(DailyCash).filter(DailyCash.is_closed == False).first()  # noqa: E712
    assert box is not None
    count_before = (
        fresh_db.query(CashMovement)
        .filter(CashMovement.daily_cash_id == box.id, CashMovement.type == "INCOME")
        .count()
    )

    # 2) Operator adds the senia during MEDICION and saves. This PUT must
    #    book exactly ONE INCOME movement for the new deposit amount.
    svc.update(order.id, {
        "deposit_received": 600000.0,
        "deposit_currency": "ARS",
        "deposit_usd": 0,
        "materials_data": "[]",
        "fabrication_details": "[]",
    })
    fresh_db.refresh(order)
    assert order.deposit_received == 600000.0
    assert order.sena_registered is True

    count_after_first = (
        fresh_db.query(CashMovement)
        .filter(CashMovement.daily_cash_id == box.id, CashMovement.type == "INCOME")
        .count()
    )
    assert count_after_first == count_before + 1, (
        f"first PUT with deposit_received=600k must add exactly 1 INCOME; "
        f"got {count_before} then {count_after_first}"
    )

    # 3) Re-save WITHOUT changes. The sena_registered flag must block a
    #    duplicate movement (idempotency).
    svc.update(order.id, {
        "materials_data": "[]",
        "fabrication_details": "[]",
    })
    fresh_db.refresh(order)
    assert order.sena_registered is True

    count_after_resave = (
        fresh_db.query(CashMovement)
        .filter(CashMovement.daily_cash_id == box.id, CashMovement.type == "INCOME")
        .count()
    )
    assert count_after_resave == count_after_first, (
        f"re-save must not mint a phantom senia; "
        f"expected {count_after_first}, got {count_after_resave}"
    )


def test_update_does_not_book_sena_when_balance_paid_true(fresh_db):
    """A fully-paid OT (tarjeta debito/credito autofill at create time)
    must NEVER book a senia in update(), even if the operator edits the
    deposit_received afterwards. The full amount was already booked by
    WorkOrderService.create() at creation time; re-booking would
    duplicate the cash inflow.
    """
    from app.models.daily_cash import DailyCash, CashMovement

    svc = WorkOrderService(fresh_db)
    # Create a fully-paid order (tarjeta debito autofill flow).
    order = svc.create({
        "client_id": 1,
        "status": "MEASUREMENT",
        "currency": "ARS",
        "usd_rate": 1000.0,
        "payment_method": "TARJETA DE DEBITO",
        "payment_method_id": 3,
        "installments": 1,
        "deposit_received": 1500000.0,  # = total (full payment)
        "deposit_currency": "ARS",
        "deposit_usd": 0,
        "balance_paid": True,
        "materials_data": "[]",
        "fabrication_details": "[]",
        "additional_works_data": "[]",
    })
    assert order.sena_registered is True
    assert order.balance_paid is True

    box = fresh_db.query(DailyCash).filter(DailyCash.is_closed == False).first()  # noqa: E712
    assert box is not None

    # Operator edits deposit_received (e.g. correcting a rounding drift).
    # MUST NOT book a second INCOME; the full amount was already booked
    # at create() time.
    svc.update(order.id, {
        "deposit_received": 1500000.5,  # tiny drift
        "deposit_currency": "ARS",
        "materials_data": "[]",
        "fabrication_details": "[]",
})
    fresh_db.refresh(order)

    count = (
        fresh_db.query(CashMovement)
        .filter(CashMovement.daily_cash_id == box.id, CashMovement.order_id == order.id)
        .count()
    )
    assert count == 1, f"fully-paid re-save must not mint a phantom senia; got {count} movs"


def test_update_persists_workshop_sheet_fields(fresh_db):
    """The Ficha de Taller fields (workshop_corte/faja/perf/tras_peg/term/sopapas)
    must persist through `update()` — the operator types them in the WO form
    and hits Guardar while in MEDICION."""
    svc = WorkOrderService(fresh_db)
    result = svc.update(1, {
        "workshop_corte": "45°",
        "workshop_faja": "3 cm",
        "workshop_perf": "2 agujeros",
        "workshop_tras_peg": "Pegamento blanco",
        "workshop_term": "Lija 120",
        "workshop_sopapas": "3 de 1 1/4\"",
    })
    assert result.workshop_corte == "45°"
    assert result.workshop_faja == "3 cm"
    assert result.workshop_perf == "2 agujeros"
    assert result.workshop_tras_peg == "Pegamento blanco"
    assert result.workshop_term == "Lija 120"
    assert result.workshop_sopapas == '3 de 1 1/4"'

    fresh_db.refresh(result)
    assert result.workshop_corte == "45°"
    assert result.workshop_sopapas == '3 de 1 1/4"'


