from typing import Optional

from pydantic import BaseModel


class ReferenceBase(BaseModel):
    model_config = {"from_attributes": True}

    name: str
    label: str
    color: Optional[str] = None
    is_active: bool = True
    sort_order: int = 0


class ReferenceCreate(BaseModel):
    name: str
    label: str
    color: Optional[str] = None
    is_active: bool = True
    sort_order: int = 0


class ReferenceUpdate(BaseModel):
    name: Optional[str] = None
    label: Optional[str] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
