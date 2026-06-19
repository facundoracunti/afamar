from typing import Optional, List
from sqlalchemy.orm import Session, joinedload
from app.repositories.base import BaseRepository
from app.models.orden_trabajo import OrdenTrabajo


class OrdenTrabajoRepository(BaseRepository[OrdenTrabajo]):
    def __init__(self, db: Session):
        super().__init__(OrdenTrabajo, db)

    def _base_query(self):
        return self.db.query(OrdenTrabajo).options(
            joinedload(OrdenTrabajo.cliente),
            joinedload(OrdenTrabajo.presupuesto),
        )

    def get_loaded(self, id: int) -> Optional[OrdenTrabajo]:
        return self._base_query().filter(OrdenTrabajo.id == id).first()

    def search(
        self,
        search: Optional[str] = None,
        estado: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[OrdenTrabajo]:
        query = self._base_query()
        if estado:
            query = query.filter(OrdenTrabajo.estado == estado)
        else:
            query = query.filter(OrdenTrabajo.estado.in_(["MEDICION", "TALLER"]))
        if search:
            query = query.filter(
                OrdenTrabajo.numero.ilike(f"%{search}%")
                | OrdenTrabajo.cliente_nombre.ilike(f"%{search}%")
                | OrdenTrabajo.cliente_telefono_orden.ilike(f"%{search}%")
                | OrdenTrabajo.email.ilike(f"%{search}%")
            )
        query = query.order_by(OrdenTrabajo.id.desc())
        return query.offset(skip).limit(limit).all()
