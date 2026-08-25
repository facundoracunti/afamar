"""Pydantic schemas for the `payment_methods` catalogue.

The catalogue is a small reference table that powers two things on the
budget / work-order form:

1. The "Forma de pago" `<select>` (one row per method, ordered by
   `sort_order`).
2. The live total calculation: each row carries its own `type` /
   `value` / `is_percentage` / `applies_to_installments` so the form
   can apply a discount or surcharge without hardcoding rules in the
   form code.

Wire format matches the model 1:1. The legacy `name` column is kept
as the stable identifier used by the form snapshot (and to keep
existing budget / work-order rows that match by string still
resolvable after we load the catalogue).
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# `type` is stored as VARCHAR(20) on the DB side (see migration
# b3c4d5e6f7a9). We keep it as a plain string here instead of a
# `Literal` so the form can render methods whose `type` predates
# this field (`'NONE'`) without breaking Pydantic validation.
PAYMENT_METHOD_TYPES = ("DISCOUNT", "SURCHARGE", "NONE")


class PaymentMethodBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    label: str = Field(..., min_length=1, max_length=100)
    color: Optional[str] = Field(default=None, max_length=20)
    is_active: bool = True
    sort_order: int = 0

    # Calculation fields. Defaults match the migration's server_default
    # so legacy rows that the form reads by `name` keep behaving as
    # before (no automatic discount / surcharge).
    type: str = "NONE"
    value: float = 0.0
    is_percentage: bool = False
    applies_to_installments: bool = False


class PaymentMethodCreate(PaymentMethodBase):
    pass


class PaymentMethodUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=50)
    label: Optional[str] = Field(default=None, min_length=1, max_length=100)
    color: Optional[str] = Field(default=None, max_length=20)
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
    type: Optional[str] = None
    value: Optional[float] = None
    is_percentage: Optional[bool] = None
    applies_to_installments: Optional[bool] = None


class PaymentMethodResponse(PaymentMethodBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
