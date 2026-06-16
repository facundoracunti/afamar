from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import Optional, List
from datetime import datetime
from app.database import get_db
from app.models.presupuesto import Presupuesto
from app.models.orden_trabajo import OrdenTrabajo
from app.models.material import Material
from app.models.stock_pileta import StockPileta

router = APIRouter()

@router.get("/presupuestos")
def reporte_presupuestos(
    fecha_desde: Optional[datetime] = Query(None),
    fecha_hasta: Optional[datetime] = Query(None),
    estado: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Presupuesto)
    if fecha_desde:
        query = query.filter(Presupuesto.created_at >= fecha_desde)
    if fecha_hasta:
        query = query.filter(Presupuesto.created_at <= fecha_hasta)
    if estado:
        query = query.filter(Presupuesto.estado == estado)
    
    total = query.count()
    monto_total = query.with_entities(func.sum(Presupuesto.total)).scalar() or 0
    
    return {
        "total": total,
        "monto_total": monto_total,
        "pendientes": query.filter(Presupuesto.estado == "Pendiente").count(),
        "aprobados": query.filter(Presupuesto.estado == "Aprobado").count(),
        "rechazados": query.filter(Presupuesto.estado == "Rechazado").count()
    }

@router.get("/ordenes")
def reporte_ordenes(
    fecha_desde: Optional[datetime] = Query(None),
    fecha_hasta: Optional[datetime] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(OrdenTrabajo)
    if fecha_desde:
        query = query.filter(OrdenTrabajo.created_at >= fecha_desde)
    if fecha_hasta:
        query = query.filter(OrdenTrabajo.created_at <= fecha_hasta)
    
    return {
        "total": query.count(),
        "presupuestadas": query.filter(OrdenTrabajo.estado == "Presupuestado").count(),
        "en_produccion": query.filter(OrdenTrabajo.estado == "En Producción").count(),
        "finalizadas": query.filter(OrdenTrabajo.estado == "Finalizado").count()
    }

@router.get("/ventas-mensuales")
def reporte_ventas_mensuales(año: Optional[int] = Query(None), db: Session = Depends(get_db)):
    if not año:
        año = datetime.utcnow().year
    
    ventas = []
    for mes in range(1, 13):
        monto = db.query(func.sum(OrdenTrabajo.saldo_pendiente)).filter(
            extract("year", OrdenTrabajo.created_at) == año,
            extract("month", OrdenTrabajo.created_at) == mes,
            OrdenTrabajo.estado == "Finalizado"
        ).scalar() or 0
        
        ventas.append({"mes": mes, "monto": monto})
    
    return {"año": año, "ventas": ventas}

@router.get("/materiales-mas-usados")
def materiales_mas_usados(db: Session = Depends(get_db)):
    from app.models.presupuesto import Presupuesto
    materiales = db.query(
        Presupuesto.material,
        func.count(Presupuesto.id).label("total")
    ).filter(
        Presupuesto.material.isnot(None),
        Presupuesto.material != ""
    ).group_by(Presupuesto.material).order_by(func.count(Presupuesto.id).desc()).limit(10).all()
    
    return [{"material": m[0], "total": m[1]} for m in materiales]
