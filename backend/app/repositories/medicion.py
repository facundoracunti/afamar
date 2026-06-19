from typing import Optional, List
from sqlalchemy.orm import Session
from app.repositories.base import BaseRepository
from app.models.medicion import Medicion


class MedicionRepository(BaseRepository[Medicion]):
    def __init__(self, db: Session):
        super().__init__(Medicion, db)

    def search(
        self,
        search: Optional[str] = None,
        estado: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Medicion]:
        query = self.db.query(self.model)
        if estado:
            query = query.filter(Medicion.estado == estado)
        if search:
            query = query.filter(
                Medicion.cliente_nombre.ilike(f"%{search}%")
                | Medicion.cliente_telefono.ilike(f"%{search}%")
                | Medicion.cliente_direccion.ilike(f"%{search}%")
            )
        return query.order_by(Medicion.fecha_programada.desc().nullslast()).offset(skip).limit(limit).all()
