from typing import List, Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models.pool_stock import PoolStock, StockMovement
from app.repositories.base import BaseRepository


class PoolStockRepository(BaseRepository):
    model = PoolStock

    def __init__(self, db: Session):
        super().__init__(db)

    def get_by_id(self, pool_id: int) -> Optional[PoolStock]:
        return (
            self.db.query(PoolStock)
            .options(joinedload(PoolStock.currency_obj))
            .filter(PoolStock.id == pool_id)
            .first()
        )

    def get_all(self, skip: int = 0, limit: int = 100) -> List[PoolStock]:
        return (
            self.db.query(PoolStock)
            .options(joinedload(PoolStock.currency_obj))
            .offset(skip)
            .limit(limit)
            .all()
        )

    def search(self, term: str) -> List[PoolStock]:
        pattern = f"%{term}%"
        return (
            self.db.query(PoolStock)
            .options(joinedload(PoolStock.currency_obj))
            .filter(or_(PoolStock.brand.ilike(pattern), PoolStock.model.ilike(pattern)))
            .all()
        )

    def create(self, data: dict) -> PoolStock:
        # Always populate `currency_obj` so the response validator
        # (`PoolStockResponse._populate_currency_code`) can surface the
        # currency code as a string in the wire format.
        pool = self.save(PoolStock(**data))
        self.db.refresh(pool, attribute_names=["currency_obj"])
        return pool

    def update(self, pool: PoolStock, data: dict) -> PoolStock:
        for key, value in data.items():
            if value is not None:
                setattr(pool, key, value)
        result = self.save(pool)
        self.db.refresh(result, attribute_names=["currency_obj"])
        return result

    def delete(self, pool: PoolStock) -> None:
        super().delete(pool)

    def add_movement(self, pool_id: int, data: dict) -> StockMovement:
        movement = StockMovement(pool_id=pool_id, **data)
        pool = self.get_by_id(pool_id)
        if data["type"] == "entry":
            pool.quantity += data["quantity"]
        elif data["type"] == "exit":
            pool.quantity -= data["quantity"]
        return self.save(movement)
