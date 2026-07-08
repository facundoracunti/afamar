from typing import List, Optional

from sqlalchemy.orm import Session, joinedload

from app.models.pool_stock import PoolStock, PoolType
from app.repositories.pool_stock import PoolStockRepository
from app.utils.pagination import paginate, Page


class PoolStockService:
    def __init__(self, db: Session):
        self.repo = PoolStockRepository(db)

    def _attach_pool_type_name(self, pool: PoolStock) -> PoolStock:
        if pool.pool_type:
            pool.pool_type_name = pool.pool_type.label  # type: ignore[attr-defined]
        else:
            pool.pool_type_name = None  # type: ignore[attr-defined]
        return pool

    def get_all_paginated(self, skip: int = 0, limit: int = 100) -> Page:
        query = self.repo.db.query(PoolStock).options(joinedload(PoolStock.pool_type))
        page = paginate(self.repo.db, query, skip, limit)
        for p in page.items:
            self._attach_pool_type_name(p)
        return page

    def get_by_id(self, pool_id: int) -> Optional[PoolStock]:
        pool = (
            self.repo.db.query(PoolStock)
            .options(joinedload(PoolStock.pool_type))
            .filter(PoolStock.id == pool_id)
            .first()
        )
        if pool:
            self._attach_pool_type_name(pool)
        return pool

    def search(self, term: str) -> List[PoolStock]:
        pools = self.repo.search(term)
        for p in pools:
            self._attach_pool_type_name(p)
        return pools

    def create(self, data: dict) -> PoolStock:
        pool = self.repo.create(data)
        self.repo.db.commit()
        self.repo.db.refresh(pool)
        self._attach_pool_type_name(pool)
        return pool

    def update(self, pool_id: int, data: dict) -> Optional[PoolStock]:
        pool = (
            self.repo.db.query(PoolStock)
            .options(joinedload(PoolStock.pool_type))
            .filter(PoolStock.id == pool_id)
            .first()
        )
        if not pool:
            return None
        result = self.repo.update(pool, data)
        self.repo.db.commit()
        self.repo.db.refresh(result)
        self._attach_pool_type_name(result)
        return result

    def delete(self, pool_id: int) -> bool:
        pool = self.repo.get_by_id(pool_id)
        if not pool:
            return False
        self.repo.delete(pool)
        self.repo.db.commit()
        return True

    def add_movement(self, pool_id: int, data: dict):
        movement = self.repo.add_movement(pool_id, data)
        self.repo.db.commit()
        self.repo.db.refresh(movement)
        return movement
