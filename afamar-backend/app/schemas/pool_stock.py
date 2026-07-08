from datetime import datetime
from typing import Any

from pydantic import BaseModel, model_validator

from app.schemas.base import BaseResponse


class StockMovementCreate(BaseModel):
    type: str
    quantity: int
    notes: str | None = None


class StockMovementResponse(BaseResponse):
    id: int
    pool_id: int
    type: str
    quantity: int
    notes: str | None = None
    created_at: datetime


class PoolTypeResponse(BaseResponse):
    id: int
    name: str
    label: str


class PoolStockBase(BaseModel):
    brand: str
    model: str
    description: str | None = None
    material: str | None = None
    quantity: int = 0
    # Single price column — its value is in the currency of the FK
    # stored in the DB. The wire format accepts the currency code (ARS /
    # USD) and the service translates it into the FK on save. The
    # `price_usd` column was dropped during the FK migration because
    # the currency is now the single source of truth for which column
    # the price lives in.
    price: float = 0.0
    currency: str = "ARS"
    pool_type_id: int | None = 1


class PoolStockCreate(PoolStockBase):
    pass


class PoolStockUpdate(BaseModel):
    brand: str | None = None
    model: str | None = None
    description: str | None = None
    material: str | None = None
    quantity: int | None = None
    price: float | None = None
    currency: str | None = None
    pool_type_id: int | None = None


class PoolStockResponse(PoolStockBase, BaseResponse):
    id: int
    pool_type_id: int | None = None
    pool_type_name: str | None = None
    created_at: datetime
    updated_at: datetime
    movements: list[StockMovementResponse] = []

    @model_validator(mode="before")
    @classmethod
    def _populate_currency_code(cls, data: Any) -> Any:
        """Same as `MaterialResponse._populate_currency_code`. Tries
        `currency_obj` first (works for ORM objects) and falls back to
        dict access for plain dicts (when the router dumps the row
        to JSON first)."""
        obj = getattr(data, "currency_obj", None)
        if obj is None and isinstance(data, dict):
            obj = data.get("currency_obj")
        if obj is not None:
            code = obj.get("code") if isinstance(obj, dict) else getattr(obj, "code", None)
            if code:
                try:
                    data.currency = code
                except AttributeError:
                    data["currency"] = code
        return data
