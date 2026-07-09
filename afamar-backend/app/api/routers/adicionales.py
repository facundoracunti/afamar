from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.core.exceptions import NotFoundError
from app.utils.responses import success, created
from app.schemas.adicional import AdicionalCreate, AdicionalResponse, AdicionalUpdate
from app.services.adicional import AdicionalService


router = APIRouter(
    prefix="/adicionales",
    tags=["Adicionales"],
    dependencies=[Depends(get_current_user)],
)


@router.get("")
def list_adicionales(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    service = AdicionalService(db)
    items = service.get_all(skip=skip, limit=limit)
    # `model_validate(...).model_dump(...)` so the validador runs and
    # the wire format gets `currency: "ARS"` instead of the FK id.
    payload = [AdicionalResponse.model_validate(a).model_dump(mode="json") for a in items]
    return success(payload)


@router.get("/{adicional_id}")
def get_adicional(adicional_id: int, db: Session = Depends(get_db)):
    service = AdicionalService(db)
    adicional = service.get_by_id(adicional_id)
    if not adicional:
        raise NotFoundError("Adicional")
    return success(AdicionalResponse.model_validate(adicional).model_dump(mode="json"))


@router.post("", status_code=201)
def create_adicional(data: AdicionalCreate, db: Session = Depends(get_db)):
    service = AdicionalService(db)
    adicional = service.create(data.model_dump())
    return created(AdicionalResponse.model_validate(adicional).model_dump(mode="json"))


@router.put("/{adicional_id}")
def update_adicional(
    adicional_id: int,
    data: AdicionalUpdate,
    db: Session = Depends(get_db),
):
    service = AdicionalService(db)
    adicional = service.update(adicional_id, data.model_dump(exclude_unset=True))
    if not adicional:
        raise NotFoundError("Adicional")
    return success(AdicionalResponse.model_validate(adicional).model_dump(mode="json"))


@router.delete("/{adicional_id}", status_code=204)
def delete_adicional(adicional_id: int, db: Session = Depends(get_db)):
    service = AdicionalService(db)
    if not service.delete(adicional_id):
        raise NotFoundError("Adicional")
