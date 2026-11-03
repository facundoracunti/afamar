"""Pool demand, partial allocation and explicit recovery for work orders."""

import json
from collections import OrderedDict

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, ValidationError
from app.models.client import Client
from app.models.daily_cash import CashMovement
from app.models.pool_stock import PoolStock, StockMovement
from app.models.work_order import WorkOrder
from app.models.work_order_pool_requirement import WorkOrderPoolRequirement


def _as_positive_quantity(value) -> int:
    if isinstance(value, bool):
        raise ValidationError("La cantidad de piletas debe ser un entero positivo")
    try:
        quantity = int(value)
    except (TypeError, ValueError):
        raise ValidationError("La cantidad de piletas debe ser un entero positivo")
    if quantity <= 0 or str(value).strip() != str(quantity):
        raise ValidationError("La cantidad de piletas debe ser un entero positivo")
    return quantity


def _parse_pools_data(raw) -> list[dict]:
    if not raw:
        return []
    try:
        value = json.loads(raw) if isinstance(raw, str) else raw
    except (json.JSONDecodeError, TypeError) as exc:
        raise ValidationError("Las piletas tienen un formato JSON inválido") from exc
    if not isinstance(value, list):
        raise ValidationError("Las piletas deben ser una lista")
    if any(not isinstance(item, dict) for item in value):
        raise ValidationError("Cada pileta debe ser un objeto válido")
    return value


def ensure_budget_stock_is_traceable(budget) -> None:
    """Refuse ambiguous legacy conversions before any OT/inventory mutation."""
    if budget.stock_deducted:
        raise ConflictError(
            "No se puede convertir este presupuesto: el stock ya figura consumido "
            "por el flujo legacy y no existe trazabilidad suficiente para crear "
            "requerimientos sin arriesgar una segunda deducción."
        )


def _pool_key(pool_id: int | None, entry: dict) -> str:
    if pool_id is not None:
        return f"id:{pool_id}"
    brand = str(entry.get("brand") or "").strip().lower()
    model = str(entry.get("model") or entry.get("name") or "").strip().lower()
    return f"catalog:{brand}|{model}"


def _snapshot(pool: PoolStock | None, entry: dict) -> str:
    data = dict(entry)
    if pool is not None:
        data.update(
            {
                "pool_id": pool.id,
                "brand": pool.brand,
                "model": pool.model,
                "material": pool.material,
            }
        )
    return json.dumps(data, ensure_ascii=False, sort_keys=True)


def register_initial_pool_requirements(db: Session, order: WorkOrder) -> bool:
    """Create requirements and allocate only what is physically available.

    This function deliberately does not commit. The caller commits the OT,
    requirement rows, stock changes and movements as one transaction.
    """
    requested: OrderedDict[str, dict] = OrderedDict()
    if order.pool_id:
        requested[_pool_key(order.pool_id, {"pool_id": order.pool_id})] = {
            "pool_id": order.pool_id,
            "quantity": 1,
            "entry": {"pool_id": order.pool_id, "quantity": 1},
            "from_primary": True,
        }
    for entry in _parse_pools_data(order.pools_data):
        raw_pool_id = entry.get("pool_id")
        if raw_pool_id is None:
            raw_pool_id = entry.get("id")
        if raw_pool_id is not None:
            try:
                pool_id = int(raw_pool_id)
            except (TypeError, ValueError) as exc:
                raise ValidationError("El pool_id de una pileta debe ser un entero") from exc
            if pool_id <= 0 or str(raw_pool_id).strip() != str(pool_id):
                raise ValidationError("El pool_id de una pileta debe ser un entero positivo")
        else:
            pool_id = None
            if not (
                str(entry.get("brand") or "").strip()
                and str(entry.get("model") or entry.get("name") or "").strip()
            ):
                raise ValidationError("Una pileta sin pool_id requiere marca y modelo")
        if "quantity" not in entry:
            quantity = 1
        else:
            quantity = _as_positive_quantity(entry["quantity"])
        key = _pool_key(pool_id, entry)
        if key in requested:
            # Legacy payloads may carry the same physical sink both in the
            # scalar `pool_id` and in `pools_data`. Treat that first list row
            # as the same unit; subsequent rows are additional demand.
            if requested[key].pop("from_primary", False):
                requested[key]["quantity"] = max(requested[key]["quantity"], quantity)
            else:
                requested[key]["quantity"] += quantity
        else:
            requested[key] = {
                "pool_id": pool_id,
                "quantity": quantity,
                "entry": entry,
                "from_primary": False,
            }

    if not requested:
        return False

    pool_ids = sorted({item["pool_id"] for item in requested.values() if item["pool_id"] is not None})
    locked_pools = {
        pool.id: pool
        for pool in db.query(PoolStock)
        .filter(PoolStock.id.in_(pool_ids))
        .with_for_update()
        .all()
    }

    requirements: list[WorkOrderPoolRequirement] = []
    for key, item in requested.items():
        pool = locked_pools.get(item["pool_id"])
        available = max(0, int(pool.quantity or 0)) if pool is not None else 0
        allocated = min(item["quantity"], available)
        requirement = WorkOrderPoolRequirement(
            work_order_id=order.id,
            work_order_number=order.number,
            pool_id=pool.id if pool is not None else None,
            pool_key=key,
            pool_snapshot=_snapshot(pool, item["entry"]),
            required_quantity=item["quantity"],
            allocated_quantity=allocated,
            recovered_quantity=0,
            unrecovered_quantity=0,
            status="FULFILLED" if allocated == item["quantity"] else "OPEN",
        )
        db.add(requirement)
        requirements.append(requirement)
        if pool is not None and allocated:
            pool.quantity -= allocated

    db.flush()
    for requirement in requirements:
        if requirement.allocated_quantity:
            db.add(
                StockMovement(
                    pool_id=requirement.pool_id,
                    requirement_id=requirement.id,
                    type="exit",
                    quantity=requirement.allocated_quantity,
                    notes=(
                        f"Salida por producción - {order.number} "
                        f"(requerimiento {requirement.id})"
                    ),
                )
            )
    return bool(requirements) and all(
        item.allocated_quantity == item.required_quantity for item in requirements
    )


def has_active_pool_requirements(db: Session, order_id: int) -> bool:
    return (
        db.query(WorkOrderPoolRequirement.id)
        .filter(
            WorkOrderPoolRequirement.work_order_id == order_id,
            WorkOrderPoolRequirement.status != "CANCELLED",
        )
        .first()
        is not None
    )


def list_pending_pool_requirements(db: Session) -> list[dict]:
    """Return open physical demand, enriched for the stock operator screen."""
    rows = (
        db.query(WorkOrderPoolRequirement, WorkOrder, Client, PoolStock)
        .join(WorkOrder, WorkOrder.id == WorkOrderPoolRequirement.work_order_id)
        .join(Client, Client.id == WorkOrder.client_id)
        .outerjoin(PoolStock, PoolStock.id == WorkOrderPoolRequirement.pool_id)
        .filter(
            WorkOrderPoolRequirement.status != "CANCELLED",
            WorkOrderPoolRequirement.required_quantity
            > WorkOrderPoolRequirement.allocated_quantity,
        )
        .order_by(WorkOrderPoolRequirement.id.asc())
        .all()
    )
    result = []
    for requirement, order, client, pool in rows:
        snapshot = {}
        if requirement.pool_snapshot:
            try:
                snapshot = json.loads(requirement.pool_snapshot)
            except (json.JSONDecodeError, TypeError):
                snapshot = {}
        result.append(
            {
                "requirement_id": requirement.id,
                "work_order_id": order.id,
                "work_order_number": order.number,
                "work_order_status": order.status,
                "client_id": client.id,
                "client_name": client.name,
                "pool_id": requirement.pool_id,
                "pool_brand": pool.brand if pool else str(snapshot.get("brand") or "—"),
                "pool_model": pool.model if pool else str(snapshot.get("model") or "—"),
                "required_quantity": requirement.required_quantity,
                "allocated_quantity": requirement.allocated_quantity,
                "pending_quantity": requirement.pending_quantity,
                "available_quantity": max(0, int(pool.quantity or 0)) if pool else 0,
            }
        )
    return result


def assign_pending_pool_requirement(
    db: Session,
    requirement_id: int,
    quantity: int,
) -> tuple[WorkOrderPoolRequirement, int, int]:
    """Assign only physically available stock in one transaction."""
    requirement = (
        db.query(WorkOrderPoolRequirement)
        .filter(WorkOrderPoolRequirement.id == requirement_id)
        .with_for_update()
        .first()
    )
    if requirement is None:
        raise ValidationError("El requerimiento de pileta no existe")
    if requirement.status == "CANCELLED":
        raise ConflictError("No se puede asignar una pileta de una OT cancelada")
    if requirement.pool_id is None:
        raise ValidationError("El requerimiento no tiene una pileta de stock identificada")
    pending = requirement.pending_quantity
    if quantity > pending:
        raise ValidationError("La cantidad supera la cantidad pendiente")

    pool = (
        db.query(PoolStock)
        .filter(PoolStock.id == requirement.pool_id)
        .with_for_update()
        .first()
    )
    if pool is None:
        raise ValidationError("La pileta de stock no existe")
    available = max(0, int(pool.quantity or 0))
    assigned = min(quantity, available)
    if assigned <= 0:
        raise ConflictError("No hay stock disponible para asignar")

    pool.quantity -= assigned
    requirement.allocated_quantity += assigned
    requirement.status = (
        "FULFILLED"
        if requirement.allocated_quantity >= requirement.required_quantity
        else "OPEN"
    )
    db.add(
        StockMovement(
            pool_id=pool.id,
            requirement_id=requirement.id,
            type="exit",
            quantity=assigned,
            notes=(
                f"Salida por asignación manual - {requirement.work_order_number} "
                f"(requerimiento {requirement.id})"
            ),
        )
    )
    db.flush()
    db.commit()
    db.refresh(requirement)
    return requirement, assigned, max(0, available - assigned)


def cancel_work_order_with_recovery(
    db: Session,
    order_id: int,
    recoveries: list[dict],
    payments_confirmed: bool = False,
) -> WorkOrder:
    """Cancel a requirement-backed OT after explicit per-model recovery."""
    order = (
        db.query(WorkOrder)
        .filter(WorkOrder.id == order_id)
        .with_for_update()
        .first()
    )
    if order is None:
        raise ValidationError("La orden de trabajo no existe")
    if order.status == "CANCELLED":
        raise ConflictError("La orden de trabajo ya está cancelada")

    has_payments = (
        db.query(CashMovement.id)
        .filter(
            CashMovement.order_id == order.id,
            CashMovement.type == "INCOME",
        )
        .first()
        is not None
    )
    if has_payments and not payments_confirmed:
        raise ConflictError(
            "La orden tiene pagos registrados. Confirme que los pagos y "
            "movimientos de caja permanecerán intactos"
        )

    requirements = (
        db.query(WorkOrderPoolRequirement)
        .filter(WorkOrderPoolRequirement.work_order_id == order.id)
        .with_for_update()
        .all()
    )
    if not requirements:
        raise ValidationError("La orden no tiene requerimientos de piletas trazables")

    if len({item["requirement_id"] for item in recoveries}) != len(recoveries):
        raise ValidationError("La recuperación no puede repetir un requerimiento")
    recovery_map = {
        int(item["requirement_id"]): int(item["recovered_quantity"])
        for item in recoveries
    }
    requirement_ids = {item.id for item in requirements}
    if set(recovery_map) - requirement_ids:
        raise ValidationError("La recuperación contiene un requerimiento desconocido")
    assigned_ids = {item.id for item in requirements if item.allocated_quantity > 0}
    if set(recovery_map) != assigned_ids:
        raise ValidationError("Debe informar recuperación, incluso 0, para cada pileta asignada")

    pools = {
        pool.id: pool
        for pool in db.query(PoolStock)
        .filter(PoolStock.id.in_({item.pool_id for item in requirements if item.pool_id}))
        .with_for_update()
        .all()
    }
    for requirement in requirements:
        recovered = recovery_map.get(requirement.id, 0)
        if recovered < 0 or recovered > requirement.allocated_quantity:
            raise ValidationError("La cantidad recuperada no puede superar la asignada")
        if recovered and requirement.pool_id not in pools:
            raise ValidationError("No se encontró el stock de una pileta a recuperar")
        if recovered:
            pools[requirement.pool_id].quantity += recovered
            db.add(
                StockMovement(
                    pool_id=requirement.pool_id,
                    requirement_id=requirement.id,
                    type="entry",
                    quantity=recovered,
                    notes=(
                        f"Entrada por cancelación - {order.number} "
                        f"(requerimiento {requirement.id})"
                    ),
                )
            )
        requirement.recovered_quantity = recovered
        requirement.unrecovered_quantity = requirement.allocated_quantity - recovered
        requirement.status = "CANCELLED"

    order.status = "CANCELLED"
    order.stock_deducted = False
    db.commit()
    db.refresh(order)
    return order
