import json
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.online_budget import OnlineBudget
from app.models.pool_stock import PoolStock, StockMovement
from app.repositories.online_budget import OnlineBudgetRepository
from app.services.work_order import WorkOrderService
from app.utils.numbering import generate_budget_number


CUTOUT_MAP = {
    "APERTURA + PEGADO PILETA": "POOL CUTOUT",
    "APERTURA PILETA APOYO": "SUPPORT POOL CUTOUT",
    "APERTURA ANAFE": "COOKTOP CUTOUT",
}


class OnlineBudgetService:
    def __init__(self, db: Session):
        self.repo = OnlineBudgetRepository(db)

    def get_all(self, skip: int = 0, limit: int = 100) -> List[OnlineBudget]:
        return self.repo.get_all(skip, limit)

    def get_by_id(self, budget_id: int) -> Optional[OnlineBudget]:
        return self.repo.get_by_id(budget_id)

    def create(self, data: dict) -> OnlineBudget:
        last_number = self.repo.get_last_number()
        data["number"] = generate_budget_number(last_number)
        budget = self.repo.create(data)
        self.repo.db.commit()
        self.repo.db.refresh(budget)
        return budget

    def convert_to_work_order(self, budget_id: int):
        online_budget = self.repo.get_by_id(budget_id)
        if not online_budget:
            raise ValueError("Online budget not found")
        if online_budget.status == "CONVERTED_TO_OT":
            raise ValueError("Online budget already converted")

        items_json = online_budget.items_data or "[]"
        try:
            items_data = json.loads(items_json) if isinstance(items_json, str) else items_json
        except (json.JSONDecodeError, TypeError):
            items_data = []

        pools = []
        fabrication_details_list = []
        material_lines = []
        detail_lines = []

        for item in (items_data if isinstance(items_data, list) else []):
            detail = item.get("detail", item.get("description", item.get("type", "")))
            qty = item.get("quantity", 1)
            total = item.get("total", 0)
            es_unidad = item.get("es_unidad", False)
            pileta_id = item.get("pileta_id")

            if pileta_id:
                pool = self.repo.db.query(PoolStock).filter(PoolStock.id == pileta_id).first()
                if pool:
                    pools.append({
                        "pool_id": pool.id,
                        "brand": pool.brand,
                        "model": pool.model,
                        "quantity": qty,
                    })
                continue

            if es_unidad and detail in CUTOUT_MAP:
                fabrication_details_list.append({
                    "type": "fabrication",
                    "concept": CUTOUT_MAP[detail],
                    "detail": detail,
                    "quantity": qty,
                    "total": total,
                })
            elif detail.upper() in {"PLINTH", "PLINTHS"}:
                fabrication_details_list.append({
                    "type": "fabrication",
                    "concept": "PLINTH",
                    "detail": detail,
                    "quantity": qty,
                    "total": total,
                })
            elif detail.upper() == "FRONT":
                fabrication_details_list.append({
                    "type": "fabrication",
                    "concept": "FRONT",
                    "detail": detail,
                    "quantity": qty,
                    "total": total,
                })
            elif detail.upper() == "FINISHING":
                fabrication_details_list.append({
                    "type": "fabrication",
                    "concept": "OTHER",
                    "detail": detail,
                    "quantity": qty,
                    "total": total,
                })
            else:
                material_lines.append({
                    "type": "material",
                    "description": detail,
                    "quantity": qty,
                    "total": total,
                })

            detail_lines.append(f"- {detail} x{qty}: ${total:.2f}")

        fabrication_details = "\n".join(detail_lines) if detail_lines else items_json
        budgeted_details = json.dumps({
            "fabrications": fabrication_details_list,
            "materials": material_lines,
        })

        wo_data = {
            "client_id": 1,
            "status": "MEASUREMENT",
            "origin": "Online",
            "materials_data": items_json,
            "fabrication_details": fabrication_details,
            "budgeted_details": budgeted_details,
            "pools_data": json.dumps(pools) if pools else None,
            "currency": "ARS",
            "usd_rate": online_budget.usd_rate or 1000.0,
            "subtotal": online_budget.total_net_ars or 0.0,
            "total": online_budget.total_consolidated or online_budget.total_net_ars or 0.0,
            "subtotal_usd": online_budget.total_net_usd or 0.0,
            "total_usd": online_budget.total_net_usd or 0.0,
            "pool_id": online_budget.pool_id,
            "pool_price": online_budget.pool_price or 0.0,
            "pool_currency": "ARS",
            "snapshot_name": online_budget.client_name or "",
            "date": None,
        }
        wo_svc = WorkOrderService(self.repo.db)
        work_order = wo_svc.create(wo_data)

        if online_budget.pool_id:
            pool = self.repo.db.query(PoolStock).filter(PoolStock.id == online_budget.pool_id).first()
            if pool and pool.quantity > 0:
                pool.quantity -= 1
                movement = StockMovement(
                    pool_id=pool.id,
                    type="exit",
                    quantity=1,
                    notes=f"Converted from online budget {online_budget.number}",
                )
                self.repo.db.add(movement)

        online_budget.status = "CONVERTED_TO_OT"
        self.repo.db.commit()
        self.repo.db.refresh(work_order)
        return work_order

    def update(self, budget_id: int, data: dict) -> Optional[OnlineBudget]:
        budget = self.repo.get_by_id(budget_id)
        if not budget:
            return None
        result = self.repo.update(budget, data)
        self.repo.db.commit()
        self.repo.db.refresh(result)
        return result

    def delete(self, budget_id: int) -> bool:
        budget = self.repo.get_by_id(budget_id)
        if not budget:
            return False
        self.repo.delete(budget)
        self.repo.db.commit()
        return True
