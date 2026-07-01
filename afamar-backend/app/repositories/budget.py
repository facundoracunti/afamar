from datetime import date
from typing import List, Optional

from sqlalchemy.orm import Session, joinedload

from app.models.budget import Budget
from app.repositories.base import BaseRepository


def _eager_query(db: Session):
    return (
        db.query(Budget)
        .options(
            joinedload(Budget.items),
            joinedload(Budget.adicionales),
            joinedload(Budget.sketch_elements),
        )
    )


class BudgetRepository(BaseRepository):
    model = Budget

    def __init__(self, db: Session):
        super().__init__(db)

    def get_by_id(self, budget_id: int) -> Optional[Budget]:
        return _eager_query(self.db).filter(Budget.id == budget_id).first()

    def get_by_number(self, number: str) -> Optional[Budget]:
        return self.db.query(Budget).filter(Budget.number == number).first()

    def get_all(self, skip: int = 0, limit: int = 100) -> List[Budget]:
        return _eager_query(self.db).order_by(Budget.id.desc()).offset(skip).limit(limit).all()

    def get_by_status(self, status: str) -> List[Budget]:
        return _eager_query(self.db).filter(Budget.status == status).order_by(Budget.id.desc()).all()

    def get_by_client(self, client_id: int) -> List[Budget]:
        return _eager_query(self.db).filter(Budget.client_id == client_id).order_by(Budget.id.desc()).all()

    def list_filtered(self, status: Optional[str] = None, client_id: Optional[int] = None, date_from: Optional[date] = None, date_to: Optional[date] = None, skip: int = 0, limit: int = 100):
        query = _eager_query(self.db)
        if status:
            query = query.filter(Budget.status == status)
        if client_id:
            query = query.filter(Budget.client_id == client_id)
        if date_from:
            query = query.filter(Budget.date >= date_from)
        if date_to:
            query = query.filter(Budget.date <= date_to)
        return query.order_by(Budget.id.desc()).offset(skip).limit(limit).all()

    def list_filtered_count(self, status: Optional[str] = None, client_id: Optional[int] = None, date_from: Optional[date] = None, date_to: Optional[date] = None) -> int:
        query = self.db.query(Budget)
        if status:
            query = query.filter(Budget.status == status)
        if client_id:
            query = query.filter(Budget.client_id == client_id)
        if date_from:
            query = query.filter(Budget.date >= date_from)
        if date_to:
            query = query.filter(Budget.date <= date_to)
        return query.count()

    def search(self, term: str) -> List[Budget]:
        pattern = f"%{term}%"
        return (
            _eager_query(self.db)
            .filter(
                Budget.number.ilike(pattern)
                | Budget.snapshot_name.ilike(pattern)
                | Budget.material.ilike(pattern)
            )
            .order_by(Budget.id.desc())
            .all()
        )

    def get_last_number(self) -> Optional[str]:
        budget = self.db.query(Budget).order_by(Budget.id.desc()).first()
        return budget.number if budget else None

    def create(self, data: dict) -> Budget:
        budget = Budget(**data)
        self.add(budget)
        return budget

    def update(self, budget: Budget, data: dict) -> Budget:
        for key, value in data.items():
            if value is not None:
                setattr(budget, key, value)
        return budget
