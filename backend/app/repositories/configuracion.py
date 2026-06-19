from typing import Optional
from sqlalchemy.orm import Session
from app.repositories.base import BaseRepository
from app.models.configuracion import Configuracion


class ConfiguracionRepository(BaseRepository[Configuracion]):
    def __init__(self, db: Session):
        super().__init__(Configuracion, db)

    def get_by_key(self, key: str) -> Optional[Configuracion]:
        return self.db.query(Configuracion).filter(Configuracion.key == key).first()

    def set(self, key: str, value: str) -> Configuracion:
        existing = self.get_by_key(key)
        if existing:
            existing.value = value
            self.db.commit()
            self.db.refresh(existing)
            return existing
        return self.create(key=key, value=value)
