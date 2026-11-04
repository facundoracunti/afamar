"""Budget service (quotes).

Queries + CRUD live here; the heavy helpers were extracted (ADR 0009 —
modularización):

  * ``app/services/budget_helpers.py``    — croquis normalisation, the
    1-N children sync and the additional-works snapshot (frente pricing
    + budgeted-measurement freeze).
  * ``app/services/budget_conversion.py`` — the alternative-material →
    work-order conversion.

The helper names are re-exported here so the historical import path
(``from app.services.budget import _process_additional_works_snapshot``)
keeps working.
"""
import json
from datetime import date
from typing import List, Optional

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.core.settings import settings
from app.models.budget import Budget, BudgetItem, BudgetSketchElement
from app.models.work_order import WorkOrder
from app.repositories.budget import BudgetRepository
from app.repositories.work_order import WorkOrderRepository
from app.services.budget_calculator import (
    compute_alternative_totals,
    compute_detail_totals,
    compute_pool_totals,
    flatten_pieces,
    parse_additional_works_snapshot,
    parse_materials_data,
)
from app.services.budget_conversion import create_alternative_work_order
from app.services.budget_helpers import (
    _flatten_sketch_pages,
    _process_additional_works_snapshot,
    _sync_children,
)
from app.services.budget_options import is_multi_option
from app.services.commercial_rounding import (
    apply_contractual_totals,
    copy_contractual_totals,
    has_contractual_totals,
)
from app.services.dolar import get_blue_mid_rate
from app.services.frente_pricing import apply_frente_rows
from app.services.stock_helpers import deduct_pool_stock, restore_pool_stock
from app.services.work_order.recalc import recalculate_totals_from_items
from app.utils.client_helpers import apply_client_update, resolve_client_id
from app.utils.numbering import generate_budget_number, generate_work_order_number

__all__ = [
    "BudgetService",
    # Historical helper names (kept importable from this module).
    "_flatten_sketch_pages",
    "_sync_children",
    "_process_additional_works_snapshot",
    # Names that were importable from this module before the split — kept
    # here so NO existing import breaks.
    "NotFoundError",
    "ValidationError",
    "settings",
    "Budget",
    "BudgetItem",
    "BudgetSketchElement",
    "WorkOrder",
    "BudgetRepository",
    "WorkOrderRepository",
    "compute_alternative_totals",
    "compute_detail_totals",
    "compute_pool_totals",
    "flatten_pieces",
    "parse_additional_works_snapshot",
    "parse_materials_data",
    "apply_frente_rows",
    "deduct_pool_stock",
    "restore_pool_stock",
    "resolve_client_id",
    "generate_budget_number",
    "generate_work_order_number",
]


class BudgetService:
    def __init__(self, db: Session):
        self.repo = BudgetRepository(db)

    def get_all(self, skip: int = 0, limit: int = 100) -> List[Budget]:
        return self.repo.get_all(skip, limit)

    def get_by_id(self, budget_id: int) -> Optional[Budget]:
        return self.repo.get_by_id(budget_id)

    def get_by_status(self, status: str) -> List[Budget]:
        return self.repo.get_by_status(status)

    def get_by_client(self, client_id: int) -> List[Budget]:
        return self.repo.get_by_client(client_id)

    def search(self, term: str) -> List[Budget]:
        return self.repo.search(term)

    def list_filtered(self, status: Optional[str] = None, client_id: Optional[int] = None, date_from: Optional[date] = None, date_to: Optional[date] = None, search: Optional[str] = None, skip: int = 0, limit: int = 100):
        return self.repo.list_filtered(status, client_id, date_from, date_to, search, skip, limit)

    def create(self, data: dict) -> Budget:
        items_data = data.pop("items", [])
        # `additional_works_data` is the canonical wire format for selected
        # items from the `additional_works` catalogue. It carries the
        # snapshot (id, name, detail, price, currency, quantity, total) so
        # changing the catalogue doesn't rewrite historical budgets.
        # Accept the legacy list-of-BudgetAdicionalCreate too so old
        # callers still work — the new path supersedes it.
        raw_additional_works_data = data.pop("additional_works_data", None)
        legacy_additional_works = data.pop("additional_works", None)
        if raw_additional_works_data is None and legacy_additional_works:
            # Convert the legacy rows to the new snapshot format on the fly.
            raw_additional_works_data = json.dumps(
                [
                    {
                        "additional_work_id": None,
                        "name": ad.get("concept"),
                        "detail": ad.get("detail"),
                        "price": ad.get("unit_price"),
                        "currency": "ARS",
                        "quantity": ad.get("quantity") or 1,
                        "total": ad.get("total"),
                    }
                    for ad in legacy_additional_works
                ]
            )
        # `sketch_elements` arrives as a JSON-encoded string (the wire
        # format produced by `buildPayload`). We need a real list to
        # iterate over the rows — the column on the Budget is a 1-N
        # relationship to `BudgetSketchElement`, not a TEXT column.
        raw_sketch = data.pop("sketch_elements", None)
        sketch_data: list = []
        if isinstance(raw_sketch, str) and raw_sketch:
            try:
                parsed = json.loads(raw_sketch)
                if isinstance(parsed, list):
                    sketch_data = parsed
            except (ValueError, TypeError):
                sketch_data = []
        elif isinstance(raw_sketch, list):
            sketch_data = raw_sketch
        sketch_data = _flatten_sketch_pages(sketch_data)
        # Multi-piece flow: if the payload only carries `pieces_data`, derive
        # the legacy flat arrays from it. Client-provided arrays win here
        # (`only_if_missing=True`) — the budget path trusts the form totals.
        flatten_pieces(data, only_if_missing=True)

        # Materialize the additional-work snapshot before recalculating. The
        # frente total is frozen here, so the normal budget path sees the same
        # fabrication/additional/pool components as conversion and the PDF.
        if raw_additional_works_data is not None:
            data["additional_works_data"] = _process_additional_works_snapshot(
                self.repo.db,
                raw_additional_works_data,
                usd_rate=data.get("usd_rate"),
            )

        # Recompute from the complete line-item payload. This preserves the
        # existing discount/payment-method rules before the contractual round.
        recalculate_totals_from_items(self.repo.db, data)

        # New budgets receive the silent commercial snapshot. Existing rows
        # remain untouched because this path only handles creation.
        apply_contractual_totals(data)
        last_number = self.repo.get_last_number()
        data["number"] = generate_budget_number(last_number)
        data["client_id"] = resolve_client_id(
            self.repo.db, data,
            "Debe seleccionar o escribir un cliente antes de guardar el presupuesto.",
        )
        budget = self.repo.create(data)
        # Persist the snapshot directly in `additional_works_data`. We don't
        # create `BudgetAdicional` rows anymore (the legacy table is
        # kept for historical rows and could be migrated in a follow-up).
        for item_data in items_data:
            item = BudgetItem(budget_id=budget.id, **item_data)
            self.repo.add(item)
        for sk_data in sketch_data:
            el = BudgetSketchElement(budget_id=budget.id, **sk_data)
            self.repo.add(el)
        self.repo.db.commit()
        return self.repo.get_by_id(budget.id)

    def update(self, budget_id: int, data: dict) -> Optional[Budget]:
        budget = self.repo.get_by_id(budget_id)
        if not budget:
            return None
        apply_client_update(
            self.repo.db,
            data,
            budget.client_id,
            "Debe seleccionar un cliente antes de guardar el presupuesto.",
        )
        data.pop("items", None)
        # The catalogue selection is persisted as a JSON snapshot in
        # `additional_works_data` (the canonical wire format from the
        # frontend). The legacy `BudgetAdicional` 1-N table is read-only
        # on the update path — historical rows survive but we no longer
        # write new ones (mirrors the `create` path).
        data.pop("additional_works", None)
        raw_additional_works_data = data.pop("additional_works_data", None)
        # `sketch_elements` arrives as a JSON-encoded string (wire format).
        # `_sync_children` expects a list — parse it back here.
        raw_sketch = data.pop("sketch_elements", None)
        sketch_data: list | None = None
        if isinstance(raw_sketch, str):
            if raw_sketch:
                try:
                    parsed = json.loads(raw_sketch)
                    sketch_data = parsed if isinstance(parsed, list) else []
                except (ValueError, TypeError):
                    sketch_data = []
            else:
                sketch_data = []
        elif isinstance(raw_sketch, list):
            sketch_data = raw_sketch
        sketch_data = _flatten_sketch_pages(sketch_data or [])
        # Same derivation as create(): fill missing flat arrays from
        # `pieces_data` without clobbering client-provided ones.
        flatten_pieces(data, only_if_missing=True)
        # Do not retroactively round historical budgets. New budgets carry a
        # non-null contractual snapshot and keep it synchronized on edits.
        if has_contractual_totals(budget):
            # Existing budgets are frozen documents. Do not recompute or
            # round them again merely because the form sent a derived total.
            copy_contractual_totals(data, budget)
        else:
            # Legacy budgets keep their original totals until an explicit
            # future commercial policy says otherwise.
            data["total"] = budget.total
            data["total_usd"] = budget.total_usd
            for key in (
                "total_exact_ars", "total_exact_usd",
                "rounding_adjustment_ars", "rounding_adjustment_usd",
                "total_contractual_ars", "total_contractual_usd",
            ):
                data.pop(key, None)
        budget = self.repo.update(budget, data)
        if raw_additional_works_data is not None:
            budget.additional_works_data = _process_additional_works_snapshot(
                self.repo.db,
                raw_additional_works_data,
                usd_rate=data.get("usd_rate") or budget.usd_rate,
            )
        _sync_children(budget, self.repo, "sketch_elements", BudgetSketchElement, sketch_data)
        self.repo.db.commit()
        return self.repo.get_by_id(budget.id)

    def delete(self, budget_id: int) -> bool:
        budget = self.repo.get_by_id(budget_id)
        if not budget:
            return False
        if (
            self.repo.db.query(WorkOrder.id)
            .filter(WorkOrder.budget_id == budget.id)
            .first()
            is not None
        ):
            raise ConflictError(
                "No se puede eliminar un presupuesto asociado a una Orden de Trabajo"
            )
        if budget.stock_deducted:
            restore_pool_stock(
                self.repo.db, budget.pool_id, budget.pools_data, budget.number,
                notes_prefix="Restauración por eliminación de presupuesto",
            )
            budget.stock_deducted = False
        self.repo.delete(budget)
        self.repo.db.commit()
        return True

    def convert_alternative_to_work_order(self, budget_id: int, idx: int) -> WorkOrder:
        budget = (
            self.repo.db.query(Budget)
            .filter(Budget.id == budget_id)
            .with_for_update()
            .first()
        )
        if not budget:
            raise NotFoundError("Budget")
        if is_multi_option(budget):
            raise ConflictError(
                "Las alternativas legacy no pueden convertir presupuestos "
                "multiopción; use POST /budgets/{id}/convert con option_id"
            )
        return create_alternative_work_order(
            budget,
            self.repo,
            idx,
            usd_rate=get_blue_mid_rate(),
        )
