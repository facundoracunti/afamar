from datetime import datetime

from pydantic import BaseModel

from app.schemas.base import BaseResponse, CurrencyCodeMixin


class AdditionalWorkBase(BaseModel):
    name: str
    detail: str | None = None
    # Single price column — value lives in the currency of the FK. The
    # wire format accepts the currency code ('ARS' / 'USD') and the
    # service translates it into `currency_id` on save.
    price: float = 0.0
    currency: str = "ARS"
    # Pricing mode. `flat` (default) uses `price * quantity`. `frente`
    # applies the formula (material.price_m2 * 0.13) + formula_constant,
    # multiplied by linear meters supplied on the budget row.
    type: str = "flat"
    # Constant used in the `frente` formula (units match the material
    # currency; default 1.15 for newly created `frente` rows).
    formula_constant: float | None = None


class AdditionalWorkCreate(AdditionalWorkBase):
    pass


class AdditionalWorkUpdate(BaseModel):
    name: str | None = None
    detail: str | None = None
    price: float | None = None
    currency: str | None = None
    type: str | None = None
    formula_constant: float | None = None


class AdditionalWorkResponse(AdditionalWorkBase, CurrencyCodeMixin, BaseResponse):
    id: int
    created_at: datetime
    updated_at: datetime
