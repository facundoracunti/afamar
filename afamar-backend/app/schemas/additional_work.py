from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

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
    # applies the formula (material.price_m2 * 0.13) * formula_constant,
    # multiplied by linear meters supplied on the budget row.
    type: str = "flat"
    # Multiplier used in the `frente` formula (default 1.15 for newly
    # created `frente` rows).
    formula_constant: float | None = None
    front_kind: str | None = None


class AdditionalWorkCreate(AdditionalWorkBase):
    pass


class AdditionalWorkUpdate(BaseModel):
    name: str | None = None
    detail: str | None = None
    price: float | None = None
    currency: str | None = None
    type: str | None = None
    formula_constant: float | None = None
    front_kind: str | None = None


class AdditionalWorkResponse(AdditionalWorkBase, CurrencyCodeMixin, BaseResponse):
    id: int
    created_at: datetime
    updated_at: datetime


class FrentePricingInput(BaseModel):
    """Validated inputs for the frente pricing rule."""

    material_price_m2: Decimal = Field(default=Decimal("0"), ge=0)
    formula_multiplier: Decimal = Field(default=Decimal("1.15"), ge=0)
    linear_meters: Decimal = Field(default=Decimal("0"), ge=0)


class FrentePricingBreakdown(BaseModel):
    """Auditable result of the frente calculation.

    ``subtotal`` is intentionally derived from ``price_per_meter`` and
    ``linear_meters``. It must never be recomputed from the raw formula in a
    second path.
    """

    material_price_m2: Decimal
    linear_coefficient: Decimal
    formula_multiplier: Decimal
    linear_meters: Decimal
    price_per_meter: Decimal
    subtotal: Decimal
