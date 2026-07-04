from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.core.exceptions import NotFoundError
from app.utils.responses import created, success
from app.models.pool_stock import PoolType
from app.models.reference import BudgetStatus, WorkOrderStatus, PaymentMethod, PriorityLevel, FinishType
from app.schemas.reference import ReferenceCreate, ReferenceUpdate

router = APIRouter()
auth_router = APIRouter(dependencies=[Depends(get_current_user)])

MODEL_MAP = {
    "budget-statuses": BudgetStatus,
    "work-order-statuses": WorkOrderStatus,
    "payment-methods": PaymentMethod,
    "priority-levels": PriorityLevel,
    "finish-types": FinishType,
    "pool-types": PoolType,
}

LABEL_MAP = {
    "budget-statuses": "BudgetStatus",
    "work-order-statuses": "WorkOrderStatus",
    "payment-methods": "PaymentMethod",
    "priority-levels": "PriorityLevel",
    "finish-types": "FinishType",
    "pool-types": "PoolType",
}


def _get_model(resource: str):
    model = MODEL_MAP.get(resource)
    if not model:
        raise NotFoundError(f"Unknown resource: {resource}")
    return model


@router.get("/{resource}")
def list_references(resource: str, is_active: Optional[bool] = None, db: Session = Depends(get_db)):
    model = _get_model(resource)
    query = db.query(model)
    if is_active is not None:
        query = query.filter(model.is_active == is_active)
    items = query.order_by(model.sort_order).all()
    return success(items)


@router.get("/{resource}/{item_id}")
def get_reference(resource: str, item_id: int, db: Session = Depends(get_db)):
    model = _get_model(resource)
    item = db.query(model).filter(model.id == item_id).first()
    if not item:
        raise NotFoundError(LABEL_MAP[resource])
    return success(item)


@auth_router.post("/{resource}", status_code=201)
def create_reference(resource: str, data: ReferenceCreate, db: Session = Depends(get_db)):
    model = _get_model(resource)
    item = model(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return created(item)


@auth_router.put("/{resource}/{item_id}")
def update_reference(resource: str, item_id: int, data: ReferenceUpdate, db: Session = Depends(get_db)):
    model = _get_model(resource)
    item = db.query(model).filter(model.id == item_id).first()
    if not item:
        raise NotFoundError(LABEL_MAP[resource])
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return success(item)


@auth_router.delete("/{resource}/{item_id}", status_code=204)
def delete_reference(resource: str, item_id: int, db: Session = Depends(get_db)):
    model = _get_model(resource)
    item = db.query(model).filter(model.id == item_id).first()
    if not item:
        raise NotFoundError(LABEL_MAP[resource])
    db.delete(item)
    db.commit()
