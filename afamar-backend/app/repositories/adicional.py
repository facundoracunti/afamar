from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.adicional import Adicional
from app.repositories.base import BaseRepository


class AdicionalRepository(BaseRepository):
    model = Adicional

    def __init__(self, db: Session):
        super().__init__(db)

    def get_by_id(self, adicional_id: int) -> Optional[Adicional]:
        return (
            self.db.query(Adicional)
            .options(joinedload(Adicional.currency_obj))
            .filter(Adicional.id == adicional_id)
            .first()
        )

    def get_all(self, skip: int = 0, limit: int = 100, only_active: bool = False) -> List[Adicional]:
        # `joinedload(currency_obj)` is required so the response
        # validador can surface the currency code in the wire format.
        # `only_active=True` is used by the budget picker to hide
        # disabled rows from the dropdown.
        q = self.db.query(Adicional).options(joinedload(Adicional.currency_obj))
        if only_active:
            q = q.filter(Adicional.is_active.is_(True))
        return q.order_by(Adicional.sort_order.asc(), Adicional.name.asc()).offset(skip).limit(limit).all()

    def create(self, data: dict) -> Adicional:
        adicional = self.save(Adicional(**data))
        self.db.refresh(adicional, attribute_names=["currency_obj"])
        return adicional

    def update(self, adicional: Adicional, data: dict) -> Adicional:
        for key, value in data.items():
            if value is not None:
                setattr(adicional, key, value)
        result = self.save(adicional)
        self.db.refresh(result, attribute_names=["currency_obj"])
        return result
