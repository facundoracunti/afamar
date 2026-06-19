from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.presupuesto import Presupuesto
from app.models.orden_trabajo import OrdenTrabajo
from app.models.stock_pileta import StockPileta
from app.models.cliente import Cliente
from app.schemas.dashboard import DashboardData, PresupuestoResumen, OrdenResumen, PiletaResumen
import datetime


class DashboardService:
    def __init__(self, db: Session):
        self.db = db

    def get_data(self) -> DashboardData:
        now = datetime.datetime.utcnow()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        dos_meses = now - datetime.timedelta(days=60)

        presupuestos_pendientes = (
            self.db.query(Presupuesto).filter(Presupuesto.estado == "Pendiente").count()
        )
        ordenes_en_medicion = (
            self.db.query(OrdenTrabajo).filter(OrdenTrabajo.estado == "EN MEDICIÓN").count()
        )
        ordenes_en_taller = (
            self.db.query(OrdenTrabajo).filter(OrdenTrabajo.estado == "EN EL TALLER").count()
        )
        piletas_en_stock = (
            self.db.query(func.sum(StockPileta.cantidad)).scalar() or 0
        )
        trabajos_proxima_entrega = (
            self.db.query(OrdenTrabajo)
            .filter(OrdenTrabajo.estado.in_(["EN MEDICIÓN", "EN EL TALLER"]))
            .count()
        )
        total_ordenes_activas = (
            self.db.query(OrdenTrabajo).filter(OrdenTrabajo.estado != "ENTREGADO").count()
        )
        total_presupuestos = self.db.query(Presupuesto).count()
        total_ordenes = self.db.query(OrdenTrabajo).count()
        total_ingresos = (
            self.db.query(func.sum(OrdenTrabajo.total))
            .filter(OrdenTrabajo.estado == "ENTREGADO")
            .scalar() or 0
        )
        total_pendiente_cobro = (
            self.db.query(func.sum(OrdenTrabajo.saldo_pendiente))
            .filter(OrdenTrabajo.estado != "ENTREGADO")
            .scalar() or 0
        )
        ordenes_entregadas_mes = (
            self.db.query(OrdenTrabajo)
            .filter(OrdenTrabajo.estado == "ENTREGADO", OrdenTrabajo.updated_at >= month_start)
            .count()
        )
        presupuestos_aprobados_mes = (
            self.db.query(Presupuesto)
            .filter(Presupuesto.estado == "Aprobado", Presupuesto.updated_at >= month_start)
            .count()
        )

        presupuestos_recientes = (
            self.db.query(Presupuesto)
            .order_by(Presupuesto.created_at.desc())
            .limit(10)
            .all()
        )
        presupuestos_recientes_data = [
            PresupuestoResumen(
                id=p.id, numero=p.numero,
                cliente_nombre=p.cliente.nombre if p.cliente else None,
                total=p.total or 0, estado=p.estado or "",
                created_at=p.created_at,
            )
            for p in presupuestos_recientes
        ]

        ordenes_recientes = (
            self.db.query(OrdenTrabajo)
            .filter(OrdenTrabajo.estado != "ENTREGADO")
            .order_by(OrdenTrabajo.created_at.desc())
            .limit(10)
            .all()
        )
        ordenes_recientes_data = [
            OrdenResumen(
                id=o.id, numero=o.numero,
                cliente_nombre=o.cliente.nombre if o.cliente else None,
                total=o.total or 0, estado=o.estado or "",
                created_at=o.created_at, updated_at=o.updated_at,
            )
            for o in ordenes_recientes
        ]

        ordenes_entregadas = (
            self.db.query(OrdenTrabajo)
            .filter(OrdenTrabajo.estado == "ENTREGADO", OrdenTrabajo.updated_at < dos_meses)
            .order_by(OrdenTrabajo.updated_at.desc())
            .all()
        )
        ordenes_entregadas_data = [
            OrdenResumen(
                id=o.id, numero=o.numero,
                cliente_nombre=o.cliente.nombre if o.cliente else None,
                total=o.total or 0, estado=o.estado or "",
                created_at=o.created_at, updated_at=o.updated_at,
            )
            for o in ordenes_entregadas
        ]

        piletas = self.db.query(StockPileta).all()
        piletas_data = [
            PiletaResumen(
                id=p.id, marca=p.marca, modelo=p.modelo, cantidad=p.cantidad or 0
            )
            for p in piletas
        ]

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
            ordenes_entregadas=ordenes_entregadas_data,
        )
