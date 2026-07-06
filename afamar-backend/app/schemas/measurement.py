from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.base import BaseResponse


class MeasurementBase(BaseModel):
    client_id: int | None = None
    scheduled_date: Optional[datetime] = None
    scheduled_time: str | None = None
    notes: str | None = None
    sketch_data: str | None = None
    photos_data: str | None = None
    status: str = "PENDING"
    work_order_id: int | None = None


class MeasurementCreate(MeasurementBase):
    pass


class MeasurementUpdate(BaseModel):
    client_id: int | None = None
    scheduled_date: Optional[datetime] = None
    scheduled_time: str | None = None
    notes: str | None = None
    sketch_data: str | None = None
    photos_data: str | None = None
    status: str | None = None
    work_order_id: int | None = None


class MeasurementResponse(MeasurementBase, BaseResponse):
    id: int
    client_name: str | None = None
    client_phone: str | None = None
    client_email: str | None = None
    client_address: str | None = None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_orm_with_client(cls, measurement) -> "MeasurementResponse":
        """Build a response from a Measurement ORM row, populating client_*
        from the related Client row."""
        data = cls.model_validate(measurement).model_dump()
        client = getattr(measurement, "client", None)
        if client:
            data["client_name"] = client.name or data.get("client_name") or ""
            data["client_phone"] = client.phone or data.get("client_phone") or ""
            data["client_email"] = client.email or data.get("client_email") or ""
            data["client_address"] = client.address or data.get("client_address") or ""
        return cls.model_validate(data)
