import json
from datetime import date
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.budget import Budget, BudgetAdicional, BudgetItem, BudgetSketchElement
from app.models.pool_stock import PoolStock, StockMovement
from app.models.work_order import WorkOrder
from app.repositories.budget import BudgetRepository
from app.repositories.work_order import WorkOrderRepository
from app.services.budget_calculator import (
    compute_alternative_totals,
    compute_detail_totals,
    compute_pool_totals,
    parse_materials_data,
)
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

    def list_filtered(self, status: Optional[str] = None, client_id: Optional[int] = None, date_from: Optional[date] = None, date_to: Optional[date] = None, skip: int = 0, limit: int = 100):
        return self.repo.list_filtered(status, client_id, date_from, date_to, skip, limit)

    def create(self, data: dict) -> Budget:
        items_data = data.pop("items", [])
        adicionales_data = data.pop("adicionales", [])
        sketch_data = data.pop("sketch_elements", [])
        last_number = self.repo.get_last_number()
        data["number"] = generate_budget_number(last_number)
        client_id = data.get("client_id")
        if not client_id:
            client_name = data.get("client_name")
            if client_name:
                from app.models.client import Client
                client = self.repo.db.query(Client).filter(Client.name == client_name).first()
                if not client:
                    client = Client(
                        name=client_name,
                        phone=data.get("client_phone"),
                        email=data.get("client_email"),
                        address=data.get("client_address"),
                    )
                    self.repo.db.add(client)
                    self.repo.db.flush()
                data["client_id"] = client.id
            else:
                raise ValueError("client_id or client_name is required")
        data.pop("client_name", None)
        data.pop("client_phone", None)
        data.pop("client_email", None)
        data.pop("client_address", None)
        budget = self.repo.create(data)
        for item_data in items_data:
            item = BudgetItem(budget_id=budget.id, **item_data)
            self.repo.add(item)
        for ad_data in adicionales_data:
            ad = BudgetAdicional(budget_id=budget.id, **ad_data)
            self.repo.add(ad)
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
        adicionales_data = data.pop("adicionales", None)
        sketch_data = data.pop("sketch_elements", None)
        budget = self.repo.update(budget, data)
        _sync_children(budget, self.repo, "items", BudgetItem, items_data)
        _sync_children(budget, self.repo, "adicionales", BudgetAdicional, adicionales_data)
        _sync_children(budget, self.repo, "sketch_elements", BudgetSketchElement, sketch_data)
        self.repo.db.commit()
        return self.repo.get_by_id(budget.id)

    def delete(self, budget_id: int) -> bool:
        budget = self.repo.get_by_id(budget_id)
        if not budget:
            return False
        if budget.stock_deducted:
            pools_restored = set()
            if budget.pool_id and budget.pool_id not in pools_restored:
                pool = self.repo.db.query(PoolStock).filter(PoolStock.id == budget.pool_id).first()
                if pool:
                    pool.quantity = (pool.quantity or 0) + 1
                    movement = StockMovement(
                        pool_id=pool.id,
                        type="entry",
                        quantity=1,
                        notes=f"Restauración por eliminación de presupuesto {budget.number}",
                    )
                    self.repo.db.add(movement)
                pools_restored.add(budget.pool_id)
            if budget.pools_data:
                try:
                    pools_list = json.loads(budget.pools_data) if isinstance(budget.pools_data, str) else budget.pools_data
                    for entry in pools_list if isinstance(pools_list, list) else []:
                        pid = entry.get("pool_id") or entry.get("id")
                        qty = entry.get("quantity", 1)
                        if pid and pid not in pools_restored:
                            pool = self.repo.db.query(PoolStock).filter(PoolStock.id == pid).first()
                            if pool:
                                pool.quantity = (pool.quantity or 0) + qty
                                movement = StockMovement(
                                    pool_id=pool.id,
                                    type="entry",
                                    quantity=qty,
                                    notes=f"Restauración por eliminación de presupuesto {budget.number}",
                                )
                                self.repo.db.add(movement)
                            pools_restored.add(pid)
                except (json.JSONDecodeError, TypeError):
                    pass
            budget.stock_deducted = False
        self.repo.delete(budget)
        self.repo.db.commit()
        return True

    def convert_alternative_to_work_order(self, budget_id: int, idx: int) -> WorkOrder:
        budget = self.repo.get_by_id(budget_id)
        if not budget:
            raise ValueError("Budget not found")

        materials = parse_materials_data(budget.materials_data)
        if idx < 0 or idx >= len(materials):
            raise ValueError(f"Alternative index {idx} out of range")

        alt = materials[idx]
        if not alt.get("es_alternativa"):
            raise ValueError("Material at index is not marked as alternative")

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

        common = [m for m in materials if not m.get("es_alternativa")]
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
            "budget_id": budget.id,
            "status": "MEASUREMENT",
            "origin": "Desde alternativa",
            "material": alt_nombre,
            "material_price_m2": alt_precio_m2,
            "materials_data": json.dumps(materials),
            "adicionales_data": None,
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
            "design_observations": budget.design_observations or "",
            "important_observations": budget.important_observations or "",
            "snapshot_name": budget.snapshot_name,
            "snapshot_phone": budget.snapshot_phone,
            "snapshot_email": budget.snapshot_email,
            "snapshot_address": budget.snapshot_address,
            "date": budget.date,
        }

        wo_repo = WorkOrderRepository(self.repo.db)
        work_order = wo_repo.create(data)
        work_order.stock_deducted = True
        self.repo.db.commit()
        self.repo.db.refresh(work_order)
        return work_order
