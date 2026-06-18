from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from app.database import get_db
from app.models.stock_pileta import StockPileta, MovimientoPileta
from app.schemas.stock_pileta import StockPiletaCreate, StockPiletaUpdate, StockPileta as StockPiletaSchema
from app.schemas.stock_pileta import MovimientoPiletaCreate, MovimientoPileta as MovimientoPiletaSchema

router = APIRouter()

# Stock
@router.get("/", response_model=List[StockPiletaSchema])
def listar_piletas(
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    query = db.query(StockPileta)
    if search:
        query = query.filter(
            StockPileta.marca.ilike(f"%{search}%") |
            StockPileta.modelo.ilike(f"%{search}%")
        )
    return query.offset(skip).limit(limit).all()

@router.get("/{pileta_id}", response_model=StockPiletaSchema)
def obtener_pileta(pileta_id: int, db: Session = Depends(get_db)):
    pileta = db.query(StockPileta).filter(StockPileta.id == pileta_id).first()
    if not pileta:
        raise HTTPException(404, "Pileta no encontrada")
    return pileta

@router.post("/", response_model=StockPiletaSchema, status_code=201)
def crear_pileta(data: StockPiletaCreate, db: Session = Depends(get_db)):
    pileta = StockPileta(**data.model_dump())
    db.add(pileta)
    db.commit()
    db.refresh(pileta)
    return pileta

@router.put("/{pileta_id}", response_model=StockPiletaSchema)
def actualizar_pileta(pileta_id: int, data: StockPiletaUpdate, db: Session = Depends(get_db)):
    pileta = db.query(StockPileta).filter(StockPileta.id == pileta_id).first()
    if not pileta:
        raise HTTPException(404, "Pileta no encontrada")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(pileta, key, value)
    db.commit()
    db.refresh(pileta)
    return pileta

@router.delete("/{pileta_id}", status_code=204)
def eliminar_pileta(pileta_id: int, db: Session = Depends(get_db)):
    pileta = db.query(StockPileta).filter(StockPileta.id == pileta_id).first()
    if not pileta:
        raise HTTPException(404, "Pileta no encontrada")
    db.delete(pileta)
    db.commit()

# Movimientos
@router.get("/{pileta_id}/movimientos", response_model=List[MovimientoPiletaSchema])
def listar_movimientos(pileta_id: int, db: Session = Depends(get_db)):
    return db.query(MovimientoPileta).filter(MovimientoPileta.pileta_id == pileta_id).order_by(MovimientoPileta.id.desc()).all()

@router.post("/{pileta_id}/movimientos", response_model=MovimientoPiletaSchema, status_code=201)
def crear_movimiento(pileta_id: int, data: MovimientoPiletaCreate, db: Session = Depends(get_db)):
    pileta = db.query(StockPileta).filter(StockPileta.id == pileta_id).first()
    if not pileta:
        raise HTTPException(404, "Pileta no encontrada")
    
    d = data.model_dump(exclude={'pileta_id'})
    d['pileta_id'] = pileta_id
    movimiento = MovimientoPileta(**d)
    db.add(movimiento)
    
    if data.tipo == "Ingreso":
        pileta.cantidad += data.cantidad
    elif data.tipo == "Egreso":
        pileta.cantidad -= data.cantidad
    
    db.commit()
    db.refresh(movimiento)
    return movimiento
