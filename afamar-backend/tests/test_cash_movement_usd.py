"""USD cash movements ("Dólar billete") booking.

Context (2026-09-25): the WO payment module lets the operator register a
cash payment in native USD (`currency='USD'`). The box lives in ARS, so a
USD movement carries its `amount` in the native currency PLUS `amount_ars`
(`amount × usd_rate`) + `usd_rate` — the register totals (`total_income`,
`total_expenses`, `total_sum`, `current_balance`, `real_cash`,
`total_by_payment`) ALWAYS sum the ARS equivalent, never the raw amount.

The seña helper (`_create_cash_movement_on_deposit`) follows the same rule:
a USD seña (`deposit_currency == 'USD'`) books `amount=deposit_usd` +
`amount_ars=deposit_usd × order.usd_rate`; the DELIVERED saldo (an ARS
`balance_due` column) is force-booked with `currency='ARS'`.
"""
import json

import pytest

from app.models.client import Client
from app.models.daily_cash import CashMovement, DailyCash
from app.models.reference import PaymentMethod
from app.models.work_order import WorkOrder
from app.services.daily_cash import DailyCashService
from app.services.work_order import _create_cash_movement_on_deposit, _deposit_native_amount

from tests.conftest import TestingSessionLocal


@pytest.fixture
def cash_db():
    """Session pre-seeded with payment method + client + open cash box."""
    db = TestingSessionLocal()
    try:
        db.add(PaymentMethod(
            id=1, name="EFECTIVO", label="Efectivo",
            is_active=True, sort_order=10,
            type="NONE", value=0.0, is_percentage=False, applies_to_installments=False,
        ))
        db.add(Client(
            id=1, name="Cash USD Test", phone="+54 11 0000-0000",
            address="Calle Test 1", email="cashusd@test.com",
        ))
        db.commit()
        DailyCashService(db).open_cash(previous_balance=0)
        yield db
    finally:
        db.close()


def _open_box(db):
    box = db.query(DailyCash).filter(DailyCash.is_closed == False).first()  # noqa: E712
    assert box is not None
    return box


# ────────────────────────────────────────────────────────────────────
# Box-level: a USD income movement
# ────────────────────────────────────────────────────────────────────


def test_usd_income_persists_native_currency_and_ars_equivalent(cash_db):
    svc = DailyCashService(cash_db)
    box = _open_box(cash_db)

    mov = svc.create_movement({
        "type": "INCOME",
        "amount": 100.0,                 # native USD
        "currency": "USD",
        "amount_ars": 260000.0,          # 100 × 2600 blue intermedio
        "usd_rate": 2600.0,
        "payment_method": "EFECTIVO (USD)",
    })

    # The movement keeps its native currency + the conversion.
    assert mov.currency == "USD"
    assert mov.amount == pytest.approx(100.0, abs=0.01)
    assert mov.amount_ars == pytest.approx(260000.0, abs=0.01)
    assert mov.usd_rate == pytest.approx(2600.0, abs=0.01)

    # Box totals sum the ARS equivalent, NOT the raw 100 USD.
    cash_db.refresh(box)
    assert box.total_income == pytest.approx(260000.0, abs=0.01)
    assert box.current_balance == pytest.approx(260000.0, abs=0.01)


def test_currency_is_normalized_uppercase(cash_db):
    svc = DailyCashService(cash_db)
    mov = svc.create_movement({
        "type": "INCOME",
        "amount": 50.0,
        "currency": "usd",
        "amount_ars": 130000.0,
        "usd_rate": 2600.0,
    })
    assert mov.currency == "USD"


def test_legacy_ars_movement_defaults_and_totals_use_amount(cash_db):
    svc = DailyCashService(cash_db)
    box = _open_box(cash_db)

    mov = svc.create_movement({
        "type": "INCOME",
        "amount": 10000.0,
        "payment_method": "EFECTIVO",
        # No currency/amount_ars/usd_rate — legacy wire shape.
    })
    assert mov.currency == "ARS"
    assert mov.amount_ars is None
    assert mov.usd_rate is None

    cash_db.refresh(box)
    assert box.total_income == pytest.approx(10000.0, abs=0.01)


def test_usd_income_counts_as_real_cash(cash_db):
    """'EFECTIVO (USD)' is NOT a transfer → the money is physically in the
    drawer and must be part of `real_cash` (in its ARS equivalent)."""
    svc = DailyCashService(cash_db)
    box = _open_box(cash_db)
    svc.set_previous_balance(1000.0)

    svc.create_movement({
        "type": "INCOME",
        "amount": 100.0,
        "currency": "USD",
        "amount_ars": 260000.0,
        "usd_rate": 2600.0,
        "payment_method": "EFECTIVO (USD)",
    })
    svc.create_movement({
        "type": "INCOME",
        "amount": 1500.0,
        "payment_method": "TRANSFERENCIA BANCARIA",
    })

    cash_db.refresh(box)
    # income 260000 + 1500; real_cash excludes ONLY the transfer.
    assert box.real_cash == pytest.approx(1000.0 + 260000.0, abs=0.01)


def test_usd_without_conversion_falls_back_to_raw_amount(cash_db):
    """Defensive fallback (documented), not the happy path: if a USD
    movement ever lands without `amount_ars`, the totals don't silently
    zero it — they use the raw `amount`."""
    svc = DailyCashService(cash_db)
    box = _open_box(cash_db)

    mov = svc.create_movement({
        "type": "INCOME",
        "amount": 100.0,
        "currency": "USD",
        # amount_ars / usd_rate absent.
    })
    cash_db.refresh(box)
    assert mov.amount_ars is None
    assert box.total_income == pytest.approx(100.0, abs=0.01)


def test_close_summary_total_by_payment_sums_usd_as_ars(cash_db):
    svc = DailyCashService(cash_db)
    box = _open_box(cash_db)
    svc.set_previous_balance(2000.0)
    svc.create_movement({
        "type": "INCOME",
        "amount": 100.0,
        "currency": "USD",
        "amount_ars": 260000.0,
        "usd_rate": 2600.0,
        "payment_method": "EFECTIVO (USD)",
    })
    svc.create_movement({
        "type": "INCOME",
        "amount": 1000.0,
        "payment_method": "TF",
    })

    result = svc.close_cash()
    summary = result["summary"]
    # The by-method breakdown stays ARS-consistent with the box totals.
    assert summary["total_by_payment"]["EFECTIVO (USD)"] == pytest.approx(260000.0, abs=0.01)
    assert summary["total_by_payment"]["TF"] == pytest.approx(1000.0, abs=0.01)
    assert summary["total_income"] == pytest.approx(261000.0, abs=0.01)
    assert summary["real_cash"] == pytest.approx(2000.0 + 261000.0, abs=0.01)


# ────────────────────────────────────────────────────────────────────
# Work-order seña: USD native vs ARS saldo at DELIVERED
# ────────────────────────────────────────────────────────────────────


def _order_row(cash_db, **overrides):
    fields = {
        "id": 50,
        "number": "A-USD-50",
        "client_id": 1,
        "status": "MEASUREMENT",
        "origin": "Manual",
        "currency": "ARS",
        "usd_rate": 2600.0,
        "subtotal": 520000.0,
        "total": 520000.0,
        "subtotal_usd": 200.0,
        "total_usd": 200.0,
        "deposit_received": 0.0,
        "deposit_currency": "USD",
        "deposit_usd": 100.0,
        "balance_due": 260000.0,
        "balance_due_usd": 100.0,
        "materials_data": json.dumps([]),
        "payment_method": "EFECTIVO (USD)",
        "installments": 1,
        "additional_works_data": None,
    }
    fields.update(overrides)
    order = WorkOrder(**fields)
    cash_db.add(order)
    cash_db.commit()
    return order


def test_usd_seña_books_native_usd_with_ars_equivalent(cash_db):
    """A USD seña (deposit_currency='USD') enters the box as a USD movement
    with its ARS equivalent, and the box total reflects the ARS value."""
    order = _order_row(cash_db)
    box = _open_box(cash_db)

    order.register_flag = "sena_registered"
    booked = _create_cash_movement_on_deposit(
        cash_db, order,
        _deposit_native_amount(order),
        order.deposit_currency,
        order.payment_method,
    )
    assert booked is True

    mov = (
        cash_db.query(CashMovement)
        .filter(CashMovement.daily_cash_id == box.id, CashMovement.type == "INCOME")
        .first()
    )
    assert mov is not None
    assert mov.amount == pytest.approx(100.0, abs=0.01)      # native USD
    assert mov.currency == "USD"
    assert mov.amount_ars == pytest.approx(260000.0, abs=0.01)  # 100 × 2600
    assert mov.usd_rate == pytest.approx(2600.0, abs=0.01)
    assert order.sena_registered is True

    cash_db.refresh(box)
    assert box.total_income == pytest.approx(260000.0, abs=0.01)


def test_delivered_saldo_is_force_booked_as_ars_even_for_usd_sena(cash_db):
    """The saldo collected at DELIVERED is the ARS `balance_due` column, even
    when the order's seña was USD — it must NOT be mis-tagged as USD."""
    order = _order_row(cash_db, status="FINISHED", sena_registered=True)
    box = _open_box(cash_db)

    order.register_flag = "saldo_registered"
    booked = _create_cash_movement_on_deposit(
        cash_db, order,
        order.balance_due,
        order.deposit_currency,
        order.payment_method,
        currency="ARS",
    )
    assert booked is True

    mov = (
        cash_db.query(CashMovement)
        .filter(CashMovement.daily_cash_id == box.id, CashMovement.type == "INCOME")
        .first()
    )
    assert mov.amount == pytest.approx(260000.0, abs=0.01)  # balance_due ARS
    assert mov.currency == "ARS"
    assert mov.amount_ars == pytest.approx(260000.0, abs=0.01)
    assert mov.usd_rate is None

    cash_db.refresh(box)
    assert box.total_income == pytest.approx(260000.0, abs=0.01)


def test_deposit_native_amount_selects_usd_column(cash_db):
    order = _order_row(cash_db)
    assert _deposit_native_amount(order) == pytest.approx(100.0, abs=0.01)

    order_ars = _order_row(cash_db, id=51, number="A-USD-51", deposit_currency="ARS",
                           deposit_received=150000.0, deposit_usd=0.0)
    assert _deposit_native_amount(order_ars) == pytest.approx(150000.0, abs=0.01)