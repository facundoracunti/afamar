from datetime import datetime

from pydantic import BaseModel

from app.schemas.base import BaseResponse


class OnlineBudgetBase(BaseModel):
    client_name: str | None = None
    phone: str | None = None
    work_type: str | None = None
    date: str | None = None
    usd_rate: float = 1000.0
    items_data: str | None = None
    total_net_ars: float = 0.0
    total_net_usd: float = 0.0
    total_consolidated: float = 0.0
    pool_id: int | None = None
    pool_price: float = 0.0


class OnlineBudgetCreate(OnlineBudgetBase):
    pass


class OnlineBudgetUpdate(BaseModel):
    client_name: str | None = None
    phone: str | None = None
    work_type: str | None = None
    date: str | None = None
    usd_rate: float | None = None
    items_data: str | None = None
    total_net_ars: float | None = None
    total_net_usd: float | None = None
    total_consolidated: float | None = None
    pool_id: int | None = None
    pool_price: float | None = None


class OnlineBudgetResponse(OnlineBudgetBase, BaseResponse):
    id: int
    number: str
    status: str
    created_at: datetime
    updated_at: datetime
