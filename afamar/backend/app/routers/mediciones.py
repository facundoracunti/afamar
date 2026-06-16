from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.medicion import Medicion as MedicionModel
from app.schemas.medicion import MedicionCreate, MedicionUpdate, Medicion as MedicionSchema

router = APIRouter()

@router.get("/", response_model=List[MedicionSchema])
def listar_mediciones(
    search: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    query = db.query(MedicionModel)
    if search:
        query = query.filter(
            MedicionModel.cliente_nombre.ilike(f"%{search}%") |
            MedicionModel.cliente_telefono.ilike(f"%{search}%") |
            MedicionModel.cliente_direccion.ilike(f"%{search}%")
        )
    if estado:
        query = query.filter(MedicionModel.estado == estado)
    return query.order_by(MedicionModel.id.desc()).offset(skip).limit(limit).all()

@router.get("/{medicion_id}", response_model=MedicionSchema)
def obtener_medicion(medicion_id: int, db: Session = Depends(get_db)):
    medicion = db.query(MedicionModel).filter(MedicionModel.id == medicion_id).first()
    if not medicion:
        raise HTTPException(404, "Medición no encontrada")
    return medicion

@router.post("/", response_model=MedicionSchema, status_code=201)
def crear_medicion(data: MedicionCreate, db: Session = Depends(get_db)):
    medicion = MedicionModel(**data.model_dump())
    db.add(medicion)
    db.commit()
    db.refresh(medicion)
    return medicion

@router.put("/{medicion_id}", response_model=MedicionSchema)
def actualizar_medicion(medicion_id: int, data: MedicionUpdate, db: Session = Depends(get_db)):
    medicion = db.query(MedicionModel).filter(MedicionModel.id == medicion_id).first()
    if not medicion:
        raise HTTPException(404, "Medición no encontrada")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(medicion, key, value)
    db.commit()
    db.refresh(medicion)
    return medicion

@router.delete("/{medicion_id}", status_code=204)
def eliminar_medicion(medicion_id: int, db: Session = Depends(get_db)):
    medicion = db.query(MedicionModel).filter(MedicionModel.id == medicion_id).first()
    if not medicion:
        raise HTTPException(404, "Medición no encontrada")
    db.delete(medicion)
    db.commit()
