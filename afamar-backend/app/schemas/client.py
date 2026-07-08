from datetime import datetime
from typing import List

from pydantic import BaseModel

from app.schemas.base import BaseResponse


class ClientBase(BaseModel):
    name: str
    phone: str | None = None
    email: str | None = None
    # Legacy: still populated on writes for backward compat (mirrors the
    # client's default `ClientAddress` row). New code should prefer
    # `addresses` and pick the right one per document.
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
    # 1-N alternative delivery addresses. The default row (if any) is
    # listed first by the model relationship order.
    addresses: List["ClientAddressResponse"] = []


class ClientHistoryResponse(BaseModel):
    total_budgets: int = 0
    total_orders: int = 0
    total_billed: float = 0.0
    last_order_number: str | None = None
    recent_orders: list[ClientHistoryItem] = []
    recent_budgets: list[ClientHistoryItem] = []


# Imported here to break the circular type reference: ClientResponse
# embeds `ClientAddressResponse` and that schema is the one most often
# used standalone.
from app.schemas.client_address import ClientAddressResponse  # noqa: E402

ClientResponse.model_rebuild()
