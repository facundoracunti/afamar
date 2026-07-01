from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.schemas.trabajo_realizado import (
    TrabajoRealizadoCreate,
    TrabajoRealizadoUpdate,
    TrabajoRealizado as TrabajoRealizadoSchema,
)
from app.services.trabajo_realizado_service import TrabajoRealizadoService
from app.services.exceptions import NotFoundError, ValidationError

router = APIRouter()


def _get_service(db: Session = Depends(get_db)):
    return TrabajoRealizadoService(db)


@router.get("", response_model=List[TrabajoRealizadoSchema])
def listar_trabajos(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    service: TrabajoRealizadoService = Depends(_get_service),
):
    return service.listar(skip, limit)


@router.get("/{trabajo_id}", response_model=TrabajoRealizadoSchema)
def obtener_trabajo(
    trabajo_id: int,
    service: TrabajoRealizadoService = Depends(_get_service),
):
    try:
        return service.obtener(trabajo_id)
    except NotFoundError as e:
        raise HTTPException(404, str(e))


@router.post("", response_model=TrabajoRealizadoSchema, status_code=201)
def crear_trabajo(
    data: TrabajoRealizadoCreate,
    service: TrabajoRealizadoService = Depends(_get_service),
):
    return service.crear(data.model_dump())


@router.put("/{trabajo_id}", response_model=TrabajoRealizadoSchema)
def actualizar_trabajo(
    trabajo_id: int,
    data: TrabajoRealizadoUpdate,
    service: TrabajoRealizadoService = Depends(_get_service),
):
    try:
        return service.actualizar(trabajo_id, data.model_dump(exclude_unset=True))
    except NotFoundError as e:
        raise HTTPException(404, str(e))


@router.delete("/{trabajo_id}", status_code=204)
def eliminar_trabajo(
    trabajo_id: int,
    service: TrabajoRealizadoService = Depends(_get_service),
):
    try:
        service.eliminar(trabajo_id)
    except NotFoundError as e:
        raise HTTPException(404, str(e))


@router.post("/{trabajo_id}/upload-foto", response_model=TrabajoRealizadoSchema)
def upload_foto(
    trabajo_id: int,
    file: UploadFile = File(...),
    service: TrabajoRealizadoService = Depends(_get_service),
):
    try:
        service.upload_foto(trabajo_id, file)
        return service.obtener(trabajo_id)
    except NotFoundError as e:
        raise HTTPException(404, str(e))
    except ValidationError as e:
        raise HTTPException(400, str(e))
