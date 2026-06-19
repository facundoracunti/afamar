from typing import Optional, List
from sqlalchemy.orm import Session
from app.repositories.stock_pileta import StockPiletaRepository, MovimientoPiletaRepository
from app.services.exceptions import NotFoundError


class StockPiletaService:
    def __init__(self, db: Session):
        self.repo = StockPiletaRepository(db)
        self.mov_repo = MovimientoPiletaRepository(db)

    def listar(self, search=None, skip=0, limit=100) -> list:
        return self.repo.search(search, skip, limit)

    def obtener(self, pileta_id: int):
        pileta = self.repo.get(pileta_id)
        if not pileta:
            raise NotFoundError("Pileta", pileta_id)
        return pileta

    def crear(self, data: dict):
        return self.repo.create(**data)

    def actualizar(self, pileta_id: int, data: dict):
        pileta = self.repo.get(pileta_id)
        if not pileta:
            raise NotFoundError("Pileta", pileta_id)
        for key, value in data.items():
            setattr(pileta, key, value)
        self.repo.db.commit()
        self.repo.db.refresh(pileta)
        return pileta

    def eliminar(self, pileta_id: int):
        if not self.repo.delete(pileta_id):
            raise NotFoundError("Pileta", pileta_id)

    def listar_movimientos(self, pileta_id: int) -> list:
        return self.mov_repo.get_by_pileta(pileta_id)

    def crear_movimiento(self, pileta_id: int, data: dict):
        return self.mov_repo.create_and_update_stock(
            pileta_id=pileta_id,
            tipo=data["tipo"],
            cantidad=data["cantidad"],
            descripcion=data.get("descripcion"),
        )
