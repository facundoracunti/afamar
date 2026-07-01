from datetime import datetime

from pydantic import BaseModel

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


class PoolStockBase(BaseModel):
    brand: str
    model: str
    description: str | None = None
    material: str | None = None
    quantity: int = 0
    price: float = 0.0
    price_usd: float = 0.0


class PoolStockCreate(PoolStockBase):
    pass


class PoolStockUpdate(BaseModel):
    brand: str | None = None
    model: str | None = None
    description: str | None = None
    material: str | None = None
    quantity: int | None = None
    price: float | None = None
    price_usd: float | None = None


class PoolStockResponse(PoolStockBase, BaseResponse):
    id: int
    created_at: datetime
    updated_at: datetime
    movements: list[StockMovementResponse] = []
