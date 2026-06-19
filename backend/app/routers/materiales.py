from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.material import Material
from app.schemas.material import MaterialCreate, MaterialUpdate, Material as MaterialSchema, PriceHistorySchema
from app.services.material_service import MaterialService
from app.services.exceptions import NotFoundError

router = APIRouter()


def _get_service(db: Session = Depends(get_db)):
    return MaterialService(db)


@router.get("/", response_model=List[MaterialSchema])
def listar_materiales(
    categoria: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    service: MaterialService = Depends(_get_service),
):
    return service.listar(categoria, search, skip, limit)


@router.get("/{material_id}", response_model=MaterialSchema)
def obtener_material(material_id: int, service: MaterialService = Depends(_get_service)):
    try:
        return service.obtener(material_id)
    except NotFoundError as e:
        raise HTTPException(404, str(e))


@router.post("/", response_model=MaterialSchema, status_code=201)
def crear_material(data: MaterialCreate, service: MaterialService = Depends(_get_service)):
    return service.crear(data.model_dump())


@router.put("/{material_id}", response_model=MaterialSchema)
def actualizar_material(
    material_id: int, data: MaterialUpdate,
    service: MaterialService = Depends(_get_service),
):
    try:
        return service.actualizar(material_id, data.model_dump(exclude_unset=True))
    except NotFoundError as e:
        raise HTTPException(404, str(e))


@router.delete("/{material_id}", status_code=204)
def eliminar_material(material_id: int, service: MaterialService = Depends(_get_service)):
    try:
        service.eliminar(material_id)
    except NotFoundError as e:
        raise HTTPException(404, str(e))


@router.get("/{material_id}/price-history", response_model=List[PriceHistorySchema])
def price_history(material_id: int, service: MaterialService = Depends(_get_service)):
    return service.price_history(material_id)
