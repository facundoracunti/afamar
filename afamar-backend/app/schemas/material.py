from datetime import datetime

from pydantic import BaseModel

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
    currency: str = "ARS"
    supplier: str | None = None
    stock_available: int = 0
    notes: str | None = None


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
