from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.online_budget import OnlineBudget
from app.repositories.base import BaseRepository


class OnlineBudgetRepository(BaseRepository):
    model = OnlineBudget

    def __init__(self, db: Session):
        super().__init__(db)

    def get_by_id(self, budget_id: int) -> Optional[OnlineBudget]:
        return self.db.query(OnlineBudget).filter(OnlineBudget.id == budget_id).first()

    def get_by_number(self, number: str) -> Optional[OnlineBudget]:
        return self.db.query(OnlineBudget).filter(OnlineBudget.number == number).first()

    def get_all(self, skip: int = 0, limit: int = 100) -> List[OnlineBudget]:
        return self.db.query(OnlineBudget).order_by(OnlineBudget.id.desc()).offset(skip).limit(limit).all()

    def get_last_number(self) -> Optional[str]:
        budget = self.db.query(OnlineBudget).order_by(OnlineBudget.id.desc()).first()
        return budget.number if budget else None

    def create(self, data: dict) -> OnlineBudget:
        return self.save(OnlineBudget(**data))

    def update(self, budget: OnlineBudget, data: dict) -> OnlineBudget:
        for key, value in data.items():
            if value is not None:
                setattr(budget, key, value)
        return self.save(budget)

    def delete(self, budget: OnlineBudget) -> None:
        super().delete(budget)
