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


def _stash_sketch_into_budgeted_details(data: dict) -> None:
    """Move the frontend's `sketch_elements` array into `budgeted_details`.

    The frontend sends the sketch as `sketch_elements: [...]` (an array of
    pages with `dibujo`). The WorkOrder model has no `sketch_elements`
    column (the canonical sketch lives on the Budget) so this field would
    be dropped by the ORM. We serialise it into the existing
    `budgeted_details` TEXT column — the same field used when a
    WorkOrder is created from a Budget — and remove `sketch_elements`
    from the dict so the ORM doesn't reject the unknown key.

    Mutates `data` in place.
    """
    sketch = data.pop("sketch_elements", None)
    if sketch is None:
        return
    if isinstance(sketch, str):
        # Already JSON-encoded (rare; e.g. legacy / save round-trips).
        data["budgeted_details"] = sketch or None
        return
    if not sketch:
        return
    try:
        data["budgeted_details"] = json.dumps(sketch, ensure_ascii=False)
    except (TypeError, ValueError):
        data["budgeted_details"] = None


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


def _recalculate_totals_from_items(data: dict) -> None:
    """Recompute subtotal/total/etc. from the raw line-item arrays so the PDF
    matches what the form is showing.

    The frontend's `useBudgetCalculations` hook computes these totals on the
    client, but a few code paths reach `WorkOrderService.create` without that
    hook ever running (legacy imports, third-party posts, or stale state).
    Recomputing server-side guarantees the DB always holds a value consistent
    with the items actually stored, and the PDF / list never show $0 for a row
    that has fabrications + materials + pools populated.

    NOTE: unlike `budget_calculator.calculate_material_totals`, this helper
    does NOT divide length × width by 10000 — the form's input units are
    already in meters, so we keep that semantic. `create_from_budget` still
    uses the original helper (different units, see its comment).
    """
    from app.services.budget_calculator import (
        compute_pool_totals,
        filter_main_materials,
        parse_materials_data,
    )

    usd_rate = float(data.get("usd_rate") or 1000.0)
    if usd_rate <= 0:
        usd_rate = 1000.0

    # Fabrication details (Traforo de pileta, Zócalos, Terminación, …).
    # We compute these inline (rather than reusing budget_calculator.compute_detail_totals)
    # because the new schema uses English keys (`price`/`currency`) — the
    # budget helper still expects Spanish keys (`precio`/`moneda`) and silently
    # returns 0 for English-only rows.
    fab_raw = data.get("fabrication_details")
    fab_items: list = []
    if fab_raw:
        import json as _json
        try:
            parsed = fab_raw if not isinstance(fab_raw, str) else _json.loads(fab_raw)
            if isinstance(parsed, list):
                fab_items = parsed
        except (_json.JSONDecodeError, TypeError):
            fab_items = []
    fab_ars = 0.0
    fab_usd = 0.0
    for d in fab_items:
        price = float(
            d.get("price") or d.get("precio", 0) or 0
        )
        qty = float(
            d.get("quantity") or d.get("cantidad", 1) or 1
        )
        currency = (
            (d.get("currency") or d.get("moneda") or "ARS").upper()
        )
        amount = price * qty
        if currency == "USD":
            fab_usd += amount
        else:
            fab_ars += amount

    # Materials (main items, exclude alternatives). Here we multiply length
    # × width × quantity × price_m2 *as-is* — values are already in metres.
    mats = parse_materials_data(data.get("materials_data"))
    main_mats = filter_main_materials(mats)
    mat_ars = 0.0
    mat_usd = 0.0
    for m in main_mats:
        length = float(m.get("length") or m.get("largo", 0) or 0)
        width = float(m.get("width") or m.get("ancho", 0) or 0)
        quantity = float(m.get("quantity") or m.get("cantidad", 1) or 1)
        area = length * width * quantity  # metres × metres × qty
        currency = m.get("currency") or m.get("moneda", "ARS")
        if currency == "USD":
            mat_usd += round(area * float(m.get("price_m2_usd") or m.get("precio_m2_usd", 0) or 0), 2)
        else:
            mat_ars += round(area * float(m.get("price_m2") or m.get("precio_m2", 0) or 0), 2)

    # Pools
    pools = parse_materials_data(data.get("pools_data")) or []
    pp_ars, pp_usd = compute_pool_totals(pools)

    # Aggregate both currencies, then convert cross-currency with the rate.
    # Mirror the frontend hook: items in the row's currency stay in that
    # currency, items in the other currency are converted via usd_rate.
    subtotal_ars = round(fab_ars + mat_ars + pp_ars + (fab_usd + mat_usd + pp_usd) * usd_rate)
    subtotal_usd = round((fab_usd + mat_usd + pp_usd + (fab_ars + mat_ars + pp_ars) / usd_rate) * 100) / 100 if usd_rate > 0 else 0.0

    transport = float(data.get("transport") or 0)
    transport_usd = float(data.get("transport_usd") or 0)

    total_base_ars = max(0.0, subtotal_ars + transport)
    total_base_usd = max(0.0, subtotal_usd + transport_usd)

    # Discount + surcharge (matches the frontend hook's logic).
    discount_pct = float(data.get("discount_percentage") or 0)
    discount_fijo = float(data.get("discount_fixed_amount") or 0)
    if discount_pct > 0:
        total_ars = round(total_base_ars * (1 - discount_pct / 100))
        total_usd = round(total_base_usd * (1 - discount_pct / 100) * 100) / 100
    elif discount_fijo > 0:
        total_ars = max(0.0, total_base_ars - discount_fijo)
        total_usd = max(0.0, round((total_base_usd - discount_fijo / usd_rate) * 100) / 100)
    else:
        total_ars = total_base_ars
        total_usd = total_base_usd

    # Surcharge for credit-card payment methods.
    payment_method = data.get("payment_method")
    installments = int(data.get("installments") or 1)
    surcharge_pct = 0
    if payment_method == "CREDIT_CARD":
        surcharge_pct = 0 if installments <= 2 else installments * 5
    if surcharge_pct > 0:
        total_ars = round(total_ars + total_ars * surcharge_pct / 100)
        total_usd = round((total_usd + total_usd * surcharge_pct / 100) * 100) / 100

    # Deposit + balance due. We preserve the deposit value sent in (or recompute
    # both currencies from it) but never let balance go negative.
    deposit = float(data.get("deposit_received") or 0)
    deposit_currency = (data.get("deposit_currency") or "ARS").upper()
    deposit_usd = float(data.get("deposit_usd") or 0)
    if deposit > 0 and deposit_usd == 0 and deposit_currency == "ARS" and usd_rate > 0:
        deposit_usd = round((deposit / usd_rate) * 100) / 100
    elif deposit > 0 and deposit_usd == 0 and deposit_currency == "USD":
        deposit_usd = round(deposit * 100) / 100

    balance_due = max(0.0, total_ars - deposit)
    balance_due_usd = max(0.0, round((total_usd - deposit_usd) * 100) / 100)

    # Persist everything so the PDF / list endpoint never see $0 again.
    data["subtotal"] = subtotal_ars
    data["subtotal_usd"] = subtotal_usd
    data["total"] = total_ars
    data["total_usd"] = total_usd
    data["balance_due"] = balance_due
    data["balance_due_usd"] = balance_due_usd
    if deposit > 0:
        data["deposit_received"] = deposit
    if deposit_usd > 0:
        data["deposit_usd"] = deposit_usd


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
        # client_* fields are not stored on the WorkOrder row — they're only
        # used to resolve client_id above. The response schema populates
        # them from the related Client via from_orm_with_client.
        data.pop("client_name", None)
        data.pop("client_phone", None)
        data.pop("client_email", None)
        data.pop("client_address", None)
        # The frontend sends the sketch as `sketch_elements` (an array of
        # pages). The WorkOrder model doesn't have a sketch_elements column
        # (the sketch lives on the Budget), so we serialise it into the
        # existing `budgeted_details` TEXT column — the same field used when
        # a WorkOrder is created from a Budget.
        _stash_sketch_into_budgeted_details(data)
        # Always recompute totals from the raw line items (fabrication details,
        # materials, pools) — never trust the totals the frontend sends. The
        # WorkOrder PDF + list rows both read `total`, `total_usd`, `subtotal`,
        # `subtotal_usd` directly from the DB, so a wrong value here means the
        # PDF shows $0 even though the line items are populated.
        _recalculate_totals_from_items(data)
        order = self.repo.create(data)
        self.repo.db.commit()
        self.repo.db.refresh(order)
        if not order.stock_deducted and (order.pool_id or order.pools_data):
            deduct_pool_stock(self.repo.db, order.pool_id, order.pools_data, order.number)
            order.stock_deducted = True
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
            client_name = ""
            if budget.client:
                client_name = budget.client.name or ""
            _create_cash_movement_on_deposit(
                self.repo.db, order.number,
                client_name,
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
        _stash_sketch_into_budgeted_details(data)
        # If the update carries line-item arrays (or totals) we recompute
        # totals server-side. This keeps `total` consistent with the rows
        # even when the client only sent partial data and patched in stale
        # `total` / `total_usd` values.
        if any(
            key in data
            for key in (
                "fabrication_details", "materials_data", "pools_data",
                "usd_rate", "transport", "transport_usd", "discount_percentage",
                "discount_fixed_amount", "payment_method", "installments",
                "deposit_received", "deposit_usd", "deposit_currency",
            )
        ):
            # Merge persisted values with the incoming patch so the helper
            # can recalculate from a complete picture.
            merged = {
                "usd_rate": order.usd_rate,
                "transport": order.transport,
                "transport_usd": order.transport_usd,
                "discount_percentage": order.discount_percentage,
                "discount_fixed_amount": order.discount_fixed_amount,
                "payment_method": order.payment_method,
                "installments": order.installments,
                "deposit_received": order.deposit_received,
                "deposit_usd": order.deposit_usd,
                "deposit_currency": order.deposit_currency,
                "fabrication_details": order.fabrication_details,
                "materials_data": order.materials_data,
                "pools_data": order.pools_data,
            }
            for key, value in data.items():
                if value is not None:
                    merged[key] = value
            _recalculate_totals_from_items(merged)
            # Mirror the recomputed totals into the outgoing payload so the
            # repo.update() call below writes them back.
            for key in (
                "subtotal", "subtotal_usd", "total", "total_usd",
                "balance_due", "balance_due_usd", "deposit_received", "deposit_usd",
            ):
                if key in merged:
                    data[key] = merged[key]
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
            client_name = ""
            if order.client:
                client_name = order.client.name or ""
            _create_cash_movement_on_deposit(
                self.repo.db, order.number,
                client_name,
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
