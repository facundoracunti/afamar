from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.core.exceptions import NotFoundError
from app.schemas.pool_stock import (
    PoolStockCreate,
    PoolStockResponse,
    PoolStockUpdate,
    StockMovementCreate,
)
from app.schemas.work_order_pool_requirement import (
    PendingPoolRequirementResponse,
    PoolRequirementAssignmentRequest,
    PoolRequirementAssignmentResponse,
    WorkOrderPoolRequirementResponse,
)
from app.services.pool_stock import PoolStockService
from app.services.work_order.pool_requirements import (
    assign_pending_pool_requirement,
    list_pending_pool_requirements,
)
from app.utils.responses import PaginationInfo, created, success

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("")
def list_pool_stock(
    skip: int = 0,
    limit: int = 100,
    search: str | None = None,
    db: Session = Depends(get_db),
):
    service = PoolStockService(db)
    if search:
        items = service.search(search)
        # Apply skip/limit on top of the unpaginated search result so the
        # pagination hooks in the frontend (which always pass skip/limit)
        # continue to work. Total is the full filtered row count.
        total = len(items)
        items = items[skip:skip + limit]
        payload = [PoolStockResponse.model_validate(p).model_dump(mode="json") for p in items]
        return success(payload, PaginationInfo(total=total, skip=skip, limit=limit))
    page = service.get_all_paginated(skip, limit)
    # Explicit `model_validate(...).model_dump()` so the
    # `_populate_currency_code` validator runs — otherwise the FK id
    # leaks and the wire format loses the `currency` string.
    payload = [PoolStockResponse.model_validate(p).model_dump(mode="json") for p in page.items]
    return success(payload, page.pagination)


@router.get("/search")
def search_pool_stock(q: str, db: Session = Depends(get_db)):
    service = PoolStockService(db)
    pools = service.search(q)
    payload = [PoolStockResponse.model_validate(p).model_dump(mode="json") for p in pools]
    return success(payload)


@router.get("/pending-requirements")
def list_pending_requirements(db: Session = Depends(get_db)):
    payload = [
        PendingPoolRequirementResponse.model_validate(item).model_dump(mode="json")
        for item in list_pending_pool_requirements(db)
    ]
    return success(payload)


@router.post("/pending-requirements/{requirement_id}/assign")
def assign_pending_requirement(
    requirement_id: int,
    data: PoolRequirementAssignmentRequest,
    db: Session = Depends(get_db),
):
    requirement, assigned, available = assign_pending_pool_requirement(
        db, requirement_id, data.quantity
    )
    return success(
        PoolRequirementAssignmentResponse(
            requirement=WorkOrderPoolRequirementResponse.model_validate(requirement),
            assigned_quantity=assigned,
            available_quantity=available,
        ).model_dump(mode="json")
    )


@router.get("/{pool_id}")
def get_pool_stock(pool_id: int, db: Session = Depends(get_db)):
    service = PoolStockService(db)
    pool = service.get_by_id(pool_id)
    if not pool:
        raise NotFoundError("Pool stock")
    return success(PoolStockResponse.model_validate(pool).model_dump(mode="json"))


@router.post("", status_code=201)
def create_pool_stock(data: PoolStockCreate, db: Session = Depends(get_db)):
    service = PoolStockService(db)
    return created(PoolStockResponse.model_validate(service.create(data.model_dump())).model_dump(mode="json"))


@router.put("/{pool_id}")
def update_pool_stock(pool_id: int, data: PoolStockUpdate, db: Session = Depends(get_db)):
    service = PoolStockService(db)
    pool = service.update(pool_id, data.model_dump(exclude_unset=True))
    if not pool:
        raise NotFoundError("Pool stock")
    return success(PoolStockResponse.model_validate(pool).model_dump(mode="json"))


@router.delete("/{pool_id}", status_code=204)
def delete_pool_stock(pool_id: int, db: Session = Depends(get_db)):
    service = PoolStockService(db)
    if not service.delete(pool_id):
        raise NotFoundError("Pool stock")


@router.post("/{pool_id}/movements", status_code=201)
def add_movement(pool_id: int, data: StockMovementCreate, db: Session = Depends(get_db)):
    service = PoolStockService(db)
    return created(service.add_movement(pool_id, data.model_dump()))


@router.get("/{pool_id}/movements")
def list_pool_movements(pool_id: int, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    service = PoolStockService(db)
    items, pagination = service.list_movements(pool_id, skip, limit)
    return success(items, pagination)
