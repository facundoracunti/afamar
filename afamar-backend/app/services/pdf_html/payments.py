"""Cash-movement aggregation for the legacy PDF.

The work-order PDF shows a unified "Seña / Pagos Registrados" row built
from the INCOME cash movements booked against the order.
"""


def _sum_income_paid(db, order_id) -> float:
    """Sum of the INCOME cash movements booked for a work order — the seña
    registered at creation (see `WorkOrderService._create_cash_movement_on_
    deposit`, idempotent via `sena_registered`) plus every payment registered
    through the payment module (`POST /cash/movements` with `order_id`). This
    is the authoritative "monto pagado acumulado" the PDF shows in the
    unified `Seña / Pagos Registrados` row (Paid + Saldo = TOTAL).

    Returns 0 when `db` is None (legacy call sites / pure-data tests) so
    callers fall back to the deposit equivalent.
    """
    if db is None or not order_id:
        return 0.0
    from sqlalchemy import func

    from app.models.daily_cash import CashMovement

    total = (
        db.query(func.coalesce(func.sum(CashMovement.amount), 0.0))
        .filter(CashMovement.order_id == order_id, CashMovement.type == "INCOME")
        .scalar()
    )
    return round(float(total or 0.0), 2)
