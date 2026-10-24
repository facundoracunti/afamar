"""Work-order service (package).

Public surface — re-exports ``WorkOrderService`` so the routers
(``work_orders``, ``public``, ``search``, ``whatsapp``) keep using
``from app.services.work_order import WorkOrderService``.

The orchestrator delegates the heavy work to focused modules in the same
package:

  * ``helpers.py``   — small utilities (sketch mirror, native deposit,
                       client total, fabrication concept name sets).
  * ``cash.py``      — idempotent cash-movement booking.
  * ``recalc.py``    — server-side totals recompute (orchestrator) +
                       per-cuota detail; its own focused sub-modules are
                       ``recalc_links.py`` / ``recalc_totals.py`` /
                       ``recalc_discounts.py`` / ``recalc_alternatives.py`` /
                       ``recalc_installments.py``.
  * ``snapshots.py`` — bake measurement snapshots into ``pieces_data``.
  * ``conversion.py``— budget → WO payload assembly (shared with the
                       BudgetService convert_alternative_to_work_order
                       path).
  * ``mutations.py`` — the heavy work-order mutations (create / update /
                       delete / payment reversal); its own focused
                       sub-modules are ``creation.py`` /
                       ``updating.py`` / ``payment_reversal.py``.
"""
from datetime import date
from typing import List, Optional

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.core.settings import settings
from app.models.work_order import WorkOrder
from app.repositories.work_order import WorkOrderRepository
from app.services.stock_helpers import deduct_pool_stock, restore_pool_stock
from app.services.work_order.cash import create_cash_movement_on_deposit
from app.services.work_order.conversion import build_conversion_payload
from app.services.work_order.helpers import (
    deposit_native_amount,
    stash_sketch_into_budgeted_details,
    update_client_total_purchased,
)
from app.services.work_order.mutations import (
    VALID_TRANSITIONS as _VALID_TRANSITIONS,
    create_work_order,
    create_work_order_from_budget,
    delete_work_order,
    reverse_work_order_payment,
    update_work_order,
)
from app.services.work_order.recalc import recalculate_totals_from_items
from app.services.work_order.snapshots import bake_snapshot_into_pieces
from app.utils.client_helpers import resolve_client_id
from app.utils.numbering import generate_work_order_number

__all__ = [
    "WorkOrderService",
    # Backward-compat aliases for the legacy module-level function names
    # (with leading underscore).
    "_create_cash_movement_on_deposit",
    "_deposit_native_amount",
    "_stash_sketch_into_budgeted_details",
    "_update_client_total_purchased",
    "_recalculate_totals_from_items",
    "_bake_snapshot_into_pieces",
    # Names that were importable from this module before the split — kept
    # here so NO existing import breaks.
    "create_cash_movement_on_deposit",
    "deposit_native_amount",
    "stash_sketch_into_budgeted_details",
    "update_client_total_purchased",
    "recalculate_totals_from_items",
    "bake_snapshot_into_pieces",
    "build_conversion_payload",
    "ConflictError",
    "NotFoundError",
    "ValidationError",
    "settings",
    "deduct_pool_stock",
    "restore_pool_stock",
    "resolve_client_id",
    "generate_work_order_number",
    "WorkOrder",
    "WorkOrderRepository",
]

# Backward-compat aliases for the legacy module-level function names
# (with leading underscore). Older test modules and routers imported these
# directly from ``app.services.work_order`` before the file became a
# package; re-exporting them keeps the public surface stable while the
# implementation now lives in focused submodules.
_create_cash_movement_on_deposit = create_cash_movement_on_deposit
_deposit_native_amount = deposit_native_amount
_stash_sketch_into_budgeted_details = stash_sketch_into_budgeted_details
_update_client_total_purchased = update_client_total_purchased
_recalculate_totals_from_items = recalculate_totals_from_items
_bake_snapshot_into_pieces = bake_snapshot_into_pieces


class WorkOrderService:
    def __init__(self, db: Session):
        self.repo = WorkOrderRepository(db)

    # ---- queries --------------------------------------------------------

    def get_all(self, skip: int = 0, limit: int = 100) -> List[WorkOrder]:
        return self.repo.get_all(skip, limit)

    def get_by_id(self, order_id: int) -> Optional[WorkOrder]:
        return self.repo.get_by_id(order_id)

    def get_by_status(self, status: str) -> List[WorkOrder]:
        return self.repo.get_by_status(status)

    def get_by_client(self, client_id: int) -> List[WorkOrder]:
        return self.repo.get_by_client(client_id)

    def search(self, term: str) -> List[WorkOrder]:
        return self.repo.search(term)

    def list_filtered(
        self,
        status: str | None = None,
        client_id: int | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        search: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[List[WorkOrder], int]:
        items = self.repo.list_filtered(status, client_id, date_from, date_to, search, skip, limit)
        total = self.repo.list_filtered_count(status, client_id, date_from, date_to, search)
        return items, total

    # ---- mutations ------------------------------------------------------
    # The heavy lifting lives in ``mutations.py``; these methods keep the
    # public ``WorkOrderService`` API untouched.

    # Status transitions between the 4 main states are bidirectional so the
    # list page's "Retroceder estado" button can undo a premature advance
    # (e.g. accidentally moving a MEASUREMENT order to WORKSHOP). CANCELLED
    # is a special one-way transition handled separately (any state ->
    # CANCELLED, with pool stock restoration if it was deducted).
    VALID_TRANSITIONS = _VALID_TRANSITIONS

    def create(self, data: dict) -> WorkOrder:
        return create_work_order(self.repo, data)

    def create_from_budget(self, budget) -> WorkOrder:
        return create_work_order_from_budget(self.repo, budget)

    def update(self, order_id: int, data: dict) -> Optional[WorkOrder]:
        return update_work_order(self.repo, order_id, data)

    def delete(self, order_id: int) -> bool:
        return delete_work_order(self.repo, order_id)

    def reverse_payment(self, order_id: int, movement_id: int):
        """Reverse an INCOME cash movement booked against a work order.

        See ``app.services.work_order.mutations.reverse_work_order_payment``
        for the full contract (financial correction only — the operational
        status and the ``deposit_*`` columns are never touched).
        """
        return reverse_work_order_payment(self.repo, order_id, movement_id)
