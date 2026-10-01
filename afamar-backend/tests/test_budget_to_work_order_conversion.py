"""Budget → Work-Order conversion semantics (2026-10-01).

Budgets are pure quote documents: the seña is collected at the WORK ORDER
(in MEDICIÓN), never at budget time. The two conversion paths —
`WorkOrderService.create_from_budget` and (from an alt material)
`BudgetService.convert_alternative_to_work_order` — must therefore:

1. **Zero the deposit**: `deposit_received`/`deposit_usd` start at 0 and
   `balance_due`/`balance_due_usd` mirror the quoted total. A previously
   registered budget deposit is NOT carried over (the quote is not a
   booking).
2. **Not touch the cash box**: `_create_cash_movement_on_deposit` short
   circuits on `amount <= 0`, and `convert_alternative_to_work_order`
   never books movements — the operator registers the seña later in
   MEDICIÓN via `update()`.
3. **Inherit the commercial-discount gate**: `discount_enabled` +
   `discount_target` (persisted since the j0k1l2m3n4o5 migration, budget
   default target 'total') copy over verbatim so the quoted discount
   keeps applying on the order (`discount_percentage` /
   `discount_fixed_amount` were already copied).
4. **Inherit per-document terms**: `budget_terms_override` →
   `delivery_terms_override` and `warranty_override` → `warranty_override`,
   so the order PDF shows the same payment / garantía terms the customer
   signed on the budget.
"""
import json

import pytest

from app.models.budget import Budget
from app.models.client import Client
from app.models.daily_cash import CashMovement, DailyCash
from app.models.reference import PaymentMethod
from app.services.budget import BudgetService
from app.services.daily_cash import DailyCashService
from app.services.work_order import WorkOrderService

from tests.conftest import TestingSessionLocal


# ────────────────────────────────────────────────────────────────────
# Fixtures
# ────────────────────────────────────────────────────────────────────


@pytest.fixture
def conversion_db():
    """Session pre-seeded with payment method + client + open cash box."""
    db = TestingSessionLocal()
    try:
        db.add(PaymentMethod(
            id=1, name="EFECTIVO", label="Efectivo",
            is_active=True, sort_order=10,
            type="NONE", value=0.0, is_percentage=False, applies_to_installments=False,
        ))
        db.add(Client(
            id=1, name="Conversión Test", phone="+54 11 0000-0000",
            address="Calle Test 1", email="conversion@test.com",
        ))
        db.commit()
        DailyCashService(db).open_cash(previous_balance=0)
        yield db
    finally:
        db.close()


MAIN_MAT = {
    "id": 1, "name": "Mármol Blanco", "currency": "ARS",
    "price_m2": 200000.0, "price_m2_usd": 200.0,
    "quantity": 1, "length": 2.5, "width": 1.2, "is_alternative": False,
}

ALT_MAT = {  # 2.5 × 1.2 = 3.0 m² @ USD 400 → USD 1200 → ARS 1.200.000 @ rate 1000
    "id": 3, "name": "QUARTZO GRIS", "currency": "USD",
    "price_m2": 400000.0, "price_m2_usd": 400.0,
    "quantity": 1, "length": 2.5, "width": 1.2, "is_alternative": True,
}

TERMS = {"budget_terms_override": "Seña 30%, saldo contra entrega.",
         "warranty_override": "Garantía 3 años."}


def _quoted_budget(**overrides) -> Budget:
    """An APPROVED quote with a frontend-computed total (incl. discount)."""
    budget = Budget(
        number="P-TEST-900",
        client_id=1,
        status="APPROVED",
        currency="ARS",
        usd_rate=1000.0,
        materials_data=json.dumps([MAIN_MAT]),
        material="Mármol Blanco",
        material_price_m2=200000.0,
        material_price_m2_usd=200.0,
        subtotal=600000.0,
        subtotal_usd=600.0,
        discount_percentage=10.0,
        discount_enabled=True,
        discount_target="total",
        discount_fixed_amount=0,
        total=540000.0,
        total_usd=540.0,
        balance_due=540000.0,
        balance_due_usd=540.0,
        # A deposit was registered on the quote (pre-fix it would carry over
        # and even book a cash movement). It must be IGNORED by conversion.
        deposit_received=100000.0,
        deposit_currency="ARS",
        deposit_usd=0.0,
        payment_method="EFECTIVO",
        installments=1,
        **TERMS,
    )
    for key, value in overrides.items():
        setattr(budget, key, value)
    return budget


def _income_count(db, box) -> int:
    return (
        db.query(CashMovement)
        .filter(CashMovement.daily_cash_id == box.id, CashMovement.type == "INCOME")
        .count()
    )


# ────────────────────────────────────────────────────────────────────
# Tests — create_from_budget
# ────────────────────────────────────────────────────────────────────


def test_create_from_budget_zeroes_deposit_and_inherits_discount_and_terms(conversion_db):
    db = conversion_db
    db.add(_quoted_budget())
    db.commit()
    budget = db.query(Budget).first()
    box = db.query(DailyCash).filter(DailyCash.is_closed == False).first()  # noqa: E712

    order = WorkOrderService(db).create_from_budget(budget)

    # 1. Deposit zeroed even though the source quote had one.
    assert order.deposit_received == 0
    assert order.deposit_currency == "ARS"
    assert order.deposit_usd == 0
    # 2. balance_due mirrors the quoted total (10% discount already applied).
    assert order.balance_due == 540000.0
    assert order.balance_due_usd == 540.0
    assert order.balance_paid is False
    assert order.sena_registered is False  # operator books it in MEDICIÓN
    # 3. Discount gate copied verbatim from the quote.
    assert order.discount_enabled is True
    assert order.discount_target == "total"
    assert order.discount_percentage == 10.0
    # 4. Per-document terms carried over.
    assert order.delivery_terms_override == TERMS["budget_terms_override"]
    assert order.warranty_override == TERMS["warranty_override"]
    # 5. The cash box was NOT touched: no INCOME movement for this order.
    assert _income_count(db, box) == 0
    assert db.query(CashMovement).filter(CashMovement.order_id == order.id).count() == 0


def test_create_from_budget_respects_false_gate_and_empty_terms(conversion_db):
    db = conversion_db
    db.add(_quoted_budget(
        discount_enabled=False,
        discount_target="materials",
        budget_terms_override="",
        warranty_override="",
    ))
    db.commit()
    budget = db.query(Budget).first()

    order = WorkOrderService(db).create_from_budget(budget)

    assert order.discount_enabled is False
    assert order.discount_target == "materials"
    assert order.delivery_terms_override == ""
    assert order.warranty_override == ""
    assert order.balance_due == 540000.0
    assert order.deposit_received == 0


# ────────────────────────────────────────────────────────────────────
# Tests — convert_alternative_to_work_order
# ────────────────────────────────────────────────────────────────────


def test_convert_alternative_zeroes_deposit_and_inherits_discount_and_terms(conversion_db):
    db = conversion_db
    db.add(_quoted_budget(materials_data=json.dumps([MAIN_MAT, ALT_MAT])))
    db.commit()
    budget = db.query(Budget).first()

    order = BudgetService(db).convert_alternative_to_work_order(budget.id, 1)

    assert order.origin == "Desde alternativa"
    assert order.deposit_received == 0
    assert order.deposit_usd == 0
    assert order.balance_paid is False
    # balance_due mirrors the COMPUTED alternate total (no deposit deducted).
    assert order.balance_due == order.total
    assert order.balance_due == pytest.approx(
        round((1200.0 * 1000.0) + 0)  # pure-material, no detalles/pools/traslado
    )
    # Discount gate + terms copied verbatim.
    assert order.discount_enabled is True
    assert order.discount_target == "total"
    assert order.discount_percentage == 10.0
    assert order.delivery_terms_override == TERMS["budget_terms_override"]
    assert order.warranty_override == TERMS["warranty_override"]
    # No cash movement is ever booked by this conversion path.
    assert db.query(CashMovement).filter(CashMovement.order_id == order.id).count() == 0