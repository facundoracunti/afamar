import json
from datetime import date
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError, ValidationError
from app.models.additional_work import AdditionalWork
from app.models.budget import Budget, BudgetAdicional, BudgetItem, BudgetSketchElement
from app.models.material import Material
from app.models.work_order import WorkOrder
from app.repositories.budget import BudgetRepository
from app.repositories.work_order import WorkOrderRepository
from app.services.stock_helpers import deduct_pool_stock, restore_pool_stock
from app.services.budget_calculator import (
    compute_alternative_totals,
    compute_detail_totals,
    compute_pool_totals,
    parse_materials_data,
)
from app.services.frente_pricing import apply_frente_rows
from app.utils.client_helpers import resolve_client_id
from app.utils.numbering import generate_budget_number, generate_work_order_number


def _sync_children(budget: Budget, repo: BudgetRepository, attr: str, model_class, data_list: Optional[List[Dict]]):
    if data_list is None:
        return
    existing = {getattr(obj, "id"): obj for obj in getattr(budget, attr)}
    incoming_ids = {d.get("id") for d in data_list if d.get("id")}
    for obj_id, obj in existing.items():
        if obj_id not in incoming_ids:
            repo.delete(obj)
    for d in data_list:
        obj_id = d.get("id")
        if obj_id and obj_id in existing:
            for k, v in d.items():
                if k != "id":
                    setattr(existing[obj_id], k, v)
        else:
            new_obj = model_class(budget_id=budget.id, **{k: v for k, v in d.items() if k != "id"})
            repo.add(new_obj)


def _process_additional_works_snapshot(
    db: Session,
    raw_json: Optional[str],
) -> Optional[str]:
    """Take the JSON snapshot from the form, resolve any `frente`
    rows against their linked Material row, and return the serialised
    JSON for persistence (with `price`, `total`, and `formula_values`
    frozen at the chosen moment).

    Rows that aren't `frente` pass through unchanged. Rows whose linked
    catalogue item or material can't be found are kept verbatim so the
    budget doesn't lose data when an item is deleted after the fact.
    """
    if not raw_json:
        return raw_json
    try:
        rows = json.loads(raw_json) if isinstance(raw_json, str) else raw_json
    except (ValueError, TypeError):
        return raw_json
    if not isinstance(rows, list) or not rows:
        return raw_json

    catalogue_ids = {
        int(r.get("additional_work_id"))
        for r in rows
        if r.get("additional_work_id") is not None
    }
    material_ids = {
        int(r.get("assigned_material_id"))
        for r in rows
        if r.get("assigned_material_id") is not None
    }

    catalogue_by_id: Dict[int, AdditionalWork] = {}
    if catalogue_ids:
        catalogue_by_id = {
            c.id: c
            for c in db.query(AdditionalWork).filter(AdditionalWork.id.in_(catalogue_ids)).all()
        }

    materials_by_id: Dict[int, Material] = {}
    if material_ids:
        materials_by_id = {
            m.id: m for m in db.query(Material).filter(Material.id.in_(material_ids)).all()
        }

    processed = apply_frente_rows(
        rows,
        catalogue_by_id=catalogue_by_id,
        materials_by_id=materials_by_id,
    )
    return json.dumps(processed, ensure_ascii=False)


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
        if raw_additional_works_data is not None:
            budget.additional_works_data = _process_additional_works_snapshot(
                self.repo.db, raw_additional_works_data
            )
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
        items_data = data.pop("items", None)
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
        budget = self.repo.update(budget, data)
        if raw_additional_works_data is not None:
            budget.additional_works_data = _process_additional_works_snapshot(
                self.repo.db, raw_additional_works_data
            )
        _sync_children(budget, self.repo, "sketch_elements", BudgetSketchElement, sketch_data)
        self.repo.db.commit()
        return self.repo.get_by_id(budget.id)

    def delete(self, budget_id: int) -> bool:
        budget = self.repo.get_by_id(budget_id)
        if not budget:
            return False
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
        budget = self.repo.get_by_id(budget_id)
        if not budget:
            raise NotFoundError("Budget")

        materials = parse_materials_data(budget.materials_data)
        if idx < 0 or idx >= len(materials):
            raise ValidationError(f"Alternative index {idx} out of range")

        alt = materials[idx]
        if not (alt.get("is_alternative") or alt.get("es_alternativa")):
            raise ValidationError("Material at index is not marked as alternative")

        mat_cost_ars, mat_cost_usd, alt_currency, usd_rate_value, _ = compute_alternative_totals(alt, budget)

        detalles = []
        if budget.fabrication_details:
            try:
                detalles = json.loads(budget.fabrication_details) if isinstance(budget.fabrication_details, str) else budget.fabrication_details
            except (json.JSONDecodeError, TypeError):
                pass
        total_detalles_ars, total_detalles_usd = compute_detail_totals(detalles)

        pools = parse_materials_data(budget.pools_data)
        total_piletas_ars, total_piletas_usd = compute_pool_totals(pools)

        traslado = float(budget.transport or 0)

        if alt_currency == "USD":
            subtotal_ars = total_detalles_ars + total_piletas_ars
            subtotal_usd = mat_cost_usd + total_detalles_usd + total_piletas_usd
        else:
            subtotal_ars = mat_cost_ars + total_detalles_ars + total_piletas_ars
            subtotal_usd = total_detalles_usd + total_piletas_usd

        total_ars = round(subtotal_ars + round(subtotal_usd * usd_rate_value, 2) + traslado)
        total_usd_val = round(subtotal_usd + round(subtotal_ars / usd_rate_value, 2) + round(traslado / usd_rate_value, 2), 2) if usd_rate_value > 0 else 0

        common = [m for m in materials if not (m.get("is_alternative") or m.get("es_alternativa"))]
        budgeted_details_list = [alt] + common

        last_number = self.repo.db.query(WorkOrder).order_by(WorkOrder.id.desc()).first()
        number = generate_work_order_number(last_number.number if last_number else None)

        alt_nombre = alt.get("nombre") or alt.get("name") or alt.get("description") or ""
        alt_precio_m2 = alt.get("price_m2") or alt.get("precio_m2", 0) or 0
        alt_color = alt.get("color") or ""
        alt_espesor = alt.get("espesor") or alt.get("thickness") or ""

        data = {
            "number": number,
            "client_id": budget.client_id,
            "delivery_address_id": budget.delivery_address_id,
            "budget_id": budget.id,
            "status": "MEASUREMENT",
            "origin": "Desde alternativa",
            "material": alt_nombre,
            "material_price_m2": alt_precio_m2,
            "materials_data": json.dumps(materials),
            "additional_works_data": None,
            "color": alt_color or budget.color,
            "thickness": alt_espesor or budget.thickness,
            "finish": alt.get("finish") or budget.finish,
            "bacha": budget.bacha,
            "anafe": budget.anafe,
            "currency": alt_currency,
            "usd_rate": usd_rate_value,
            "subtotal": round(subtotal_ars),
            "transport": traslado,
            "installation": budget.installation or 0,
            "discount": budget.discount or 0,
            "discount_percentage": budget.discount_percentage or 0,
            "discount_fixed_amount": budget.discount_fixed_amount or 0,
            "total": total_ars,
            "subtotal_usd": round(subtotal_usd, 2),
            "transport_usd": round(traslado / usd_rate_value, 2) if usd_rate_value > 0 else 0,
            "total_usd": total_usd_val,
            "deposit_received": budget.deposit_received or 0,
            "deposit_currency": budget.deposit_currency or "ARS",
            "deposit_usd": budget.deposit_usd or 0,
            "balance_due": max(0, total_ars - (budget.deposit_received or 0)),
            "balance_due_usd": max(0, total_usd_val - (budget.deposit_usd or 0)),
            "payment_method": budget.payment_method,
            "installments": budget.installments or 1,
            "priority": budget.priority or "NORMAL",
            "delivery_date": budget.delivery_date,
            "notes": budget.notes,
            "fabrication_details": budget.fabrication_details,
            "budgeted_details": json.dumps(budgeted_details_list),
            # Carry the croquis over too — same logic as `create_from_budget`
            # in work_order.py. The source is the `BudgetSketchElement` rows
            # on the budget; we serialise them into the new
            # `WorkOrder.sketch_elements` TEXT column so the WO form + PDF
            # show the same drawing the customer signed on the budget.
            "sketch_elements": (
                json.dumps(
                    [
                        {"type": el.type, "data": el.data, "order": el.order}
                        for el in budget.sketch_elements
                    ],
                    ensure_ascii=False,
                )
                if budget.sketch_elements
                else None
            ),
            "design_observations": budget.design_observations or "",
            "important_observations": budget.important_observations or "",
            "date": budget.date,
        }

        wo_repo = WorkOrderRepository(self.repo.db)
        work_order = wo_repo.create(data)
        self.repo.db.commit()
        self.repo.db.refresh(work_order)
        deduct_pool_stock(self.repo.db, budget.pool_id, budget.pools_data, work_order.number)
        work_order.stock_deducted = True
        self.repo.db.commit()
        self.repo.db.refresh(work_order)
        return work_order
