from datetime import datetime

from pydantic import BaseModel

from app.schemas.base import BaseResponse


class ClientBase(BaseModel):
    name: str
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    notes: str | None = None


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    notes: str | None = None


class ClientHistoryItem(BaseModel):
    id: int
    number: str
    status: str
    total: float
    created_at: datetime | None = None


class ClientResponse(ClientBase, BaseResponse):
    id: int
    total_purchased: float
    created_at: datetime
    updated_at: datetime


class ClientHistoryResponse(BaseModel):
    total_budgets: int = 0
    total_orders: int = 0
    total_billed: float = 0.0
    last_order_number: str | None = None
    recent_orders: list[ClientHistoryItem] = []
    recent_budgets: list[ClientHistoryItem] = []
