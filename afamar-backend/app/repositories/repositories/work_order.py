from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.work_order import WorkOrder
from app.repositories.base import BaseRepository


class WorkOrderRepository(BaseRepository):
    model = WorkOrder

    def __init__(self, db: Session):
        super().__init__(db)

    def get_by_id(self, order_id: int) -> Optional[WorkOrder]:
        return self.db.query(WorkOrder).filter(WorkOrder.id == order_id).first()

    def get_by_number(self, number: str) -> Optional[WorkOrder]:
        return self.db.query(WorkOrder).filter(WorkOrder.number == number).first()

    def get_all(self, skip: int = 0, limit: int = 100) -> List[WorkOrder]:
        return self.db.query(WorkOrder).order_by(WorkOrder.id.desc()).offset(skip).limit(limit).all()

    def get_by_status(self, status: str) -> List[WorkOrder]:
        return self.db.query(WorkOrder).filter(WorkOrder.status == status).order_by(WorkOrder.id.desc()).all()

    def get_by_client(self, client_id: int) -> List[WorkOrder]:
        return self.db.query(WorkOrder).filter(WorkOrder.client_id == client_id).order_by(WorkOrder.id.desc()).all()

    def search(self, term: str) -> List[WorkOrder]:
        pattern = f"%{term}%"
        return (
            self.db.query(WorkOrder)
            .filter(
                WorkOrder.number.ilike(pattern)
                | WorkOrder.snapshot_name.ilike(pattern)
                | WorkOrder.material.ilike(pattern)
            )
            .order_by(WorkOrder.id.desc())
            .all()
        )

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
