"""Cash-movement booking for work orders.

Wraps ``DailyCashService.create_movement`` with the idempotency flag
mechanics (``sena_registered`` / ``saldo_registered``) and the dual-
currency ARS/USD semantics. Lives in its own module so the service
orchestrator (``__init__``) doesn't carry the 70-line helper inline.
"""
from sqlalchemy.orm import Session

from app.models.work_order import WorkOrder
from app.services.daily_cash import DailyCashService


def create_cash_movement_on_deposit(
    db: Session,
    order: "WorkOrder",
    amount: float,
    deposit_currency: str | None,
    payment_method: str | None,
    *,
    currency: str | None = None,
) -> bool:
    """Book a cash INCOME for a work order exactly once.

    Idempotency guard: a WO's money must enter the cash box only ONCE, no
    matter how many times create()/create_from_budget()/update() run (double
    POSTs, re-saves). The caller passes the specific flag that gates this
    booking (e.g. ``sena_registered`` for the initial seña) via the
    ``register_key`` attribute set on ``order``, and the helper sets it to True
    in the same transaction that books the movement.

    Currency handling: when the seña is native USD (``deposit_currency ==
    "USD"``), ``amount`` is the USD value and the movement is recorded with
    ``currency='USD'`` + ``amount_ars`` (amount × order.usd_rate) so the box
    totals stay ARS-consistent. Callers that book an already-ARS value (e.g.
    the saldo at DELIVERED, which is the ARS ``balance_due``) pass
    ``currency='ARS'`` explicitly.

    Returns True if a movement was booked, False if it was skipped (already
    registered or amount <= 0).
    """
    if not amount or amount <= 0:
        return False
    flag = getattr(order, "register_flag", "sena_registered")
    if getattr(order, flag, False):
        return False

    if currency is None:
        currency = "USD" if (deposit_currency or "").upper() == "USD" else "ARS"
    if currency == "USD":
        usd_rate = float(order.usd_rate or 0)
        amount_ars = round(float(amount) * usd_rate, 2) if usd_rate > 0 else round(float(amount), 2)
    else:
        usd_rate = None
        amount_ars = round(float(amount), 2)

    client_name = ""
    if order.client:
        client_name = order.client.name or ""
    cash_service = DailyCashService(db)
    movement_data = {
        "type": "INCOME",
        "amount": amount,
        "currency": currency,
        "amount_ars": amount_ars,
        "usd_rate": usd_rate,
        "description": f"Seña {order.number} - {client_name}",
        "payment_method": payment_method or "EFECTIVO",
        "order_number": order.number,
        "order_id": order.id,
        "order_total": order.total or amount,
        "client_name": client_name,
        "folder_status": order.status,
        "remaining_balance": max(0.0, (order.balance_due or 0.0)),
    }
    # Mark the flag BEFORE the commit inside create_movement so both the
    # movement and the flag persist together (atomic window).
    setattr(order, flag, True)
    cash_service.create_movement(movement_data)
    return True
