from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from app.repositories.base import BaseRepository
from app.models.presupuesto import Presupuesto, PresupuestoItem, PresupuestoAdicional
from app.models.cliente import Cliente
from app.models.orden_trabajo import OrdenTrabajo
from datetime import datetime


class PresupuestoRepository(BaseRepository[Presupuesto]):
    def __init__(self, db: Session):
        super().__init__(Presupuesto, db)

    def _base_query(self):
        return self.db.query(Presupuesto).options(
            joinedload(Presupuesto.cliente),
            joinedload(Presupuesto.items),
            joinedload(Presupuesto.adicionales),
            joinedload(Presupuesto.orden_trabajo),
        )

    def get_loaded(self, id: int) -> Optional[Presupuesto]:
        return self._base_query().filter(Presupuesto.id == id).first()

    def search(
        self,
        search: Optional[str] = None,
        estado: Optional[str] = None,
        material: Optional[str] = None,
        fecha_desde: Optional[str] = None,
        fecha_hasta: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Presupuesto]:
        query = self._base_query()
        if estado:
            query = query.filter(Presupuesto.estado == estado)
        else:
            query = query.filter(Presupuesto.estado != "CONVERTIDO A OT")
        if material:
            query = query.filter(Presupuesto.material.ilike(f"%{material}%"))
        if fecha_desde:
            query = query.filter(
                Presupuesto.created_at >= datetime.fromisoformat(fecha_desde)
            )
        if fecha_hasta:
            query = query.filter(
                Presupuesto.created_at <= datetime.fromisoformat(fecha_hasta)
            )
        if search:
            query = query.outerjoin(Cliente).filter(
                Presupuesto.numero.ilike(f"%{search}%")
                | Cliente.nombre.ilike(f"%{search}%")
                | Cliente.telefono.ilike(f"%{search}%")
                | Presupuesto.cliente_telefono_orden.ilike(f"%{search}%")
                | Presupuesto.material.ilike(f"%{search}%")
            )
        query = query.order_by(Presupuesto.id.desc())
        resultados = query.offset(skip).limit(limit).all()
        vistos = set()
        unicos = []
        for p in resultados:
            if p.id not in vistos:
                vistos.add(p.id)
                unicos.append(p)
        return unicos

    def create_with_relations(
        self, data: dict, items: List[dict], adicionales: List[dict]
    ) -> Presupuesto:
        from app.utils.numeracion import generar_numero_presupuesto

        presupuesto = Presupuesto(**data)
        presupuesto.numero = generar_numero_presupuesto(self.db)
        for item_data in items:
            presupuesto.items.append(PresupuestoItem(**item_data))
        for adic_data in adicionales:
            presupuesto.adicionales.append(PresupuestoAdicional(**adic_data))
        self.db.add(presupuesto)
        self.db.commit()
        self.db.refresh(presupuesto)
        return presupuesto

    def update_with_relations(
        self, id: int, data: dict, items: Optional[List[dict]], adicionales: Optional[List[dict]]
    ) -> Optional[Presupuesto]:
        presupuesto = self.get_loaded(id)
        if not presupuesto:
            return None
        for key, value in data.items():
            setattr(presupuesto, key, value)
        if items is not None:
            presupuesto.items.clear()
            for item_data in items:
                presupuesto.items.append(PresupuestoItem(**item_data))
        if adicionales is not None:
            presupuesto.adicionales.clear()
            for adic_data in adicionales:
                presupuesto.adicionales.append(PresupuestoAdicional(**adic_data))
        self.db.commit()
        self.db.refresh(presupuesto)
        return presupuesto

    def restore_stock(self, presupuesto) -> None:
        if presupuesto.pileta_id and presupuesto.stock_descontado:
            from app.models.stock_pileta import StockPileta, MovimientoPileta
            pileta = self.db.query(StockPileta).filter(StockPileta.id == presupuesto.pileta_id).first()
            if pileta:
                pileta.cantidad = (pileta.cantidad or 0) + 1
                movimiento = MovimientoPileta(
                    pileta_id=presupuesto.pileta_id,
                    tipo="Ingreso",
                    cantidad=1,
                    descripcion=f"Restauración por eliminación de presupuesto {presupuesto.numero}",
                )
                self.db.add(movimiento)

    def get_unificados(
        self, search: Optional[str] = None, estado: Optional[str] = None
    ) -> List[dict]:
        from app.models.presupuesto_online import PresupuestoOnline

        locales = self._base_query()
        onlines = self.db.query(PresupuestoOnline).all()

        if estado:
            locales = locales.filter(Presupuesto.estado == estado)
        else:
            locales = locales.filter(Presupuesto.estado != "CONVERTIDO A OT")

        if search:
            locales = locales.outerjoin(Cliente).filter(
                Presupuesto.numero.ilike(f"%{search}%")
                | Cliente.nombre.ilike(f"%{search}%")
                | Cliente.telefono.ilike(f"%{search}%")
                | Presupuesto.cliente_telefono_orden.ilike(f"%{search}%")
                | Presupuesto.material.ilike(f"%{search}%")
            )
            onlines = [
                o
                for o in onlines
                if search.lower() in (o.numero or "").lower()
                or search.lower() in (o.cliente or "").lower()
            ]

        locales = locales.order_by(Presupuesto.id.desc()).all()
        locales = list({p.id: p for p in locales}.values())

        result = []
        for p in locales:
            c = p.cliente
            result.append(
                {
                    "id": p.id,
                    "tipo": "local",
                    "numero": p.numero,
                    "fecha": p.fecha,
                    "cliente_nombre": p.cliente_nombre
                    or (c.nombre if c else None),
                    "cliente_telefono": p.cliente_telefono_orden
                    or (c.telefono if c else None),
                    "material": p.material,
                    "total": p.total or 0,
                    "total_usd": p.total_usd or 0,
                    "estado": p.estado,
                    "orden_trabajo_numero": p.orden_trabajo.numero
                    if p.orden_trabajo
                    else None,
                    "created_at": p.created_at,
                    "sena_recibida": p.sena_recibida or 0,
                    "saldo_pendiente": p.saldo_pendiente or 0,
                    "observaciones_diseno": p.observaciones_diseno or "",
                    "materiales": (
                        [{"nombre": m.get("nombre")} for m in (p.materiales or [])]
                        if p.materiales
                        else []
                    ),
                }
            )
        for o in onlines:
            if estado == "CONVERTIDO A OT" and o.estado != "CONVERTIDO A OT":
                continue
            result.append(
                {
                    "id": o.id,
                    "tipo": "online",
                    "numero": o.numero,
                    "fecha": o.fecha,
                    "cliente_nombre": o.cliente,
                    "cliente_telefono": None,
                    "material": None,
                    "total": o.total_neto_ars or 0,
                    "total_usd": 0,
                    "estado": o.estado or "ONLINE",
                    "orden_trabajo_numero": None,
                    "created_at": o.created_at,
                    "sena_recibida": 0,
                    "saldo_pendiente": 0,
                    "observaciones_diseno": "",
                    "materiales": [],
                }
            )
        result.sort(
            key=lambda x: x.get("created_at") or datetime.min, reverse=True
        )
        return result
