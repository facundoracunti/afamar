"""HTTP routes for the `payment_methods` catalogue.

Dedicated router (vs. the generic `/references/{resource}` router)
because this catalogue has richer fields than the other 4 reference
tables, and the form needs an `active_only` filter for the
"Forma de pago" dropdown that the generic router doesn't expose.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.core.exceptions import NotFoundError, ValidationError
from app.schemas.payment_method import (
    PaymentMethodCreate,
    PaymentMethodResponse,
)
from app.services.payment_method import PaymentMethodService


router = APIRouter(
    prefix="/payment-methods",
    tags=["Payment Methods"],
    dependencies=[Depends(get_current_user)],
)


@router.get("")
def list_payment_methods(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    active_only: bool = Query(False, description="When true, return only `is_active=true` rows (for the form dropdown)."),
    db: Session = Depends(get_db),
):
    service = PaymentMethodService(db)
    items = service.list_active() if active_only else service.get_all(skip, limit)
    payload = [PaymentMethodResponse.model_validate(pm).model_dump(mode="json") for pm in items]
    return {"success": True, "data": payload}


@router.get("/{payment_method_id}")
def get_payment_method(payment_method_id: int, db: Session = Depends(get_db)):
    service = PaymentMethodService(db)
    pm = service.get_by_id(payment_method_id)
    if not pm:
        raise NotFoundError("PaymentMethod")
    return {"success": True, "data": PaymentMethodResponse.model_validate(pm).model_dump(mode="json")}


@router.post("", status_code=201)
def create_payment_method(data: PaymentMethodCreate, db: Session = Depends(get_db)):
    service = PaymentMethodService(db)
    pm = service.create(data.model_dump())
    return {"success": True, "data": PaymentMethodResponse.model_validate(pm).model_dump(mode="json")}


@router.put("/{payment_method_id}")
def update_payment_method(
    payment_method_id: int,
    data: PaymentMethodCreate,
    db: Session = Depends(get_db),
):
    service = PaymentMethodService(db)
    pm = service.update(payment_method_id, data.model_dump())
    if not pm:
        raise NotFoundError("PaymentMethod")
    return {"success": True, "data": PaymentMethodResponse.model_validate(pm).model_dump(mode="json")}


@router.delete("/{payment_method_id}", status_code=204)
def delete_payment_method(payment_method_id: int, db: Session = Depends(get_db)):
    service = PaymentMethodService(db)
    if not service.delete(payment_method_id):
        raise NotFoundError("PaymentMethod")
    return None
