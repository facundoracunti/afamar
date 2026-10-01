"""Tests for DELETE /work-orders/{order_id}/payments/{movement_id}.

Admin-only payment reversal: hard-deletes the linked cash INCOME movement,
recomputes the open register totals and re-derives `balance_due` /
`balance_due_usd` / `balance_paid` of the work order from the surviving
movements. The operational status and the `deposit_*` form columns are never
touched by a reversal.
"""
import datetime as dt

from app.api.dependencies import get_current_user
from app.models.client import Client
from app.models.daily_cash import CashMovement, DailyCash
from app.models.reference import PaymentMethod
from app.models.user import User
from app.models.work_order import WorkOrder

from tests.conftest import TestingSessionLocal


def _seed(order_id: int, number: str) -> None:
    """Seed one open cash register + one order with two INCOME movements:
    the seña (ARS 50.000) and a module payment (ARS 100.000, `Concepto:`
    description). The order total is ARS 150.000 / USD 150, so fully paid."""
    db = TestingSessionLocal()
    try:
        if db.query(DailyCash).count() == 0:
            db.add(DailyCash(
                id=1, number=1, date=dt.date(2026, 9, 20),
                is_closed=False, previous_balance=0.0,
            ))
        if not db.query(PaymentMethod).first():
            db.add(PaymentMethod(
                id=1, name="EFECTIVO", label="Efectivo",
                is_active=True, sort_order=10,
                type="NONE", value=0.0, is_percentage=False, applies_to_installments=False,
            ))
        if not db.query(Client).first():
            db.add(Client(
                id=1, name="Reversal Test", phone="+54 11 0000-0000",
                address="Calle Test 1", email="reversal@test.com",
            ))
        db.add(WorkOrder(
            id=order_id, number=number, client_id=1, status="MEASUREMENT",
            origin="Manual", currency="ARS", usd_rate=1000.0,
            subtotal=150000.0, total=150000.0,
            subtotal_usd=150.0, total_usd=150.0,
            balance_due=0.0, balance_due_usd=0.0,
            balance_paid=True,
            materials_data="[]",
            payment_method="EFECTIVO", installments=1,
        ))
        db.add(CashMovement(
            id=1, daily_cash_id=1, type="INCOME", amount=50000.0,
            description=f"Seña {number} - Reversal Test",
            order_id=order_id, order_number=number, order_total=150000.0,
            client_name="Reversal Test", payment_method="EFECTIVO",
        ))
        db.add(CashMovement(
            id=2, daily_cash_id=1, type="INCOME", amount=100000.0,
            description=f"Concepto: Saldo Restante - {number} - Reversal Test",
            order_id=order_id, order_number=number, order_total=150000.0,
            client_name="Reversal Test", payment_method="EFECTIVO",
        ))
        db.commit()
    finally:
        db.close()


def test_admin_reverses_payment_and_recomputes_balance(client):
    _seed(321, "A-REV-321")
    r = client.delete("/api/v1/work-orders/321/payments/2")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["success"] is True
    assert body["data"]["order_id"] == 321
    assert body["data"]["balance_due"] == 100000.0
    assert body["data"]["balance_paid"] is False

    db = TestingSessionLocal()
    try:
        # Movement hard-deleted.
        assert db.query(CashMovement).filter(CashMovement.id == 2).count() == 0
        # The seña movement survives.
        mov = db.query(CashMovement).filter(CashMovement.id == 1).one()
        assert mov.type == "INCOME"
        # Box totals recomputed from the surviving rows.
        cash = db.query(DailyCash).filter(DailyCash.id == 1).one()
        assert cash.total_income == 50000.0
        assert cash.total_sum == 50000.0
        assert cash.current_balance == 50000.0
        # W/O financial columns re-derived from the remaining movements.
        order = db.query(WorkOrder).filter(WorkOrder.id == 321).one()
        assert order.balance_due == 100000.0
        assert order.balance_due_usd == 100.0
        assert order.balance_paid is False
        # Operational status + form columns untouched.
        assert order.status == "MEASUREMENT"
        assert order.deposit_received == 0.0
        assert order.deposit_usd == 0.0
        assert order.sena_registered is False
    finally:
        db.close()


def test_reversing_both_movements_restores_full_balance_due(client):
    """Reversing the module payment then the seña brings balance_due back to
    the full total and the box back to zero income."""
    _seed(326, "A-REV-326")
    r = client.delete("/api/v1/work-orders/326/payments/2")
    assert r.status_code == 200, r.text
    assert r.json()["data"]["balance_due"] == 100000.0

    r = client.delete("/api/v1/work-orders/326/payments/1")
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["balance_due"] == 150000.0
    assert data["balance_paid"] is False

    db = TestingSessionLocal()
    try:
        assert db.query(CashMovement).filter(CashMovement.id.in_([1, 2])).count() == 0
        cash = db.query(DailyCash).filter(DailyCash.id == 1).one()
        assert cash.total_income == 0.0
    finally:
        db.close()


def test_non_admin_cannot_reverse(client):
    _seed(322, "A-REV-322")
    from app.main import app as _app
    _app.dependency_overrides[get_current_user] = lambda: User(
        id=2, username="operador", email="op@test.com",
        is_active=True, is_admin=False,
    )
    try:
        r = client.delete("/api/v1/work-orders/322/payments/2")
        assert r.status_code == 403, r.text
    finally:
        _app.dependency_overrides.clear()
    db = TestingSessionLocal()
    try:
        assert db.query(CashMovement).filter(CashMovement.id == 2).count() == 1
    finally:
        db.close()


def test_reverse_missing_movement_404(client):
    _seed(323, "A-REV-323")
    r = client.delete("/api/v1/work-orders/323/payments/999")
    assert r.status_code == 404, r.text


def test_reverse_movement_of_other_order_404(client):
    _seed(324, "A-REV-324")
    r = client.delete("/api/v1/work-orders/999/payments/2")
    assert r.status_code == 404, r.text


def test_reverse_expense_movement_404(client):
    """Only INCOME movements are payable/reversible — expenses must 404."""
    _seed(325, "A-REV-325")
    db = TestingSessionLocal()
    try:
        db.add(CashMovement(
            id=3, daily_cash_id=1, type="EXPENSE", amount=10.0,
            description="Gasto", order_id=325,
        ))
        db.commit()
    finally:
        db.close()
    r = client.delete("/api/v1/work-orders/325/payments/3")
    assert r.status_code == 404, r.text
    db = TestingSessionLocal()
    try:
        assert db.query(CashMovement).filter(CashMovement.id == 3).count() == 1
    finally:
        db.close()