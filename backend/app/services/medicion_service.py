from typing import Optional, List
from sqlalchemy.orm import Session
from app.repositories.medicion import MedicionRepository
from app.services.exceptions import NotFoundError


class MedicionService:
    def __init__(self, db: Session):
        self.repo = MedicionRepository(db)

    def listar(self, search=None, estado=None, skip=0, limit=100) -> list:
        return self.repo.search(search, estado, skip, limit)

    def obtener(self, medicion_id: int):
        m = self.repo.get(medicion_id)
        if not m:
            raise NotFoundError("Medición", medicion_id)
        return m

    def crear(self, data: dict):
        return self.repo.create(**data)

    def actualizar(self, medicion_id: int, data: dict):
        m = self.repo.get(medicion_id)
        if not m:
            raise NotFoundError("Medición", medicion_id)
        for key, value in data.items():
            if value is not None:
                setattr(m, key, value)
        self.repo.db.commit()
        self.repo.db.refresh(m)
        return m

    def eliminar(self, medicion_id: int):
        if not self.repo.delete(medicion_id):
            raise NotFoundError("Medición", medicion_id)
