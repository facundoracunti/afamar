from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.core.exceptions import NotFoundError
from app.utils.responses import PaginationInfo, created, success
from app.schemas.pool_stock import PoolStockCreate, PoolStockResponse, PoolStockUpdate, StockMovementCreate
from app.services.pool_stock import PoolStockService
from app.utils.pagination import paginate

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("")
def list_pool_stock(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    service = PoolStockService(db)
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
    from app.models.pool_stock import StockMovement
    movements = db.query(StockMovement).filter(StockMovement.pool_id == pool_id).order_by(StockMovement.created_at.desc()).offset(skip).limit(limit).all()
    total = db.query(StockMovement).filter(StockMovement.pool_id == pool_id).count()
    return success(movements, PaginationInfo(total=total, skip=skip, limit=limit))
