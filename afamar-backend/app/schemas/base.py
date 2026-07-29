from typing import Any

from pydantic import BaseModel, model_validator


class BaseResponse(BaseModel):
    model_config = {"from_attributes": True}


class CurrencyCodeMixin(BaseModel):
    """Mixin that surfaces `currency_obj.code` as the wire-format
    `currency` string.  Handles both ORM objects and plain dicts
    (the router dumps the row to JSON first, so dict is the
    production path)."""

    @model_validator(mode="before")
    @classmethod
    def _populate_currency_code(cls, data: Any) -> Any:
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
