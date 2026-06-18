from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models.material import Material
from app.models.price_history import PriceHistory
from app.schemas.material import MaterialCreate, MaterialUpdate, Material as MaterialSchema, PriceHistorySchema

router = APIRouter()

@router.get("/", response_model=List[MaterialSchema])
def listar_materiales(
    categoria: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    query = db.query(Material)
    if categoria:
        query = query.filter(Material.categoria == categoria)
    if search:
        query = query.filter(Material.nombre.ilike(f"%{search}%"))
    return query.offset(skip).limit(limit).all()

@router.get("/{material_id}", response_model=MaterialSchema)
def obtener_material(material_id: int, db: Session = Depends(get_db)):
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(404, "Material no encontrado")
    return material

@router.post("/", response_model=MaterialSchema, status_code=201)
def crear_material(data: MaterialCreate, db: Session = Depends(get_db)):
    material = Material(**data.model_dump())
    db.add(material)
    db.commit()
    db.refresh(material)
    if material.precio_m2 and material.precio_m2 > 0:
        ph = PriceHistory(material_id=material.id, material_nombre=material.nombre, precio_m2=material.precio_m2)
        db.add(ph)
        db.commit()
    return material

@router.put("/{material_id}", response_model=MaterialSchema)
def actualizar_material(material_id: int, data: MaterialUpdate, db: Session = Depends(get_db)):
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(404, "Material no encontrado")
    old_precio = material.precio_m2
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(material, key, value)
    if data.precio_m2 is not None and data.precio_m2 != old_precio and data.precio_m2 > 0:
        ph = PriceHistory(material_id=material.id, material_nombre=material.nombre, precio_m2=data.precio_m2)
        db.add(ph)
    db.commit()
    db.refresh(material)
    return material

@router.delete("/{material_id}", status_code=204)
def eliminar_material(material_id: int, db: Session = Depends(get_db)):
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(404, "Material no encontrado")
    db.delete(material)
    db.commit()

@router.get("/{material_id}/price-history", response_model=List[PriceHistorySchema])
def price_history(material_id: int, db: Session = Depends(get_db)):
    return db.query(PriceHistory).filter(PriceHistory.material_id == material_id).order_by(PriceHistory.fecha.desc()).all()
