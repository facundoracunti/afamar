from typing import List, Optional

from sqlalchemy.orm import Session, joinedload

from app.models.additional_work import AdditionalWork
from app.repositories.base import BaseRepository


class AdditionalWorkRepository(BaseRepository):
    model = AdditionalWork

    def __init__(self, db: Session):
        super().__init__(db)

    def get_by_id(self, additional_work_id: int) -> Optional[AdditionalWork]:
        return (
            self.db.query(AdditionalWork)
            .options(joinedload(AdditionalWork.currency_obj))
            .filter(AdditionalWork.id == additional_work_id)
            .first()
        )

    def get_all(self, skip: int = 0, limit: int = 100) -> List[AdditionalWork]:
        # `joinedload(currency_obj)` is required so the response
        # validador can surface the currency code in the wire format.
        # Ordered by name (alphabetical) — there's no sort_order column
        # so the operator can't override the display order. The picker
        # in the budget form shows them in this order.
        return (
            self.db.query(AdditionalWork)
            .options(joinedload(AdditionalWork.currency_obj))
            .order_by(AdditionalWork.name.asc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def create(self, data: dict) -> AdditionalWork:
        additional_work = self.save(AdditionalWork(**data))
        self.db.refresh(additional_work, attribute_names=["currency_obj"])
        return additional_work

    def update(self, additional_work: AdditionalWork, data: dict) -> AdditionalWork:
        for key, value in data.items():
            if value is not None:
                setattr(additional_work, key, value)
        result = self.save(additional_work)
        self.db.refresh(result, attribute_names=["currency_obj"])
        return result
