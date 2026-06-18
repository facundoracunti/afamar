from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.presupuesto_online import PresupuestoOnline
from app.schemas.presupuesto_online import (
    PresupuestoOnlineCreate, PresupuestoOnlineUpdate,
    PresupuestoOnline as PresupuestoOnlineSchema
)
from app.utils.numeracion import generar_numero_presupuesto

router = APIRouter()


@router.get("/", response_model=List[PresupuestoOnlineSchema])
def listar(db: Session = Depends(get_db)):
    return db.query(PresupuestoOnline).order_by(PresupuestoOnline.id.desc()).all()


@router.get("/{id}", response_model=PresupuestoOnlineSchema)
def obtener(id: int, db: Session = Depends(get_db)):
    p = db.query(PresupuestoOnline).filter(PresupuestoOnline.id == id).first()
    if not p:
        raise HTTPException(404, "Presupuesto online no encontrado")
    return p


@router.post("/", response_model=PresupuestoOnlineSchema, status_code=201)
def crear(data: PresupuestoOnlineCreate, db: Session = Depends(get_db)):
    p = PresupuestoOnline(**data.model_dump())
    p.numero = generar_numero_presupuesto(db)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.put("/{id}", response_model=PresupuestoOnlineSchema)
def actualizar(id: int, data: PresupuestoOnlineUpdate, db: Session = Depends(get_db)):
    p = db.query(PresupuestoOnline).filter(PresupuestoOnline.id == id).first()
    if not p:
        raise HTTPException(404, "Presupuesto online no encontrado")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(p, key, value)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{id}", status_code=204)
def eliminar(id: int, db: Session = Depends(get_db)):
    p = db.query(PresupuestoOnline).filter(PresupuestoOnline.id == id).first()
    if not p:
        raise HTTPException(404, "Presupuesto online no encontrado")
    db.delete(p)
    db.commit()

@router.post("/{id}/convertir-orden")
def convertir_a_orden(id: int, db: Session = Depends(get_db)):
    from app.models.orden_trabajo import OrdenTrabajo
    from app.utils.numeracion import generar_numero_orden
    from datetime import datetime as dt

    p = db.query(PresupuestoOnline).filter(PresupuestoOnline.id == id).first()
    if not p:
        raise HTTPException(404, "Presupuesto online no encontrado")

    fecha_dt = None
    if p.fecha:
        try:
            fecha_dt = dt.strptime(p.fecha[:10], "%Y-%m-%d")
        except:
            pass

    orden = OrdenTrabajo(
        numero=generar_numero_orden(db),
        origen="Desde presupuesto online",
        cliente_nombre=p.cliente,
        fecha=fecha_dt,
        detalles_fabricacion=p.items or [],
        total=p.total_consolidado or p.total_neto_ars or 0,
        subtotal=p.total_neto_ars or 0,
        dolar_dia=p.dolar_dia or 1000,
        total_usd=p.total_neto_usd or 0,
        estado="EN MEDICIÓN",
        observaciones=f"Convertido desde presupuesto online {p.numero}",
    )
    p.estado = "CONVERTIDO A OT"
    db.add(orden)
    db.commit()
    db.refresh(orden)
    return {"message": "Orden creada", "orden_id": orden.id, "numero": orden.numero}
