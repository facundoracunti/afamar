from datetime import date
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.budget import Budget
from app.models.client import Client
from app.repositories.base import BaseRepository


def _eager_query(db: Session):
    return (
        db.query(Budget)
        .options(
            joinedload(Budget.items),
            joinedload(Budget.additional_works),
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

    def list_filtered(self, status: Optional[str] = None, client_id: Optional[int] = None, date_from: Optional[date] = None, date_to: Optional[date] = None, search: Optional[str] = None, skip: int = 0, limit: int = 100):
        # Base query keeps the original shape (no Client JOIN) to preserve the
        # existing lazy-load path in downstream serializers. For the `search`
        # filter we use a subquery against Client instead of a JOIN so the
        # main query stays untouched.
        query = _eager_query(self.db)
        if status:
            query = query.filter(Budget.status == status)
        if client_id:
            query = query.filter(Budget.client_id == client_id)
        if date_from:
            query = query.filter(Budget.date >= date_from)
        if date_to:
            query = query.filter(Budget.date <= date_to)
        if search:
            pattern = f"%{search}%"
            client_id_subquery = (
                select(Client.id).where(Client.name.ilike(pattern))
            )
            query = query.filter(
                Budget.number.ilike(pattern)
                | Budget.client_id.in_(client_id_subquery)
                | Budget.material.ilike(pattern)
            )
        return query.order_by(Budget.id.desc()).offset(skip).limit(limit).all()

    def list_filtered_count(self, status: Optional[str] = None, client_id: Optional[int] = None, date_from: Optional[date] = None, date_to: Optional[date] = None, search: Optional[str] = None) -> int:
        query = self.db.query(Budget)
        if status:
            query = query.filter(Budget.status == status)
        if client_id:
            query = query.filter(Budget.client_id == client_id)
        if date_from:
            query = query.filter(Budget.date >= date_from)
        if date_to:
            query = query.filter(Budget.date <= date_to)
        if search:
            pattern = f"%{search}%"
            client_id_subquery = (
                select(Client.id).where(Client.name.ilike(pattern))
            )
            query = query.filter(
                Budget.number.ilike(pattern)
                | Budget.client_id.in_(client_id_subquery)
                | Budget.material.ilike(pattern)
            )
        return query.count()

    def search(self, term: str) -> List[Budget]:
        pattern = f"%{term}%"
        return (
            _eager_query(self.db)
            .outerjoin(Client)
            .filter(
                Budget.number.ilike(pattern)
                | Client.name.ilike(pattern)
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
