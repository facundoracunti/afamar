from typing import Optional, List
from sqlalchemy.orm import Session
from app.repositories.base import BaseRepository
from app.models.material import Material
from app.models.price_history import PriceHistory
from datetime import datetime


class MaterialRepository(BaseRepository[Material]):
    def __init__(self, db: Session):
        super().__init__(Material, db)

    def search(
        self,
        categoria: Optional[str] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Material]:
        query = self.db.query(self.model)
        if categoria:
            query = query.filter(Material.categoria == categoria)
        if search:
            query = query.filter(Material.nombre.ilike(f"%{search}%"))
        return query.offset(skip).limit(limit).all()

    def get_price_history(self, material_id: int) -> List[PriceHistory]:
        return (
            self.db.query(PriceHistory)
            .filter(PriceHistory.material_id == material_id)
            .order_by(PriceHistory.fecha.desc())
            .all()
        )

    def record_price_change(self, material_id: int, nombre: str, old_precio: float, new_precio: float) -> None:
        if new_precio > 0 and new_precio != old_precio:
            ph = PriceHistory(
                material_id=material_id,
                material_nombre=nombre,
                precio_m2=new_precio,
            )
            self.db.add(ph)
            self.db.commit()
