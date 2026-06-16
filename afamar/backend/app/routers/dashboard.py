from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.presupuesto import Presupuesto
from app.models.orden_trabajo import OrdenTrabajo
from app.models.stock_pileta import StockPileta
from app.models.cliente import Cliente
from app.schemas.dashboard import DashboardData, PresupuestoResumen, OrdenResumen, PiletaResumen
import datetime

router = APIRouter()

@router.get("/", response_model=DashboardData)
def get_dashboard(db: Session = Depends(get_db)):
    presupuestos_pendientes = db.query(Presupuesto).filter(Presupuesto.estado == "Pendiente").count()
    ordenes_en_medicion = db.query(OrdenTrabajo).filter(OrdenTrabajo.estado == "EN MEDICIÓN").count()
    ordenes_en_taller = db.query(OrdenTrabajo).filter(OrdenTrabajo.estado == "EN EL TALLER").count()
    piletas_en_stock = db.query(func.sum(StockPileta.cantidad)).scalar() or 0
    trabajos_proxima_entrega = db.query(OrdenTrabajo).filter(OrdenTrabajo.estado.in_(["EN MEDICIÓN", "EN EL TALLER"])).count()

    now = datetime.datetime.utcnow()
    dos_meses = now - datetime.timedelta(days=60)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total_ordenes_activas = db.query(OrdenTrabajo).filter(OrdenTrabajo.estado != "ENTREGADO").count()
    total_presupuestos = db.query(Presupuesto).count()
    total_ordenes = db.query(OrdenTrabajo).count()
    total_ingresos = db.query(func.sum(OrdenTrabajo.total)).filter(OrdenTrabajo.estado == "ENTREGADO").scalar() or 0
    total_pendiente_cobro = db.query(func.sum(OrdenTrabajo.saldo_pendiente)).filter(OrdenTrabajo.estado != "ENTREGADO").scalar() or 0
    ordenes_entregadas_mes = db.query(OrdenTrabajo).filter(
        OrdenTrabajo.estado == "ENTREGADO",
        OrdenTrabajo.updated_at >= month_start
    ).count()
    presupuestos_aprobados_mes = db.query(Presupuesto).filter(
        Presupuesto.estado == "Aprobado",
        Presupuesto.updated_at >= month_start
    ).count()

    presupuestos_recientes = db.query(Presupuesto).order_by(Presupuesto.created_at.desc()).limit(10).all()
    presupuestos_recientes_data = []
    for p in presupuestos_recientes:
        presupuestos_recientes_data.append(PresupuestoResumen(
            id=p.id, numero=p.numero,
            cliente_nombre=p.cliente.nombre if p.cliente else None,
            total=p.total or 0, estado=p.estado or "",
            created_at=p.created_at
        ))

    ordenes_recientes = db.query(OrdenTrabajo).filter(OrdenTrabajo.estado != "ENTREGADO").order_by(OrdenTrabajo.created_at.desc()).limit(10).all()
    ordenes_recientes_data = []
    for o in ordenes_recientes:
        ordenes_recientes_data.append(OrdenResumen(
            id=o.id, numero=o.numero,
            cliente_nombre=o.cliente.nombre if o.cliente else None,
            total=o.total or 0, estado=o.estado or "",
            created_at=o.created_at, updated_at=o.updated_at
        ))

    ordenes_entregadas = db.query(OrdenTrabajo).filter(
        OrdenTrabajo.estado == "ENTREGADO",
        OrdenTrabajo.updated_at < dos_meses
    ).order_by(OrdenTrabajo.updated_at.desc()).all()
    ordenes_entregadas_data = []
    for o in ordenes_entregadas:
        ordenes_entregadas_data.append(OrdenResumen(
            id=o.id, numero=o.numero,
            cliente_nombre=o.cliente.nombre if o.cliente else None,
            total=o.total or 0, estado=o.estado or "",
            created_at=o.created_at, updated_at=o.updated_at
        ))

    piletas = db.query(StockPileta).all()
    piletas_data = [PiletaResumen(id=p.id, marca=p.marca, modelo=p.modelo, cantidad=p.cantidad or 0) for p in piletas]

    return DashboardData(
        presupuestos_pendientes=presupuestos_pendientes,
        ordenes_en_medicion=ordenes_en_medicion,
        ordenes_en_taller=ordenes_en_taller,
        piletas_en_stock=piletas_en_stock,
        trabajos_proxima_entrega=trabajos_proxima_entrega,
        total_ordenes_activas=total_ordenes_activas,
        total_presupuestos=total_presupuestos,
        total_ordenes=total_ordenes,
        total_ingresos=total_ingresos,
        total_pendiente_cobro=total_pendiente_cobro,
        ordenes_entregadas_mes=ordenes_entregadas_mes,
        presupuestos_aprobados_mes=presupuestos_aprobados_mes,
        presupuestos_recientes=presupuestos_recientes_data,
        ordenes_recientes=ordenes_recientes_data,
        piletas=piletas_data,
        ordenes_entregadas=ordenes_entregadas_data
    )
