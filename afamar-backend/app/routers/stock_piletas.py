from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.schemas.stock_pileta import (
    StockPiletaCreate, StockPiletaUpdate, StockPileta as StockPiletaSchema,
    MovimientoPiletaCreate, MovimientoPileta as MovimientoPiletaSchema,
)
from app.services.stock_pileta_service import StockPiletaService
from app.services.exceptions import NotFoundError

router = APIRouter()


def _get_service(db: Session = Depends(get_db)):
    return StockPiletaService(db)


@router.get("", response_model=List[StockPiletaSchema])
def listar_piletas(
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    service: StockPiletaService = Depends(_get_service),
):
    return service.listar(search, skip, limit)


@router.get("/{pileta_id}", response_model=StockPiletaSchema)
def obtener_pileta(pileta_id: int, service: StockPiletaService = Depends(_get_service)):
    try:
        return service.obtener(pileta_id)
    except NotFoundError as e:
        raise HTTPException(404, str(e))


@router.post("", response_model=StockPiletaSchema, status_code=201)
def crear_pileta(data: StockPiletaCreate, service: StockPiletaService = Depends(_get_service)):
    return service.crear(data.model_dump())


@router.put("/{pileta_id}", response_model=StockPiletaSchema)
def actualizar_pileta(
    pileta_id: int, data: StockPiletaUpdate,
    service: StockPiletaService = Depends(_get_service),
):
    try:
        return service.actualizar(pileta_id, data.model_dump(exclude_unset=True))
    except NotFoundError as e:
        raise HTTPException(404, str(e))


@router.delete("/{pileta_id}", status_code=204)
def eliminar_pileta(pileta_id: int, service: StockPiletaService = Depends(_get_service)):
    try:
        service.eliminar(pileta_id)
    except NotFoundError as e:
        raise HTTPException(404, str(e))


@router.get("/{pileta_id}/movimientos", response_model=List[MovimientoPiletaSchema])
def listar_movimientos(pileta_id: int, service: StockPiletaService = Depends(_get_service)):
    return service.listar_movimientos(pileta_id)


@router.post("/{pileta_id}/movimientos", response_model=MovimientoPiletaSchema, status_code=201)
def crear_movimiento(
    pileta_id: int, data: MovimientoPiletaCreate,
    service: StockPiletaService = Depends(_get_service),
):
    try:
        return service.crear_movimiento(pileta_id, data.model_dump())
    except (NotFoundError, ValueError) as e:
        raise HTTPException(404, str(e))
