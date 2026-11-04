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
import logging
from datetime import date
from typing import List, Optional

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.core.settings import settings
from app.models.budget import Budget, BudgetAdicional, BudgetItem, BudgetSketchElement
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
    SNAPSHOT_KEYS,
    apply_contractual_totals,
    apply_live_budget_rounding,
)
from app.services.dolar import get_blue_mid_rate
from app.services.frente_pricing import apply_frente_rows
from app.services.stock_helpers import deduct_pool_stock, restore_pool_stock
from app.services.work_order.recalc import recalculate_totals_from_items
from app.utils.client_helpers import apply_client_update, resolve_client_id
from app.utils.numbering import generate_budget_number, generate_work_order_number

logger = logging.getLogger(__name__)

JSON_DATA_FIELDS = (
    "pools_data",
    "materials_data",
    "pieces_data",
    "additional_works_data",
    "options_data",
)

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

        # Recompute from the complete line-item payload. The budget remains a
        # live quote at this point; contractual rounding belongs to the OT
        # conversion, not to the editable budget.
        recalculate_totals_from_items(self.repo.db, data)
        # A budget is an editable quote. Never accept contractual snapshot
        # fields sent by the client during creation.
        apply_live_budget_rounding(data)
        for key in SNAPSHOT_KEYS:
            data.pop(key, None)
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
        if legacy_additional_works is not None:
            _sync_children(
                budget, self.repo, "additional_works", BudgetAdicional,
                legacy_additional_works,
            )
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
        recalculation_requested = bool(
            set(data).intersection({
                "materials_data", "fabrication_details", "additional_works_data",
                "pools_data", "pieces_data", "usd_rate", "transport", "transport_usd",
                "discount_enabled", "discount_target", "discount_percentage",
                "discount_fixed_amount", "payment_method", "payment_method_id",
                "installments", "deposit_received", "deposit_currency", "deposit_usd",
                "balance_paid",
            })
        )
        # These legacy 1-N relations are independent from the canonical JSON
        # snapshots (`pools_data` and `additional_works_data`). Only sync them
        # when the caller explicitly sends the collection: a header-only PUT
        # must never delete children, while an explicit [] must delete all.
        items_data = data.pop("items", None)
        legacy_additional_works = data.pop("additional_works", None)
        # The catalogue selection is persisted as a JSON snapshot in
        # `additional_works_data` (the canonical wire format from the
        # frontend). The legacy `BudgetAdicional` 1-N table is read-only
        # on the update path — historical rows survive but we no longer
        # write new ones (mirrors the `create` path).
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

        recalculation_requested = recalculation_requested or raw_additional_works_data is not None
        if not recalculation_requested:
            budget = self._persist_update(budget, data)
            if data.get("status", budget.status) != "CONVERTED_TO_OT":
                for key in SNAPSHOT_KEYS:
                    setattr(budget, key, None)
            _sync_children(budget, self.repo, "items", BudgetItem, items_data)
            _sync_children(
                budget, self.repo, "additional_works", BudgetAdicional,
                legacy_additional_works,
            )
            _sync_children(budget, self.repo, "sketch_elements", BudgetSketchElement, sketch_data)
            self.repo.db.commit()
            self.repo.db.refresh(budget)
            return self.repo.get_by_id(budget.id)

        # Recalculate from the complete current document, not from the
        # previous contractual snapshot. A partial PUT may omit line-item
        # arrays, so use the persisted values as defaults and let explicit
        # payload values win.
        recalculation_fields = (
            "materials_data", "fabrication_details", "additional_works_data",
            "pools_data", "pieces_data", "usd_rate", "transport", "transport_usd",
            "discount_enabled", "discount_target", "discount_percentage",
            "discount_fixed_amount", "payment_method", "payment_method_id",
            "installments", "deposit_received", "deposit_currency", "deposit_usd",
            "balance_paid",
        )
        recalculation_data = {
            key: getattr(budget, key, None)
            for key in recalculation_fields
        }
        recalculation_data.update(data)

        # Materialize the submitted additional-work snapshot before the
        # calculation. Otherwise the recalc reads the old JSON from the row.
        if raw_additional_works_data is not None:
            recalculation_data["additional_works_data"] = _process_additional_works_snapshot(
                self.repo.db,
                raw_additional_works_data,
                usd_rate=recalculation_data.get("usd_rate") or budget.usd_rate,
            )

        # Same derivation as create(): fill missing flat arrays from pieces
        # without clobbering client-provided arrays.
        flatten_pieces(recalculation_data, only_if_missing=True)
        recalculate_totals_from_items(self.repo.db, recalculation_data)

        # `CONVERTED_TO_OT` is the persisted state that means the quote has
        # become a confirmed work order. It is the only budget state allowed
        # to carry a contractual snapshot. Every other state stays dynamic.
        target_status = data.get("status", budget.status)
        is_locked_as_work_order = target_status == "CONVERTED_TO_OT"
        if is_locked_as_work_order:
            apply_contractual_totals(recalculation_data)
        else:
            apply_live_budget_rounding(recalculation_data)
            for key in SNAPSHOT_KEYS:
                recalculation_data.pop(key, None)

        # Copy both derived line-item arrays and every calculated monetary
        # field back into the repository payload before persisting the row.
        persisted_calculation_fields = (
            "materials_data", "fabrication_details", "additional_works_data",
            "pools_data", "pieces_data", "payment_method",
            "installment_detail_ars", "installment_detail_usd", "deposit_usd",
            "subtotal", "subtotal_usd", "total", "total_usd", "balance_due",
            "balance_due_usd", "total_exact_ars", "total_exact_usd",
            "rounding_adjustment_ars", "rounding_adjustment_usd",
            "total_contractual_ars", "total_contractual_usd",
        )
        for key in persisted_calculation_fields:
            if key in recalculation_data:
                data[key] = recalculation_data[key]

        budget = self._persist_update(budget, data)
        if not is_locked_as_work_order:
            # BudgetRepository intentionally ignores None values for ordinary
            # partial updates. Snapshot columns are different: clearing them
            # is required to invalidate a stale contractual total.
            for key in SNAPSHOT_KEYS:
                setattr(budget, key, None)
        _sync_children(budget, self.repo, "items", BudgetItem, items_data)
        _sync_children(
            budget, self.repo, "additional_works", BudgetAdicional,
            legacy_additional_works,
        )
        _sync_children(budget, self.repo, "sketch_elements", BudgetSketchElement, sketch_data)
        self.repo.db.commit()
        self.repo.db.refresh(budget)
        return self.repo.get_by_id(budget.id)

    def _persist_update(self, budget: Budget, data: dict) -> Budget:
        """Persist ordinary fields and JSON child collections separately."""
        json_values = {
            field: data[field]
            for field in JSON_DATA_FIELDS
            if field in data
        }
        scalar_data = {
            key: value
            for key, value in data.items()
            if key not in JSON_DATA_FIELDS
            and key in {column.key for column in Budget.__table__.columns}
        }
        budget = self.repo.update(budget, scalar_data)
        # These are the canonical persisted child collections from the form.
        # Assign them explicitly instead of relying on a generic mapper.
        for field, value in json_values.items():
            setattr(budget, field, value)
        return self.repo.save(budget)

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
