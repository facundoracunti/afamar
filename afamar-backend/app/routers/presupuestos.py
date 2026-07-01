from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.schemas.presupuesto import (
    PresupuestoCreate, PresupuestoUpdate, Presupuesto as PresupuestoSchema,
)
from app.services.presupuesto_service import PresupuestoService
from app.services.exceptions import NotFoundError, ConflictError, ValidationError
from app.utils.numeracion import generar_numero_presupuesto

router = APIRouter()


def _get_service(db: Session = Depends(get_db)):
    return PresupuestoService(db)


@router.get("", response_model=List[PresupuestoSchema])
def listar_presupuestos(
    search: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    material: Optional[str] = Query(None),
    fecha_desde: Optional[str] = Query(None),
    fecha_hasta: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    service: PresupuestoService = Depends(_get_service),
):
    return service.listar(search, estado, material, fecha_desde, fecha_hasta, skip, limit)


@router.get("/unificados")
def listar_unificados(
    search: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    service: PresupuestoService = Depends(_get_service),
):
    return service.listar_unificados(search, estado)


@router.get("/next-numero")
def next_numero(db: Session = Depends(get_db)):
    return {"numero": generar_numero_presupuesto(db)}


@router.get("/{presupuesto_id}", response_model=PresupuestoSchema)
def obtener_presupuesto(
    presupuesto_id: int,
    service: PresupuestoService = Depends(_get_service),
):
    try:
        return service.obtener(presupuesto_id)
    except NotFoundError as e:
        raise HTTPException(404, str(e))


@router.post("", response_model=PresupuestoSchema, status_code=201)
def crear_presupuesto(
    data: PresupuestoCreate,
    service: PresupuestoService = Depends(_get_service),
):
    try:
        return service.crear(data.model_dump())
    except ConflictError as e:
        raise HTTPException(400, str(e))


@router.put("/{presupuesto_id}", response_model=PresupuestoSchema)
def actualizar_presupuesto(
    presupuesto_id: int,
    data: PresupuestoUpdate,
    service: PresupuestoService = Depends(_get_service),
):
    try:
        return service.actualizar(presupuesto_id, data.model_dump(exclude_unset=True))
    except NotFoundError as e:
        raise HTTPException(404, str(e))
    except ConflictError as e:
        raise HTTPException(400, str(e))


@router.delete("/{presupuesto_id}", status_code=204)
def eliminar_presupuesto(
    presupuesto_id: int,
    service: PresupuestoService = Depends(_get_service),
):
    try:
        service.eliminar(presupuesto_id)
    except NotFoundError as e:
        raise HTTPException(404, str(e))


@router.get("/{presupuesto_id}/pdf")
def descargar_pdf_presupuesto(
    presupuesto_id: int,
    service: PresupuestoService = Depends(_get_service),
):
    try:
        buffer = service.generar_pdf(presupuesto_id)
        p = service.obtener(presupuesto_id)
        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=presupuesto_{p.numero}.pdf"
            },
        )
    except NotFoundError as e:
        raise HTTPException(404, str(e))


@router.post("/{presupuesto_id}/alternativas/{idx}/convertir-a-orden", status_code=201)
def convertir_alternativa(
    presupuesto_id: int,
    idx: int,
    service: PresupuestoService = Depends(_get_service),
):
    try:
        return service.convertir_alternativa_a_orden(presupuesto_id, idx)
    except NotFoundError as e:
        raise HTTPException(404, str(e))
    except (ConflictError, ValidationError) as e:
        raise HTTPException(400, str(e))


@router.post("/{presupuesto_id}/convertir-orden")
def convertir_a_orden(
    presupuesto_id: int,
    service: PresupuestoService = Depends(_get_service),
):
    try:
        return service.convertir_a_orden(presupuesto_id)
    except NotFoundError as e:
        raise HTTPException(404, str(e))
    except ConflictError as e:
        raise HTTPException(400, str(e))


@router.post("/{presupuesto_id}/enviar-whatsapp")
def enviar_whatsapp_presupuesto(
    presupuesto_id: int,
    service: PresupuestoService = Depends(_get_service),
):
    try:
        return service.enviar_whatsapp(presupuesto_id)
    except (NotFoundError, ConflictError) as e:
        raise HTTPException(400, str(e))


@router.post("/{presupuesto_id}/enviar-email")
def enviar_email_presupuesto(
    presupuesto_id: int,
    service: PresupuestoService = Depends(_get_service),
):
    try:
        return service.enviar_email(presupuesto_id)
    except (NotFoundError, ConflictError) as e:
        raise HTTPException(400, str(e))
