from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.base import BaseResponse


class MeasurementBase(BaseModel):
    client_name: str | None = None
    client_phone: str | None = None
    client_address: str | None = None
    scheduled_date: Optional[datetime] = None
    scheduled_time: str | None = None
    notes: str | None = None
    sketch_data: str | None = None
    photos_data: str | None = None
    status: str = "PENDING"


class MeasurementCreate(MeasurementBase):
    pass


class MeasurementUpdate(BaseModel):
    client_name: str | None = None
    client_phone: str | None = None
    client_address: str | None = None
    scheduled_date: Optional[datetime] = None
    scheduled_time: str | None = None
    notes: str | None = None
    sketch_data: str | None = None
    photos_data: str | None = None
    status: str | None = None


class MeasurementResponse(MeasurementBase, BaseResponse):
    id: int
    created_at: datetime
    updated_at: datetime
