"""Idempotency guarantees for the cash box.

Context (2026-09-02): real incidents — duplicate Work Orders from a
double-POST micro-window, and "señas fantasma" (phantom movements) where
every GUARDAR re-saved a near-identical deposit and `update()` booked the
tiny rounding delta as a NEW cash INCOME.

The fix moved the guarantee to the DATA layer, not the button:

- `work_orders.sena_registered`: the initial seña has already been booked
  as a cash INCOME (set by create()/create_from_budget() in the SAME
  transaction as the movement). Once set, re-booking is a no-op.
- `work_orders.saldo_registered`: the remaining balance has already been
  booked as a cash INCOME when the WO transitioned to DELIVERED.

- `update()` no longer books seña top-ups at all (the seña only enters at
  create/conversion; the rest is collected automatically at DELIVERED).

These tests assert that a WO's money enters the cash box EXACTLY once,
no matter how many times the same operation is re-entered.
"""
import json

import pytest

from app.models.client import Client
from app.models.daily_cash import CashMovement, DailyCash
from app.models.reference import PaymentMethod
from app.models.work_order import WorkOrder
from app.services.daily_cash import DailyCashService
from app.services.work_order import _create_cash_movement_on_deposit, WorkOrderService

from tests.conftest import TestingSessionLocal


# ────────────────────────────────────────────────────────────────────
# Fixtures
# ────────────────────────────────────────────────────────────────────


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
            id=1, name="Cash Test", phone="+54 11 0000-0000",
            address="Calle Test 1", email="cash@test.com",
        ))
        db.commit()
        # The single open cash box (mirrors production).
        DailyCashService(db).open_cash(previous_balance=0)
        yield db
    finally:
        db.close()


def _open_box(db):
    box = db.query(DailyCash).filter(DailyCash.is_closed == False).first()  # noqa: E712
    assert box is not None
    return box


def _income_count(db, box):
    return (
        db.query(CashMovement)
        .filter(CashMovement.daily_cash_id == box.id, CashMovement.type == "INCOME")
        .count()
    )


def _material_json():
    return json.dumps([{
        "name": "Mármol Blanco",
        "length": 2.5, "width": 1.2, "quantity": 1,
        "price_m2": 2000, "currency": "ARS",
    }])


# ────────────────────────────────────────────────────────────────────
# 1. Seña enters the cash box exactly once on create() (double-POST safe)
# ────────────────────────────────────────────────────────────────────


def test_create_books_sena_once_even_if_reentered(cash_db):
    """The duplicate-OT incident: a second POST could fire before the first
    navigation unmounted the form. If create() were re-entered it would book
    a second seña. The `sena_registered` flag (set in the same transaction as
    the movement) makes the second booking a no-op.
    """
    svc = WorkOrderService(cash_db)
    payload = {
        "client_id": 1,
        "status": "MEASUREMENT",
        "currency": "ARS",
        "usd_rate": 1000.0,
        "payment_method": "EFECTIVO",
        "payment_method_id": 1,
        "installments": 1,
        "deposit_received": 3000.0,
        "deposit_currency": "ARS",
        "deposit_usd": 0,
        "fabrication_details": json.dumps([
            {"concept": "LENGTH", "length": 1, "width": 0, "m2": 1,
             "currency": "ARS", "price": 6000, "quantity": 1, "total": 6000},
        ]),
    }
    order = svc.create(dict(payload))
    assert order.sena_registered is True

    # Re-enter the SAME deposit booking for this order (what a duplicate
    # POST / re-create would effectively do). The helper must skip it.
    order.register_flag = "sena_registered"
    booked = _create_cash_movement_on_deposit(
        cash_db, order, order.deposit_received,
        order.deposit_currency, order.payment_method,
    )
    assert booked is False, "second booking of the same seña must be a no-op"

    box = _open_box(cash_db)
    assert _income_count(cash_db, box) == 1, (
        "create() re-entering must not mint a second seña movement"
    )


# ────────────────────────────────────────────────────────────────────
# 2. update() no longer books seña top-ups
# ────────────────────────────────────────────────────────────────────


def test_update_no_longer_books_sena_topup(cash_db):
    """Previously `update()` booked the deposit *delta* as a new INCOME.
    Now the seña only enters at create/conversion; `update()` books nothing
    for a deposit change (the rest is collected automatically at DELIVERED).
    """
    svc = WorkOrderService(cash_db)
    order = WorkOrder(
        id=99, number="A-CASH-99", client_id=1, status="MEASUREMENT",
        origin="Manual", currency="ARS", usd_rate=1000.0,
        subtotal=4500.0, total=4500.0,
        subtotal_usd=4.5, total_usd=4.5,
        balance_due=4500.0, balance_due_usd=4.5,
        materials_data=_material_json(),
        payment_method="EFECTIVO", installments=1,
    )
    cash_db.add(order)
    cash_db.commit()

    box = _open_box(cash_db)
    count_before = _income_count(cash_db, box)

    # Raise the deposit on this non-DELIVERED order. Must NOT book anything.
    result = svc.update(99, {
        "deposit_received": 4500.0,
        "deposit_currency": "ARS",
        "balance_paid": True,
    })
    assert result.deposit_received == 4500.0
    assert result.sena_registered is False
    assert result.saldo_registered is False
    assert _income_count(cash_db, box) == count_before, (
        "update() must not book a seña top-up anymore"
    )


# ────────────────────────────────────────────────────────────────────
# 3. DELIVERED books the remaining balance exactly once
# ────────────────────────────────────────────────────────────────────


def test_delivered_books_balance_due_once(cash_db):
    """OT with a 50% seña (3000 of 6000). Transitioning to DELIVERED books
    the remaining balance (3000) as a cash INCOME, exactly once.
    """
    svc = WorkOrderService(cash_db)
    order = WorkOrder(
        id=1, number="A-CASH-1", client_id=1, status="FINISHED",
        origin="Manual", currency="ARS", usd_rate=1000.0,
        subtotal=6000.0, total=6000.0,
        subtotal_usd=6.0, total_usd=6.0,
        deposit_received=3000.0, deposit_currency="ARS", deposit_usd=0.0,
        balance_due=3000.0, balance_due_usd=3.0,
        sena_registered=True,
        materials_data=_material_json(),
        payment_method="EFECTIVO", installments=1,
        additional_works_data=None,
    )
    cash_db.add(order)
    cash_db.commit()

    result = svc.update(1, {"status": "DELIVERED"})
    assert result.status == "DELIVERED"
    assert result.saldo_registered is True

    box = _open_box(cash_db)
    movs = (
        cash_db.query(CashMovement)
        .filter(CashMovement.daily_cash_id == box.id, CashMovement.type == "INCOME")
        .all()
    )
    assert len(movs) == 1, (
        f"expected exactly 1 INCOME movement for the DELIVERED saldo, got {len(movs)}"
    )
    assert movs[0].amount == pytest.approx(3000.0, abs=0.01)
    assert movs[0].order_number == "A-CASH-1"
    # `remaining_balance` must be 0 on the DELIVERED row: this INCOME is the
    # final collection, so nothing is left outstanding after it lands.
    # (`update()` force-zeros `remaining_balance` because the helper
    # otherwise stamps it with the balance being collected — which would
    # look like an unpaid saldo on the cash grid.)
    assert movs[0].remaining_balance == pytest.approx(0.0, abs=0.01)

    # Re-save / re-send DELIVERED: saldo_registered already true → no-op.
    svc.update(1, {"status": "DELIVERED", "notes": "re-save"})
    assert _income_count(cash_db, box) == 1, (
        "re-saving DELIVERED must not book the saldo twice"
    )
    cash_db.refresh(box)
    assert box.total_income == pytest.approx(3000.0, abs=0.01)


def test_delivered_when_fully_paid_books_nothing(cash_db):
    """Cliente paid 100% at the seña (balance_due == 0). DELIVERED must not
    create a movement (there is nothing left to collect).
    """
    svc = WorkOrderService(cash_db)
    order = WorkOrder(
        id=2, number="A-CASH-2", client_id=1, status="FINISHED",
        origin="Manual", currency="ARS", usd_rate=1000.0,
        subtotal=6000.0, total=6000.0,
        subtotal_usd=6.0, total_usd=6.0,
        deposit_received=6000.0, deposit_currency="ARS", deposit_usd=0.0,
        balance_due=0.0, balance_due_usd=0.0,
        sena_registered=True,
        materials_data=_material_json(),
        payment_method="EFECTIVO", installments=1,
    )
    cash_db.add(order)
    cash_db.commit()

    result = svc.update(2, {"status": "DELIVERED"})
    assert result.status == "DELIVERED"
    # balance_due == 0 → nothing booked; flag may stay False (no money moved).
    box = _open_box(cash_db)
    assert _income_count(cash_db, box) == 0


# ────────────────────────────────────────────────────────────────────
# 4. Flags persist and are exposed in the response schema
# ────────────────────────────────────────────────────────────────────


def test_cash_flags_persist_and_expose(cash_db):
    """Round-trip: `sena_registered`/`saldo_registered` survive re-reads and
    are surfaced by WorkOrderResponse (read-only, server-managed).
    """
    from app.schemas.work_order import WorkOrderResponse

    svc = WorkOrderService(cash_db)
    order = WorkOrder(
        id=3, number="A-CASH-3", client_id=1, status="MEASUREMENT",
        origin="Manual", currency="ARS", usd_rate=1000.0,
        subtotal=100.0, total=100.0,
        subtotal_usd=0.1, total_usd=0.1,
        balance_due=100.0, balance_due_usd=0.1,
        sena_registered=True, saldo_registered=False,
        materials_data=json.dumps([]),
        payment_method="EFECTIVO", installments=1,
    )
    cash_db.add(order)
    cash_db.commit()

    fetched = cash_db.query(WorkOrder).filter(WorkOrder.id == 3).first()
    assert fetched.sena_registered is True
    assert fetched.saldo_registered is False

    resp = WorkOrderResponse.from_orm_with_client(fetched).model_dump(mode="json")
    assert resp["sena_registered"] is True
    assert resp["saldo_registered"] is False

    # WorkOrderCreate / WorkOrderUpdate must NOT accept these (server-managed:
    # the client can't flip them and defeat the guard).
    from app.schemas.work_order import WorkOrderCreate, WorkOrderUpdate
    assert "sena_registered" not in WorkOrderCreate.model_fields
    assert "sena_registered" not in WorkOrderUpdate.model_fields
    assert "saldo_registered" not in WorkOrderCreate.model_fields
    assert "saldo_registered" not in WorkOrderUpdate.model_fields
