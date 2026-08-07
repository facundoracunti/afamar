from datetime import datetime
from typing import Any

from pydantic import BaseModel, field_validator, model_validator

from app.schemas.base import BaseResponse, CurrencyCodeMixin


class CapitalizeNameMixin(BaseModel):
    """Normaliza `name` a capitalize() (strip + primera letra en mayúscula,
    resto en minúsculas) en create/update."""

    @field_validator("name", mode="before", check_fields=False)
    @classmethod
    def _capitalize_name(cls, v: Any) -> Any:
        if isinstance(v, str):
            return v.strip().capitalize()
        return v


class MaterialCategoryCreate(CapitalizeNameMixin):
    name: str


class MaterialCategoryResponse(BaseResponse):
    id: int
    name: str


class MaterialColorCreate(CapitalizeNameMixin):
    name: str
    category_id: int | None = None


class MaterialColorUpdate(CapitalizeNameMixin):
    name: str | None = None
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
    color_id: int | None = None
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


class MaterialCreate(CapitalizeNameMixin, MaterialBase):
    pass


class MaterialUpdate(CapitalizeNameMixin):
    name: str | None = None
    category_id: int | None = None
    color_id: int | None = None
    available_thickness: str | None = None
    base_price: float | None = None
    price_usd: float | None = None
    currency: str | None = None
    supplier: str | None = None
    stock_available: int | None = None
    notes: str | None = None


class MaterialColorMixin(BaseModel):
    """Surfaces `color_obj.name` as the wire-format `color` string.

    Handles both ORM objects and plain dicts (the router dumps the row
    to JSON first, so dict is the production path). `color` is resolved
    from the `color_id` FK at serialization time so PDFs/budgets/work
    orders that copy the string keep working unchanged.
    """

    @model_validator(mode="before")
    @classmethod
    def _populate_color(cls, data: Any) -> Any:
        obj = getattr(data, "color_obj", None)
        if obj is None and isinstance(data, dict):
            obj = data.get("color_obj")
        if obj is not None:
            name = obj.get("name") if isinstance(obj, dict) else getattr(obj, "name", None)
            if name:
                try:
                    data.color = name
                except AttributeError:
                    data["color"] = name
        return data


class MaterialResponse(MaterialBase, CurrencyCodeMixin, MaterialColorMixin, BaseResponse):
    id: int
    created_at: datetime
    color: str | None = None


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
