from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import date
from app.database import get_db
from app.schemas.caja import MovimientoCajaCreate, SaldoAnteriorUpdate, CerrarCajaRequest
from app.services.caja_service import CajaService
from app.services.exceptions import NotFoundError

router = APIRouter()


def _get_service(db: Session = Depends(get_db)):
    return CajaService(db)


@router.get("/diaria")
def obtener_caja_diaria(
    fecha: date = Query(...),
    service: CajaService = Depends(_get_service),
):
    return service.obtener_o_crear(fecha)


@router.post("/movimientos", status_code=201)
def crear_movimiento(
    data: MovimientoCajaCreate,
    service: CajaService = Depends(_get_service),
):
    try:
        return service.crear_movimiento(data.model_dump())
    except Exception as e:
        raise HTTPException(400, str(e))


@router.delete("/movimientos/{movimiento_id}")
def eliminar_movimiento(
    movimiento_id: int,
    service: CajaService = Depends(_get_service),
):
    try:
        return service.eliminar_movimiento(movimiento_id)
    except NotFoundError as e:
        raise HTTPException(404, str(e))


@router.put("/saldo-anterior")
def actualizar_saldo_anterior(
    data: SaldoAnteriorUpdate,
    service: CajaService = Depends(_get_service),
):
    try:
        return service.actualizar_saldo_anterior(data.fecha, data.saldo_anterior)
    except NotFoundError as e:
        raise HTTPException(404, str(e))


@router.post("/diaria/cerrar")
def cerrar_caja(
    data: CerrarCajaRequest,
    service: CajaService = Depends(_get_service),
):
    try:
        return service.cerrar_caja(data.fecha, data.observaciones)
    except Exception as e:
        raise HTTPException(400, str(e))


@router.get("/historial")
def obtener_historial(
    service: CajaService = Depends(_get_service),
):
    return service.obtener_historial()
