from pydantic import BaseModel

from app.schemas.base import BaseResponse


class AppOptionCreate(BaseModel):
    category: str
    value: str
    sort_order: int = 0


class AppOptionResponse(BaseResponse):
    id: int
    category: str
    value: str
    sort_order: int
