from typing import Optional, List
from sqlalchemy.orm import Session
from app.repositories.base import BaseRepository
from app.models.trabajo_realizado import TrabajoRealizado


class TrabajoRealizadoRepository(BaseRepository[TrabajoRealizado]):
    def __init__(self, db: Session):
        super().__init__(TrabajoRealizado, db)

    def list_all(self, skip: int = 0, limit: int = 100) -> List[TrabajoRealizado]:
        return (
            self.db.query(self.model)
            .order_by(TrabajoRealizado.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
