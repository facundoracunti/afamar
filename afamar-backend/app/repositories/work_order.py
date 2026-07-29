from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from datetime import date

from app.models.work_order import WorkOrder
from app.models.client import Client
from app.repositories.base import BaseRepository


def _eager_query(db: Session):
    return (
        db.query(WorkOrder)
        .options(
            joinedload(WorkOrder.client),
            joinedload(WorkOrder.pool),
            joinedload(WorkOrder.budget),
        )
    )


class WorkOrderRepository(BaseRepository):
    model = WorkOrder

    def __init__(self, db: Session):
        super().__init__(db)

    def get_by_id(self, order_id: int) -> Optional[WorkOrder]:
        return _eager_query(self.db).filter(WorkOrder.id == order_id).first()

    def get_by_number(self, number: str) -> Optional[WorkOrder]:
        return _eager_query(self.db).filter(WorkOrder.number == number).first()

    def get_all(self, skip: int = 0, limit: int = 100) -> List[WorkOrder]:
        return _eager_query(self.db).order_by(WorkOrder.id.desc()).offset(skip).limit(limit).all()

    def get_by_status(self, status: str) -> List[WorkOrder]:
        return _eager_query(self.db).filter(WorkOrder.status == status).order_by(WorkOrder.id.desc()).all()

    def get_by_client(self, client_id: int) -> List[WorkOrder]:
        return _eager_query(self.db).filter(WorkOrder.client_id == client_id).order_by(WorkOrder.id.desc()).all()

    def search(self, term: str) -> List[WorkOrder]:
        pattern = f"%{term}%"
        client_id_subquery = select(Client.id).where(Client.name.ilike(pattern))
        return (
            _eager_query(self.db)
            .filter(
                WorkOrder.number.ilike(pattern)
                | WorkOrder.client_id.in_(client_id_subquery)
                | WorkOrder.material.ilike(pattern)
            )
            .order_by(WorkOrder.id.desc())
            .all()
        )

    def list_filtered(self, status: str | None = None, client_id: int | None = None, date_from: date | None = None, date_to: date | None = None, search: str | None = None, skip: int = 0, limit: int = 100) -> List[WorkOrder]:
        query = _eager_query(self.db)
        if status:
            query = query.filter(WorkOrder.status == status)
        if client_id:
            query = query.filter(WorkOrder.client_id == client_id)
        if date_from:
            query = query.filter(WorkOrder.date >= date_from)
        if date_to:
            query = query.filter(WorkOrder.date <= date_to)
        if search:
            pattern = f"%{search}%"
            client_id_subquery = select(Client.id).where(Client.name.ilike(pattern))
            query = query.filter(
                WorkOrder.number.ilike(pattern)
                | WorkOrder.client_id.in_(client_id_subquery)
                | WorkOrder.material.ilike(pattern)
            )
        return query.order_by(WorkOrder.created_at.desc()).offset(skip).limit(limit).all()

    def list_filtered_count(self, status: str | None = None, client_id: int | None = None, date_from: date | None = None, date_to: date | None = None, search: str | None = None) -> int:
        query = self.db.query(WorkOrder)
        if status:
            query = query.filter(WorkOrder.status == status)
        if client_id:
            query = query.filter(WorkOrder.client_id == client_id)
        if date_from:
            query = query.filter(WorkOrder.date >= date_from)
        if date_to:
            query = query.filter(WorkOrder.date <= date_to)
        if search:
            pattern = f"%{search}%"
            client_id_subquery = select(Client.id).where(Client.name.ilike(pattern))
            query = query.filter(
                WorkOrder.number.ilike(pattern)
                | WorkOrder.client_id.in_(client_id_subquery)
                | WorkOrder.material.ilike(pattern)
            )
        return query.count()

    def get_last_number(self) -> Optional[str]:
        order = self.db.query(WorkOrder).order_by(WorkOrder.id.desc()).first()
        return order.number if order else None

    def create(self, data: dict) -> WorkOrder:
        order = WorkOrder(**data)
        return self.save(order)

    def update(self, order: WorkOrder, data: dict) -> WorkOrder:
        for key, value in data.items():
            if value is not None:
                setattr(order, key, value)
        return self.save(order)
