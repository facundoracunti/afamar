from typing import Optional, List
from sqlalchemy.orm import Session
from app.repositories.presupuesto_online import PresupuestoOnlineRepository
from app.models.orden_trabajo import OrdenTrabajo
from app.utils.numeracion import generar_numero_orden
from app.services.exceptions import NotFoundError, ConflictError
from datetime import datetime


class PresupuestoOnlineService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = PresupuestoOnlineRepository(db)

    def listar(self) -> list:
        return self.db.query(self.repo.model).order_by(self.repo.model.id.desc()).all()

    def obtener(self, id: int):
        p = self.repo.get(id)
        if not p:
            raise NotFoundError("Presupuesto online", id)
        return p

    def crear(self, data: dict):
        return self.repo.create_with_numero(**data)

    def actualizar(self, id: int, data: dict):
        p = self.repo.get(id)
        if not p:
            raise NotFoundError("Presupuesto online", id)
        for key, value in data.items():
            if value is not None:
                setattr(p, key, value)
        self.repo.db.commit()
        self.repo.db.refresh(p)
        return p

    def eliminar(self, id: int):
        if not self.repo.delete(id):
            raise NotFoundError("Presupuesto online", id)

    def convertir_a_orden(self, id: int) -> dict:
        p = self.repo.get(id)
        if not p:
            raise NotFoundError("Presupuesto online", id)

        fecha_dt = None
        if p.fecha:
            try:
                fecha_dt = datetime.strptime(p.fecha[:10], "%Y-%m-%d")
            except (ValueError, TypeError):
                pass

        orden = OrdenTrabajo(
            numero=generar_numero_orden(self.db),
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
        self.db.add(orden)
        self.db.commit()
        self.db.refresh(orden)

        return {
            "message": "Orden creada",
            "orden_id": orden.id,
            "numero": orden.numero,
        }
