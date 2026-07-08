from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.base import BaseResponse


class ClientAddressBase(BaseModel):
    address: str
    label: str | None = None
    is_default: bool = False


class ClientAddressCreate(ClientAddressBase):
    pass


class ClientAddressUpdate(BaseModel):
    address: str | None = None
    label: str | None = None
    is_default: bool | None = None


class ClientAddressResponse(ClientAddressBase, BaseResponse):
    id: int
    client_id: int
    created_at: datetime
    updated_at: datetime
