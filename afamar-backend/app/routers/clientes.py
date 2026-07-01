from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.schemas.cliente import ClienteCreate, ClienteUpdate, Cliente as ClienteSchema, ClienteList
from app.services.cliente_service import ClienteService
from app.services.exceptions import NotFoundError, ConflictError

router = APIRouter()


def _get_service(db: Session = Depends(get_db)):
    return ClienteService(db)


@router.get("", response_model=List[ClienteList])
def listar_clientes(
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    service: ClienteService = Depends(_get_service),
):
    return service.listar(search, skip, limit)


@router.get("/{cliente_id}")
def obtener_cliente(cliente_id: int, service: ClienteService = Depends(_get_service)):
    try:
        return service.obtener(cliente_id)
    except NotFoundError as e:
        raise HTTPException(404, str(e))


@router.post("", response_model=ClienteSchema, status_code=201)
def crear_cliente(data: ClienteCreate, service: ClienteService = Depends(_get_service)):
    try:
        result = service.crear(
            nombre=data.nombre,
            telefono=data.telefono,
            email=data.email,
            direccion=data.direccion,
            observaciones=data.observaciones,
        )
        return result
    except ConflictError as e:
        raise HTTPException(400, str(e))


@router.put("/{cliente_id}", response_model=ClienteSchema)
def actualizar_cliente(
    cliente_id: int, data: ClienteUpdate,
    service: ClienteService = Depends(_get_service),
):
    try:
        return service.actualizar(cliente_id, data.model_dump(exclude_unset=True))
    except NotFoundError as e:
        raise HTTPException(404, str(e))
    except ConflictError as e:
        raise HTTPException(400, str(e))


@router.delete("/{cliente_id}", status_code=204)
def eliminar_cliente(cliente_id: int, service: ClienteService = Depends(_get_service)):
    try:
        service.eliminar(cliente_id)
    except NotFoundError as e:
        raise HTTPException(404, str(e))
