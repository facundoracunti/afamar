"""Work-order mutations — orchestrator.

The heavy work-order mutations live in focused sibling modules (ADR 0009
— modularización):

  * ``creation.py``        — create (direct sale) + create from budget.
  * ``updating.py``        — update (totals recompute + status changes).
  * ``payment_reversal.py``— reverse an INCOME cash movement.

This module re-exports them so the public import paths stay stable.
"""
from app.core.exceptions import ValidationError
from app.services.stock_helpers import restore_pool_stock
from app.services.work_order.creation import (
    create_work_order,
    create_work_order_from_budget,
)
from app.services.work_order.payment_reversal import reverse_work_order_payment
from app.services.work_order.pool_requirements import has_active_pool_requirements
from app.services.work_order.updating import VALID_TRANSITIONS, update_work_order

__all__ = [
    "VALID_TRANSITIONS",
    "create_work_order",
    "create_work_order_from_budget",
    "delete_work_order",
    "reverse_work_order_payment",
    "update_work_order",
]


def delete_work_order(repo, order_id: int) -> bool:
    """Delete a work order, restoring the pool stock if it was deducted."""
    order = repo.get_by_id(order_id)
    if not order:
        return False
    if has_active_pool_requirements(repo.db, order.id):
        raise ValidationError(
            "La orden tiene requerimientos de piletas. Confirme la recuperación "
            "por modelo antes de eliminarla."
        )
    if order.stock_deducted:
        restore_pool_stock(repo.db, order.pool_id, order.pools_data, order.number)
    repo.delete(order)
    repo.db.commit()
    return True
