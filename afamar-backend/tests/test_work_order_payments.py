"""Tests for GET /work-orders/{order_id}/payments.

The endpoint returns the cash INCOME movements of a work order so the
frontend WhatsApp / payment views can surface the active Payway checkout
URL (persisted on the movement as `payway_checkout_url`).
"""
import datetime as dt

from app.models.client import Client
from app.models.daily_cash import CashMovement, DailyCash
from app.models.reference import PaymentMethod
from app.models.work_order import WorkOrder

from tests.conftest import TestingSessionLocal


def _seed_order_with_movement(order_id: int, number: str, url: str | None) -> None:
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
                id=1, name="Pago Test", phone="+54 11 0000-0000",
                address="Calle Test 1", email="pago@test.com",
            ))
        db.add(WorkOrder(
            id=order_id, number=number, client_id=1, status="MEASUREMENT",
            origin="Manual", currency="ARS", usd_rate=1000.0,
            subtotal=50000.0, total=50000.0,
            subtotal_usd=50.0, total_usd=50.0,
            balance_due=50000.0, balance_due_usd=50.0,
            materials_data="[]",
            payment_method="EFECTIVO", installments=1,
        ))
        db.add(CashMovement(
            id=1, daily_cash_id=1, type="INCOME", amount=50000.0,
            description="Seña", order_id=order_id, order_number=number,
            order_total=50000.0, client_name="Pago Test",
            payment_method="EFECTIVO", payway_checkout_url=url,
        ))
        db.commit()
    finally:
        db.close()


def test_list_order_payments_returns_movements_with_payway_url(client):
    _seed_order_with_movement(123, "A-PAY-123", "https://payway.example.com/link/A-PAY-123-abc")
    r = client.get("/api/v1/work-orders/123/payments")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["success"] is True
    data = body["data"]
    assert len(data) == 1
    assert data[0]["order_id"] == 123
    assert data[0]["order_number"] == "A-PAY-123"
    assert data[0]["payway_checkout_url"] == "https://payway.example.com/link/A-PAY-123-abc"
    assert data[0]["type"] == "INCOME"


def test_list_order_payments_omits_non_income_movements(client):
    """Expenses and other movement types must not leak into the payments
    list — only INCOME row is payable."""
    _seed_order_with_movement(456, "A-PAY-456", None)
    db = TestingSessionLocal()
    try:
        db.add(CashMovement(
            id=2, daily_cash_id=1, type="EXPENSE", amount=100.0,
            description="Gasto", order_id=456, payway_checkout_url=None,
        ))
        db.commit()
    finally:
        db.close()
    r = client.get("/api/v1/work-orders/456/payments")
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert len(data) == 1
    assert data[0]["type"] == "INCOME"


def test_list_order_payments_empty_when_no_movements(client):
    r = client.get("/api/v1/work-orders/999/payments")
    assert r.status_code == 200, r.text
    assert r.json()["data"] == []