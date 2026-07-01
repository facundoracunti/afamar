from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.pool_stock import PoolStock
from app.repositories.pool_stock import PoolStockRepository


class PoolStockService:
    def __init__(self, db: Session):
        self.repo = PoolStockRepository(db)

    def get_all(self, skip: int = 0, limit: int = 100) -> List[PoolStock]:
        return self.repo.get_all(skip, limit)

    def get_by_id(self, pool_id: int) -> Optional[PoolStock]:
        return self.repo.get_by_id(pool_id)

    def search(self, term: str) -> List[PoolStock]:
        return self.repo.search(term)

    def create(self, data: dict) -> PoolStock:
        pool = self.repo.create(data)
        self.repo.db.commit()
        self.repo.db.refresh(pool)
        return pool

    def update(self, pool_id: int, data: dict) -> Optional[PoolStock]:
        pool = self.repo.get_by_id(pool_id)
        if not pool:
            return None
        result = self.repo.update(pool, data)
        self.repo.db.commit()
        self.repo.db.refresh(result)
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
