from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.schemas.medicion import MedicionCreate, MedicionUpdate, Medicion as MedicionSchema
from app.services.medicion_service import MedicionService
from app.services.exceptions import NotFoundError

router = APIRouter()


def _get_service(db: Session = Depends(get_db)):
    return MedicionService(db)


@router.get("", response_model=List[MedicionSchema])
def listar_mediciones(
    search: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    service: MedicionService = Depends(_get_service),
):
    return service.listar(search, estado, skip, limit)


@router.get("/{medicion_id}", response_model=MedicionSchema)
def obtener_medicion(medicion_id: int, service: MedicionService = Depends(_get_service)):
    try:
        return service.obtener(medicion_id)
    except NotFoundError as e:
        raise HTTPException(404, str(e))


@router.post("", response_model=MedicionSchema, status_code=201)
def crear_medicion(data: MedicionCreate, service: MedicionService = Depends(_get_service)):
    return service.crear(data.model_dump())


@router.put("/{medicion_id}", response_model=MedicionSchema)
def actualizar_medicion(
    medicion_id: int, data: MedicionUpdate,
    service: MedicionService = Depends(_get_service),
):
    try:
        return service.actualizar(medicion_id, data.model_dump(exclude_unset=True))
    except NotFoundError as e:
        raise HTTPException(404, str(e))


@router.delete("/{medicion_id}", status_code=204)
def eliminar_medicion(medicion_id: int, service: MedicionService = Depends(_get_service)):
    try:
        service.eliminar(medicion_id)
    except NotFoundError as e:
        raise HTTPException(404, str(e))
