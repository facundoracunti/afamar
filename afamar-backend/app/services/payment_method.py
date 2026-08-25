"""Service for the `payment_methods` catalogue.

Thin layer over the repository. Keeps the type/value/is_percentage/
applies_to_installments fields on the model so the form and the PDF
both read the same source of truth.
"""
from typing import List, Optional

from sqlalchemy.orm import Session

from app.core.exceptions import ValidationError
from app.models.reference import PaymentMethod
from app.repositories.payment_method import PaymentMethodRepository
from app.schemas.payment_method import PAYMENT_METHOD_TYPES


class PaymentMethodService:
    def __init__(self, db: Session):
        self.repo = PaymentMethodRepository(db)

    def get_all(self, skip: int = 0, limit: int = 100) -> List[PaymentMethod]:
        return self.repo.get_all(skip, limit)

    def get_by_id(self, payment_method_id: int) -> Optional[PaymentMethod]:
        return self.repo.get_by_id(payment_method_id)

    def list_active(self) -> List[PaymentMethod]:
        return self.repo.list_active()

    def create(self, data: dict) -> PaymentMethod:
        self._validate(data)
        # Reject duplicate `name` so the snapshot lookup stays
        # unambiguous (the form matches budget.payment_method by
        # name on legacy rows).
        if self.repo.get_by_name(data["name"]):
            raise ValidationError(f"Ya existe un método de pago con el nombre '{data['name']}'")
        pm = self.repo.create(data)
        self.repo.db.commit()
        return pm

    def update(self, payment_method_id: int, data: dict) -> Optional[PaymentMethod]:
        pm = self.repo.get_by_id(payment_method_id)
        if not pm:
            return None
        # If the operator is renaming the method, make sure the new
        # name is not already taken (a different row).
        if "name" in data and data["name"] != pm.name:
            existing = self.repo.get_by_name(data["name"])
            if existing and existing.id != payment_method_id:
                raise ValidationError(f"Ya existe un método de pago con el nombre '{data['name']}'")
        self._validate(data, partial=True)
        result = self.repo.update(pm, data)
        self.repo.db.commit()
        return result

    def delete(self, payment_method_id: int) -> bool:
        pm = self.repo.get_by_id(payment_method_id)
        if not pm:
            return False
        # FK from Budget/WorkOrder is nullable + ondelete is the
        # default (no CASCADE) so the row goes away and the
        # existing references keep their string snapshot — no
        # historical data loss.
        self.repo.delete(pm)
        self.repo.db.commit()
        return True

    @staticmethod
    def _validate(data: dict, partial: bool = False) -> None:
        if "type" in data and data["type"] not in PAYMENT_METHOD_TYPES:
            raise ValidationError(
                f"Tipo de método de pago inválido: '{data['type']}'. "
                f"Valores permitidos: {', '.join(PAYMENT_METHOD_TYPES)}"
            )
        if not partial:
            # Required fields on create
            for required in ("name", "label"):
                if not data.get(required):
                    raise ValidationError(f"El campo '{required}' es obligatorio")
        if "value" in data and data["value"] is not None and data["value"] < 0:
            raise ValidationError("El valor del método de pago no puede ser negativo")
