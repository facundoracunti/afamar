"""Repository for the `payment_methods` catalogue.

The form's "Forma de pago" select uses `list_active()` so deactivated
methods never appear in the dropdown (but stay on disk so legacy
budgets / work-orders that referenced them still resolve their
snapshot).
"""
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.reference import PaymentMethod
from app.repositories.base import BaseRepository


class PaymentMethodRepository(BaseRepository):
    model = PaymentMethod

    def __init__(self, db: Session):
        super().__init__(db)

    def get_by_id(self, payment_method_id: int) -> Optional[PaymentMethod]:
        return self.db.query(PaymentMethod).filter(PaymentMethod.id == payment_method_id).first()

    def get_by_name(self, name: str) -> Optional[PaymentMethod]:
        return self.db.query(PaymentMethod).filter(PaymentMethod.name == name).first()

    def get_all(self, skip: int = 0, limit: int = 100) -> List[PaymentMethod]:
        # Operator-controlled display order, with name as a stable tiebreaker.
        return (
            self.db.query(PaymentMethod)
            .order_by(PaymentMethod.sort_order.asc(), PaymentMethod.name.asc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def list_active(self) -> List[PaymentMethod]:
        """Methods the form's "Forma de pago" `<select>` should offer."""
        return (
            self.db.query(PaymentMethod)
            .filter(PaymentMethod.is_active.is_(True))
            .order_by(PaymentMethod.sort_order.asc(), PaymentMethod.name.asc())
            .all()
        )
