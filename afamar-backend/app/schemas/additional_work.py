from datetime import datetime
from typing import Any

from pydantic import BaseModel, model_validator

from app.schemas.base import BaseResponse


class AdditionalWorkBase(BaseModel):
    name: str
    detail: str | None = None
    # Single price column — value lives in the currency of the FK. The
    # wire format accepts the currency code ('ARS' / 'USD') and the
    # service translates it into `currency_id` on save.
    price: float = 0.0
    currency: str = "ARS"


class AdditionalWorkCreate(AdditionalWorkBase):
    pass


class AdditionalWorkUpdate(BaseModel):
    name: str | None = None
    detail: str | None = None
    price: float | None = None
    currency: str | None = None


class AdditionalWorkResponse(AdditionalWorkBase, BaseResponse):
    id: int
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def _populate_currency_code(cls, data: Any) -> Any:
        """Surface `currency_obj.code` as the wire-format `currency`
        string. Handles both ORM objects and plain dicts (the router
        dumps the row to JSON first, so dict is the production path).
        Same pattern as `MaterialResponse._populate_currency_code`."""
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
