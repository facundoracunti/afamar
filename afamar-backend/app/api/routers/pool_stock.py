from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.core.exceptions import NotFoundError
from app.utils.responses import PaginationInfo, created, success
from app.schemas.pool_stock import PoolStockCreate, PoolStockUpdate, StockMovementCreate
from app.services.pool_stock import PoolStockService
from app.utils.pagination import paginate

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("")
def list_pool_stock(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    service = PoolStockService(db)
    page = service.get_all_paginated(skip, limit)
    return success(page.items, page.pagination)


@router.get("/search")
def search_pool_stock(q: str, db: Session = Depends(get_db)):
    service = PoolStockService(db)
    return success(service.search(q))


@router.get("/{pool_id}")
def get_pool_stock(pool_id: int, db: Session = Depends(get_db)):
    service = PoolStockService(db)
    pool = service.get_by_id(pool_id)
    if not pool:
        raise NotFoundError("Pool stock")
    return success(pool)


@router.post("", status_code=201)
def create_pool_stock(data: PoolStockCreate, db: Session = Depends(get_db)):
    service = PoolStockService(db)
    return created(service.create(data.model_dump()))


@router.put("/{pool_id}")
def update_pool_stock(pool_id: int, data: PoolStockUpdate, db: Session = Depends(get_db)):
    service = PoolStockService(db)
    pool = service.update(pool_id, data.model_dump(exclude_unset=True))
    if not pool:
        raise NotFoundError("Pool stock")
    return success(pool)


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
