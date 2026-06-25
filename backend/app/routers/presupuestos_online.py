from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.schemas.presupuesto_online import (
    PresupuestoOnlineCreate, PresupuestoOnlineUpdate,
    PresupuestoOnline as PresupuestoOnlineSchema,
)
from app.services.presupuesto_online_service import PresupuestoOnlineService
from app.services.exceptions import NotFoundError, ConflictError

router = APIRouter()


def _get_service(db: Session = Depends(get_db)):
    return PresupuestoOnlineService(db)


@router.get("", response_model=List[PresupuestoOnlineSchema])
def listar(service: PresupuestoOnlineService = Depends(_get_service)):
    return service.listar()


@router.get("/{id}", response_model=PresupuestoOnlineSchema)
def obtener(id: int, service: PresupuestoOnlineService = Depends(_get_service)):
    try:
        return service.obtener(id)
    except NotFoundError as e:
        raise HTTPException(404, str(e))


@router.post("", response_model=PresupuestoOnlineSchema, status_code=201)
def crear(data: PresupuestoOnlineCreate, service: PresupuestoOnlineService = Depends(_get_service)):
    return service.crear(data.model_dump())


@router.put("/{id}", response_model=PresupuestoOnlineSchema)
def actualizar(
    id: int, data: PresupuestoOnlineUpdate,
    service: PresupuestoOnlineService = Depends(_get_service),
):
    try:
        return service.actualizar(id, data.model_dump(exclude_unset=True))
    except NotFoundError as e:
        raise HTTPException(404, str(e))


@router.delete("/{id}", status_code=204)
def eliminar(id: int, service: PresupuestoOnlineService = Depends(_get_service)):
    try:
        service.eliminar(id)
    except NotFoundError as e:
        raise HTTPException(404, str(e))


@router.post("/{id}/convertir-orden")
def convertir_a_orden(
    id: int,
    opcion: Optional[int] = Query(None),
    service: PresupuestoOnlineService = Depends(_get_service),
):
    try:
        return service.convertir_a_orden(id, opcion=opcion)
    except NotFoundError as e:
        raise HTTPException(404, str(e))
