from datetime import datetime

from pydantic import BaseModel

from app.schemas.base import BaseResponse


class ProductPhotoBase(BaseModel):
    title: str | None = None
    description: str | None = None


class ProductPhotoCreate(ProductPhotoBase):
    pass


class ProductPhotoUpdate(BaseModel):
    title: str | None = None
    description: str | None = None


class ProductPhotoResponse(ProductPhotoBase, BaseResponse):
    id: int
    file_path: str
    created_at: datetime
    updated_at: datetime
