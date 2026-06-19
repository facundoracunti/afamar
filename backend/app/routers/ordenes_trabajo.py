from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.schemas.orden_trabajo import OrdenTrabajoCreate, OrdenTrabajoUpdate, OrdenTrabajo as OrdenTrabajoSchema
from app.services.orden_trabajo_service import OrdenTrabajoService
from app.services.exceptions import NotFoundError, ConflictError
from app.utils.numeracion import generar_numero_orden

router = APIRouter()


def _get_service(db: Session = Depends(get_db)):
    return OrdenTrabajoService(db)


@router.get("/", response_model=List[OrdenTrabajoSchema])
def listar_ordenes(
    search: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    service: OrdenTrabajoService = Depends(_get_service),
):
    return service.listar(search, estado, skip, limit)


@router.get("/next-numero")
def next_numero(db: Session = Depends(get_db)):
    return {"numero": generar_numero_orden(db)}


@router.get("/{orden_id}", response_model=OrdenTrabajoSchema)
def obtener_orden(
    orden_id: int,
    service: OrdenTrabajoService = Depends(_get_service),
):
    try:
        return service.obtener(orden_id)
    except NotFoundError as e:
        raise HTTPException(404, str(e))


@router.get("/{orden_id}/pdf")
def descargar_pdf_orden(
    orden_id: int,
    service: OrdenTrabajoService = Depends(_get_service),
):
    try:
        buffer = service.generar_pdf(orden_id)
        o = service.obtener(orden_id)
        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=orden_{o.numero}.pdf"
            },
        )
    except NotFoundError as e:
        raise HTTPException(404, str(e))


@router.post("/", response_model=OrdenTrabajoSchema, status_code=201)
def crear_orden(
    data: OrdenTrabajoCreate,
    service: OrdenTrabajoService = Depends(_get_service),
):
    try:
        return service.crear(data.model_dump())
    except ConflictError as e:
        raise HTTPException(400, str(e))


@router.put("/{orden_id}", response_model=OrdenTrabajoSchema)
def actualizar_orden(
    orden_id: int,
    data: OrdenTrabajoUpdate,
    service: OrdenTrabajoService = Depends(_get_service),
):
    try:
        return service.actualizar(orden_id, data.model_dump(exclude_unset=True))
    except NotFoundError as e:
        raise HTTPException(404, str(e))
    except ConflictError as e:
        raise HTTPException(400, str(e))


@router.delete("/{orden_id}", status_code=204)
def eliminar_orden(
    orden_id: int,
    service: OrdenTrabajoService = Depends(_get_service),
):
    try:
        service.eliminar(orden_id)
    except NotFoundError as e:
        raise HTTPException(404, str(e))
