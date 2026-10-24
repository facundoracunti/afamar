"""Work-order payment reversal (admin financial correction).

Extracted verbatim from ``app/services/work_order/mutations.py`` (ADR 0009
— modularización) so no file in the package exceeds ~300 lines.
"""
from app.core.exceptions import NotFoundError
from app.core.settings import settings
from app.models.work_order import WorkOrder


def reverse_work_order_payment(repo, order_id: int, movement_id: int) -> WorkOrder:
    """Reverse an INCOME cash movement booked against a work order.

    The movement is HARD-deleted (no soft flag / migration), the open cash
    register totals are recomputed from the surviving rows, and the WO
    financial columns (``balance_due`` / ``balance_due_usd`` / ``balance_paid``)
    are re-derived from the remaining INCOME movements of the order so the
    PDF / module always show an up-to-date saldo.

    Financial correction only: the operational status (MEASUREMENT /
    WORKSHOP / FINISHED / DELIVERED) is NEVER touched, and neither are
    ``deposit_received`` / ``deposit_usd`` / ``deposit_currency`` — those drive
    the form's seña field, a different bookkeeping path from the cash
    movements. ``sena_registered`` / ``saldo_registered`` are also left as-is:
    they gate the form-deposit flow, and module payments never flip them,
    so overturning them here could double-book on a later edit.
    """
    from app.models.daily_cash import CashMovement
    from app.repositories.daily_cash import (
        CashMovementRepository,
        DailyCashRepository,
        movement_ars,
    )

    order = repo.get_by_id(order_id)
    if not order:
        raise NotFoundError("Work order")

    movement = (
        repo.db.query(CashMovement)
        .filter(
            CashMovement.id == movement_id,
            CashMovement.order_id == order_id,
            CashMovement.type == "INCOME",
        )
        .first()
    )
    if movement is None:
        raise NotFoundError("Payment")

    # Hard-delete + recompute the open-box totals within the same
    # transaction as the balance re-derivation (no intermediate commit).
    cash_id = movement.daily_cash_id
    CashMovementRepository(repo.db).delete(movement_id)
    if cash_id is not None:
        DailyCashRepository(repo.db).recalculate(cash_id)

    remaining = (
        repo.db.query(CashMovement)
        .filter(CashMovement.order_id == order_id, CashMovement.type == "INCOME")
        .all()
    )
    usd_rate = float(order.usd_rate or settings.DEFAULT_USD_RATE)
    if usd_rate <= 0:
        usd_rate = settings.DEFAULT_USD_RATE
    paid_ars = 0.0
    paid_usd = 0.0
    for mov in remaining:
        m_ars = movement_ars(mov)
        paid_ars += m_ars
        if (mov.currency or "ARS").upper() == "USD":
            paid_usd += float(mov.amount or 0)
        else:
            paid_usd += round(m_ars / usd_rate, 2)

    order.balance_due = max(0.0, round(float(order.total or 0) - paid_ars, 2))
    order.balance_due_usd = max(0.0, round(float(order.total_usd or 0) - paid_usd, 2))
    order.balance_paid = order.balance_due <= 0.001
    repo.db.commit()
    repo.db.refresh(order)
    return order
