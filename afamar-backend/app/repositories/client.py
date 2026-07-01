from typing import List, Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.budget import Budget
from app.models.client import Client
from app.models.work_order import WorkOrder
from app.repositories.base import BaseRepository


class ClientRepository(BaseRepository):
    model = Client

    def __init__(self, db: Session):
        super().__init__(db)

    def get_by_id(self, client_id: int) -> Optional[Client]:
        return self.db.query(Client).filter(Client.id == client_id).first()

    def get_all(self, skip: int = 0, limit: int = 100) -> List[Client]:
        return self.db.query(Client).offset(skip).limit(limit).all()

    def search(self, term: str) -> List[Client]:
        pattern = f"%{term}%"
        return (
            self.db.query(Client)
            .filter(
                or_(
                    Client.name.ilike(pattern),
                    Client.phone.ilike(pattern),
                    Client.address.ilike(pattern),
                )
            )
            .all()
        )

    def create(self, data: dict) -> Client:
        client = Client(**data)
        return self.save(client)

    def update(self, client: Client, data: dict) -> Client:
        for key, value in data.items():
            if value is not None:
                setattr(client, key, value)
        return self.save(client)

    def delete(self, client: Client) -> None:
        super().delete(client)

    def get_history(self, client_id: int) -> dict:
        budget_count = self.db.query(func.count(Budget.id)).filter(Budget.client_id == client_id).scalar() or 0
        order_count = self.db.query(func.count(WorkOrder.id)).filter(WorkOrder.client_id == client_id).scalar() or 0

        total_billed = (
            self.db.query(func.coalesce(func.sum(WorkOrder.total), 0))
            .filter(WorkOrder.client_id == client_id, WorkOrder.status.in_(["WORKSHOP", "FINISHED"]))
            .scalar()
            or 0.0
        )

        last_order = (
            self.db.query(WorkOrder)
            .filter(WorkOrder.client_id == client_id)
            .order_by(WorkOrder.created_at.desc())
            .first()
        )

        recent_orders = (
            self.db.query(WorkOrder)
            .filter(WorkOrder.client_id == client_id)
            .order_by(WorkOrder.created_at.desc())
            .limit(20)
            .all()
        )

        recent_budgets = (
            self.db.query(Budget)
            .filter(Budget.client_id == client_id)
            .order_by(Budget.created_at.desc())
            .limit(20)
            .all()
        )

        return {
            "total_budgets": budget_count,
            "total_orders": order_count,
            "total_billed": total_billed,
            "last_order_number": last_order.number if last_order else None,
            "recent_orders": [
                {
                    "id": o.id,
                    "number": o.number,
                    "status": o.status,
                    "total": o.total,
                    "created_at": o.created_at.isoformat() if o.created_at else None,
                }
                for o in recent_orders
            ],
            "recent_budgets": [
                {
                    "id": b.id,
                    "number": b.number,
                    "status": b.status,
                    "total": b.total,
                    "created_at": b.created_at.isoformat() if b.created_at else None,
                }
                for b in recent_budgets
            ],
        }
