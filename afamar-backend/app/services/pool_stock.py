from typing import List, Optional

from sqlalchemy.orm import Session, joinedload

from app.core.exceptions import ValidationError
from app.models.pool_stock import PoolStock, PoolType
from app.models.reference import Currency
from app.repositories.pool_stock import PoolStockRepository
from app.utils.pagination import paginate, Page


def _resolve_currency_id(db: Session, code: str) -> int:
    """Translate a 3-letter currency code into the matching
    `currencies.id`. Raises `ValidationError` if the code doesn't
    exist (so the API returns 422 with a clear message rather than a
    500 IntegrityError on a dangling FK)."""
    if not code:
        return 1  # default to ARS (id=1 by the seeder order)
    cur = db.query(Currency).filter(Currency.code == code.upper()).first()
    if not cur:
        raise ValidationError(
            f"Moneda desconocida: {code!r}. Las monedas válidas se configuran en `currencies`."
        )
    return cur.id


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
        # `joinedload(currency_obj)` populates the `currency` field in the
        # response via the `_populate_currency_code` validator. `pool_type`
        # is for the `pool_type_name` label.
        query = self.repo.db.query(PoolStock).options(
            joinedload(PoolStock.pool_type),
            joinedload(PoolStock.currency_obj),
        )
        page = paginate(self.repo.db, query, skip, limit)
        for p in page.items:
            self._attach_pool_type_name(p)
        return page

    def get_by_id(self, pool_id: int) -> Optional[PoolStock]:
        pool = (
            self.repo.db.query(PoolStock)
            .options(joinedload(PoolStock.pool_type), joinedload(PoolStock.currency_obj))
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
        # The wire format still passes the legacy `currency` code — the
        # FK translation lives here so the rest of the stack (Pydantic
        # schemas, ORM, frontend) keeps talking in code rather than ids.
        if "currency" in data:
            data["currency_id"] = _resolve_currency_id(self.repo.db, data.pop("currency"))
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
        if "currency" in data:
            data["currency_id"] = _resolve_currency_id(self.repo.db, data.pop("currency"))
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
