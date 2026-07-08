from datetime import datetime
from typing import Any

from pydantic import BaseModel, model_validator

from app.schemas.base import BaseResponse


class MaterialCategoryCreate(BaseModel):
    name: str


class MaterialCategoryResponse(BaseResponse):
    id: int
    name: str


class MaterialColorCreate(BaseModel):
    name: str
    category_id: int | None = None


class MaterialColorResponse(BaseResponse):
    id: int
    name: str
    category_id: int | None = None


class MaterialThicknessCreate(BaseModel):
    name: str


class MaterialThicknessResponse(BaseResponse):
    id: int
    name: str


class MaterialBase(BaseModel):
    name: str
    category_id: int
    color: str | None = None
    available_thickness: str | None = None
    base_price: float = 0.0
    price_usd: float = 0.0
    # Currency code (matches a row in the `currencies` catalogue). The
    # service layer translates this into a `currency_id` FK on save.
    # ARS rows store the canonical price in `base_price`; USD rows in
    # `price_usd`. The other column is the conversion reference (kept
    # populated by the service so the totals block can show both).
    currency: str = "ARS"
    supplier: str | None = None
    stock_available: int = 0
    notes: str | None = None
    photo: str | None = None


class MaterialCreate(MaterialBase):
    pass


class MaterialUpdate(BaseModel):
    name: str | None = None
    category_id: int | None = None
    color: str | None = None
    available_thickness: str | None = None
    base_price: float | None = None
    price_usd: float | None = None
    currency: str | None = None
    supplier: str | None = None
    stock_available: int | None = None
    notes: str | None = None


class MaterialResponse(MaterialBase, BaseResponse):
    id: int
    created_at: datetime

    @model_validator(mode="before")
    @classmethod
    def _populate_currency_code(cls, data: Any) -> Any:
        """The DB model carries `currency_id` (FK) and a lazy-loaded
        `currency_obj` relationship. When the repository loads the row
        with `joinedload(currency_obj)` (as every method in
        `MaterialRepository` does after this commit), the relationship
        is available when the router validates the response — but
        Pydantic's `model_validate` can be called with either an ORM
        instance (during `model_validate(material)`) or a plain dict
        (when the router dumps the row to JSON first). Handle both
        shapes so the wire format stays `{"currency": "ARS"}` instead
        of leaking the FK."""
        # Try the `currency_obj` route first — works for both
        # dicts and ORM objects. `getattr` covers both: dicts raise
        # AttributeError on non-dict attrs (none), ORM objects expose
        # attributes normally.
        obj = getattr(data, "currency_obj", None)
        if obj is None and isinstance(data, dict):
            obj = data.get("currency_obj")
        if obj is not None:
            code = obj.get("code") if isinstance(obj, dict) else getattr(obj, "code", None)
            if code:
                # Set `currency` on the underlying data whether dict or
                # ORM object — `setattr` covers both.
                try:
                    data.currency = code
                except AttributeError:
                    data["currency"] = code
        return data


class PriceHistoryCreate(BaseModel):
    material_id: int
    price_m2: float = 0.0


class PriceHistoryResponse(BaseResponse):
    id: int
    material_id: int
    material_name: str | None = None
    price_m2: float
    date: datetime
    created_at: datetime
