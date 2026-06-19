from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.repositories.base import BaseRepository
from app.models.cliente import Cliente as ClienteModel
from app.models.orden_trabajo import OrdenTrabajo


class ClienteRepository(BaseRepository[ClienteModel]):
    def __init__(self, db: Session):
        super().__init__(ClienteModel, db)

    def search(
        self, search: Optional[str] = None, skip: int = 0, limit: int = 100
    ) -> List[ClienteModel]:
        query = self.db.query(self.model)
        if search:
            query = query.filter(
                or_(
                    ClienteModel.nombre.ilike(f"%{search}%"),
                    ClienteModel.telefono.ilike(f"%{search}%"),
                    ClienteModel.direccion.ilike(f"%{search}%"),
                    ClienteModel.email.ilike(f"%{search}%"),
                )
            )
        return query.offset(skip).limit(limit).all()

    def find_by_telefono(self, telefono: str) -> Optional[ClienteModel]:
        return self.db.query(ClienteModel).filter(ClienteModel.telefono == telefono).first()

    def find_by_email(self, email: str) -> Optional[ClienteModel]:
        return self.db.query(ClienteModel).filter(ClienteModel.email == email).first()

    def find_by_nombre(self, nombre: str) -> Optional[ClienteModel]:
        return self.db.query(ClienteModel).filter(ClienteModel.nombre == nombre).first()

    def find_or_create(
        self, nombre: Optional[str] = None, telefono: Optional[str] = None,
        email: Optional[str] = None, domicilio: Optional[str] = None
    ) -> int:
        cliente = None
        if telefono:
            cliente = self.find_by_telefono(telefono)
        if not cliente and email:
            cliente = self.find_by_email(email)
        if not cliente and nombre:
            cliente = self.find_by_nombre(nombre)

        if cliente:
            changed = False
            if telefono and cliente.telefono != telefono:
                cliente.telefono = telefono; changed = True
            if domicilio and cliente.direccion != domicilio:
                cliente.direccion = domicilio; changed = True
            if email and cliente.email != email:
                cliente.email = email; changed = True
            if changed:
                import datetime
                cliente.updated_at = datetime.datetime.utcnow()
            self.db.flush()
            return cliente.id

        from datetime import datetime
        nuevo = ClienteModel(
            nombre=nombre or "Sin nombre",
            telefono=telefono,
            email=email,
            direccion=domicilio,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        self.db.add(nuevo)
        self.db.flush()
        return nuevo.id

    def get_with_stats(self, cliente_id: int) -> Optional[dict]:
        from sqlalchemy import func
        cliente = self.get(cliente_id)
        if not cliente:
            return None

        total_presupuestos = (
            self.db.query(ClienteModel.presupuestos)
            .filter(ClienteModel.id == cliente_id)
            .count()
        )
        total_ordenes = (
            self.db.query(OrdenTrabajo)
            .filter(OrdenTrabajo.cliente_id == cliente_id)
            .count()
        )
        total_comprado_rows = (
            self.db.query(OrdenTrabajo.total)
            .filter(
                OrdenTrabajo.cliente_id == cliente_id,
                OrdenTrabajo.estado.in_(["TALLER", "TERMINADA", "ENTREGADA"]),
            )
            .all()
        )
        ultima_orden = (
            self.db.query(OrdenTrabajo.numero)
            .filter(OrdenTrabajo.cliente_id == cliente_id)
            .order_by(OrdenTrabajo.id.desc())
            .first()
        )
        ordenes = (
            self.db.query(
                OrdenTrabajo.id,
                OrdenTrabajo.numero,
                OrdenTrabajo.estado,
                OrdenTrabajo.total,
                OrdenTrabajo.created_at,
            )
            .filter(OrdenTrabajo.cliente_id == cliente_id)
            .order_by(OrdenTrabajo.id.desc())
            .limit(20)
            .all()
        )

        return {
            "id": cliente.id,
            "nombre": cliente.nombre,
            "telefono": cliente.telefono,
            "email": cliente.email,
            "direccion": cliente.direccion,
            "observaciones": cliente.observaciones,
            "created_at": cliente.created_at,
            "updated_at": cliente.updated_at,
            "total_presupuestos": total_presupuestos,
            "total_ordenes": total_ordenes,
            "total_comprado": sum((r[0] or 0) for r in total_comprado_rows),
            "ultima_orden": ultima_orden[0] if ultima_orden else None,
            "ordenes": [
                {
                    "id": o[0],
                    "numero": o[1],
                    "estado": o[2],
                    "total": o[3],
                    "created_at": o[4],
                }
                for o in ordenes
            ],
        }
