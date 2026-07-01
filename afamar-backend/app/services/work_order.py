import json
from datetime import date
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.pool_stock import PoolStock, StockMovement
from app.models.work_order import WorkOrder
from app.repositories.work_order import WorkOrderRepository
from app.services.daily_cash import DailyCashService
from app.utils.numbering import generate_work_order_number


def deduct_pool_stock(db: Session, pool_id: int | None, pools_data: str | None, source_number: str):
    pools_deducted = set()
    if pool_id and pool_id not in pools_deducted:
        pool = db.query(PoolStock).filter(PoolStock.id == pool_id).first()
        if pool and pool.quantity > 0:
            pool.quantity -= 1
            movement = StockMovement(
                pool_id=pool.id,
                type="exit",
                quantity=1,
                notes=f"Salida por producción - {source_number}",
            )
            db.add(movement)
        pools_deducted.add(pool_id)

    if pools_data:
        try:
            pools_list = json.loads(pools_data) if isinstance(pools_data, str) else pools_data
            for entry in pools_list if isinstance(pools_list, list) else []:
                pid = entry.get("pool_id") or entry.get("id")
                qty = entry.get("quantity", 1)
                if pid and pid not in pools_deducted:
                    pool = db.query(PoolStock).filter(PoolStock.id == pid).first()
                    if pool and pool.quantity > 0:
                        pool.quantity -= qty
                        movement = StockMovement(
                            pool_id=pool.id,
                            type="exit",
                            quantity=qty,
                            notes=f"Salida por producción - {source_number}",
                        )
                        db.add(movement)
                    pools_deducted.add(pid)
        except (json.JSONDecodeError, TypeError):
            pass


def restore_pool_stock(db: Session, pool_id: int | None, pools_data: str | None, source_number: str):
    pools_restored = set()
    if pool_id and pool_id not in pools_restored:
        pool = db.query(PoolStock).filter(PoolStock.id == pool_id).first()
        if pool:
            pool.quantity = (pool.quantity or 0) + 1
            movement = StockMovement(
                pool_id=pool.id,
                type="entry",
                quantity=1,
                notes=f"Entrada por cancelación - {source_number}",
            )
            db.add(movement)
        pools_restored.add(pool_id)

    if pools_data:
        try:
            pools_list = json.loads(pools_data) if isinstance(pools_data, str) else pools_data
            for entry in pools_list if isinstance(pools_list, list) else []:
                pid = entry.get("pool_id") or entry.get("id")
                qty = entry.get("quantity", 1)
                if pid and pid not in pools_restored:
                    pool = db.query(PoolStock).filter(PoolStock.id == pid).first()
                    if pool:
                        pool.quantity = (pool.quantity or 0) + qty
                        movement = StockMovement(
                            pool_id=pool.id,
                            type="entry",
                            quantity=qty,
                            notes=f"Entrada por cancelación - {source_number}",
                        )
                        db.add(movement)
                    pools_restored.add(pid)
        except (json.JSONDecodeError, TypeError):
            pass


def _create_cash_movement_on_deposit(
    db: Session,
    order_number: str,
    client_name: str,
    deposit: float,
    deposit_currency: str | None,
    payment_method: str | None,
):
    if not deposit or deposit <= 0:
        return
    cash_service = DailyCashService(db)
    today = date.today()
    movement_data = {
        "date": today,
        "type": "INCOME",
        "amount": deposit,
        "description": f"Seña {order_number} - {client_name}",
        "payment_method": payment_method or "TRANSFER",
        "order_number": order_number,
        "order_total": deposit,
        "client_name": client_name,
    }
    cash_service.create_movement(movement_data)


def _update_client_total_purchased(db: Session, client_id: int):
    from sqlalchemy import func
    total = (
        db.query(func.coalesce(func.sum(WorkOrder.total), 0))
        .filter(WorkOrder.client_id == client_id, WorkOrder.status == "FINISHED")
        .scalar()
    )
    db.query(Client).filter(Client.id == client_id).update({"total_purchased": total})
    db.flush()


class WorkOrderService:
    def __init__(self, db: Session):
        self.repo = WorkOrderRepository(db)

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

    def create(self, data: dict) -> WorkOrder:
        last_number = self.repo.get_last_number()
        data["number"] = generate_work_order_number(last_number)
        client_id = data.get("client_id")
        if not client_id:
            client_name = data.get("client_name")
            if client_name:
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
        order = self.repo.create(data)
        self.repo.db.commit()
        self.repo.db.refresh(order)
        return order

    def create_from_budget(self, budget) -> WorkOrder:
        if budget.status == "CONVERTED_TO_OT":
            raise ValueError("Budget already converted to a work order")
        if budget.status != "APPROVED":
            raise ValueError("Budget must be approved to convert")

        from app.services.budget_calculator import (
            apply_surcharge,
            calculate_material_totals,
            compute_surcharge,
            filter_main_materials,
            parse_materials_data,
        )

        materials_raw = parse_materials_data(budget.materials_data)
        main_materials = filter_main_materials(materials_raw)
        mat_totals = calculate_material_totals(main_materials, budget.usd_rate or 1000.0)

        subtotal_ars = mat_totals["ars"] + float(budget.subtotal_materials or 0)
        subtotal_usd = mat_totals["usd"] + float(budget.subtotal_materials or 0) / (budget.usd_rate or 1000.0) if budget.usd_rate else 0

        surcharge_info = compute_surcharge(budget.payment_method, budget.installments or 1)
        surcharge_result = apply_surcharge(subtotal_ars, subtotal_usd, surcharge_info["percentage"])

        if main_materials:
            material_nombre = main_materials[0].get("nombre") or main_materials[0].get("name") or budget.material or ""
            material_precio_m2 = main_materials[0].get("price_m2") or main_materials[0].get("precio_m2", 0) or 0
        else:
            material_nombre = budget.material or ""
            material_precio_m2 = budget.material_price_m2 or 0

        last_number = self.repo.get_last_number()

        materials_dict = {"materials": materials_raw}
        if budget.items:
            materials_dict["items"] = [
                {
                    "sector": item.sector,
                    "description": item.description,
                    "unit_length": item.unit_length,
                    "unit_width": item.unit_width,
                    "length": item.length,
                    "width": item.width,
                    "m2": item.m2,
                    "quantity": item.quantity,
                    "price_m2": item.price_m2,
                    "unit_price": item.unit_price,
                    "total": item.total,
                }
                for item in budget.items
            ]

        adicionales_list = []
        if budget.adicionales:
            adicionales_list = [
                {
                    "concept": ad.concept,
                    "detail": ad.detail,
                    "quantity": ad.quantity,
                    "unit_price": ad.unit_price,
                    "total": ad.total,
                }
                for ad in budget.adicionales
            ]

        sketch_list = []
        if budget.sketch_elements:
            sketch_list = [
                {
                    "type": el.type,
                    "data": el.data,
                    "order": el.order,
                }
                for el in budget.sketch_elements
            ]

        data = {
            "number": generate_work_order_number(last_number),
            "client_id": budget.client_id,
            "budget_id": budget.id,
            "status": "MEASUREMENT",
            "origin": "Budget",
            "material": material_nombre,
            "material_price_m2": material_precio_m2,
            "materials_data": json.dumps(materials_dict),
            "adicionales_data": json.dumps(adicionales_list) if adicionales_list else None,
            "budgeted_details": json.dumps(sketch_list) if sketch_list else None,
            "color": budget.color,
            "thickness": budget.thickness,
            "finish": budget.finish,
            "bacha": budget.bacha,
            "anafe": budget.anafe,
            "currency": budget.currency,
            "usd_rate": budget.usd_rate or 1000.0,
            "subtotal": round(subtotal_ars),
            "transport": budget.transport or 0,
            "installation": budget.installation or 0,
            "discount": budget.discount or 0,
            "discount_percentage": budget.discount_percentage or 0,
            "discount_fixed_amount": budget.discount_fixed_amount or 0,
            "total": surcharge_result["total_with_surcharge_ars"],
            "subtotal_usd": round(subtotal_usd, 2),
            "transport_usd": budget.transport_usd or 0,
            "total_usd": surcharge_result["total_with_surcharge_usd"],
            "deposit_received": budget.deposit_received or 0,
            "deposit_currency": budget.deposit_currency or "ARS",
            "deposit_usd": budget.deposit_usd or 0,
            "balance_due": surcharge_result["total_with_surcharge_ars"] - (budget.deposit_received or 0),
            "balance_due_usd": round(surcharge_result["total_with_surcharge_usd"] - (budget.deposit_usd or 0), 2),
            "balance_paid": budget.balance_paid or False,
            "payment_method": budget.payment_method,
            "installments": budget.installments or 1,
            "priority": budget.priority or "NORMAL",
            "delivery_date": budget.delivery_date,
            "notes": budget.notes,
            "fabrication_details": budget.fabrication_details,
            "pool_id": budget.pool_id,
            "pool_price": budget.pool_price or 0,
            "pool_currency": budget.pool_currency or "ARS",
            "pool_image": budget.pool_image,
            "pools_data": budget.pools_data,
            "design_observations": budget.design_observations or "",
            "important_observations": budget.important_observations or "",
            "snapshot_name": budget.snapshot_name,
            "snapshot_phone": budget.snapshot_phone,
            "snapshot_email": budget.snapshot_email,
            "snapshot_address": budget.snapshot_address,
            "date": budget.date,
        }
        budget.status = "CONVERTED_TO_OT"
        order = self.repo.create(data)

        if not budget.stock_deducted:
            deduct_pool_stock(self.repo.db, budget.pool_id, budget.pools_data, order.number)
            budget.stock_deducted = True
        if budget.client_id:
            _update_client_total_purchased(self.repo.db, budget.client_id)
        if budget.deposit_received:
            _create_cash_movement_on_deposit(
                self.repo.db, order.number,
                order.snapshot_name or budget.snapshot_name or "",
                budget.deposit_received,
                budget.deposit_currency,
                budget.payment_method,
            )
        self.repo.db.commit()
        self.repo.db.refresh(order)
        return order

    VALID_TRANSITIONS = {
        "MEASUREMENT": {"WORKSHOP"},
        "WORKSHOP": {"FINISHED"},
        "FINISHED": {"DELIVERED"},
    }

    def update(self, order_id: int, data: dict) -> Optional[WorkOrder]:
        order = self.repo.get_by_id(order_id)
        if not order:
            return None
        old_status = order.status
        new_status = data.get("status", old_status)

        if new_status != old_status:
            if new_status != "CANCELLED" and new_status not in self.VALID_TRANSITIONS.get(old_status, set()):
                raise ValueError(f"Invalid status transition from {old_status} to {new_status}")
            if new_status == "CANCELLED" and order.stock_deducted:
                restore_pool_stock(self.repo.db, order.pool_id, order.pools_data, order.number)
                order.stock_deducted = False
            if new_status == "FINISHED" and order.client_id:
                _update_client_total_purchased(self.repo.db, order.client_id)

        result = self.repo.update(order, data)

        new_deposit = data.get("deposit_received")
        if new_deposit and new_deposit > (order.deposit_received or 0):
            additional = new_deposit - (order.deposit_received or 0)
            _create_cash_movement_on_deposit(
                self.repo.db, order.number,
                order.snapshot_name or "",
                additional,
                data.get("deposit_currency") or order.deposit_currency,
                data.get("payment_method") or order.payment_method,
            )

        self.repo.db.commit()
        self.repo.db.refresh(result)
        return result

    def delete(self, order_id: int) -> bool:
        order = self.repo.get_by_id(order_id)
        if not order:
            return False
        if order.stock_deducted:
            restore_pool_stock(self.repo.db, order.pool_id, order.pools_data, order.number)
        self.repo.delete(order)
        self.repo.db.commit()
        return True
