from pydantic import BaseModel, ConfigDict


class AdditionalWorkCategoryBase(BaseModel):
    name: str
    sort_order: int = 0
    active: bool = True


class AdditionalWorkCategoryCreate(AdditionalWorkCategoryBase):
    pass


class AdditionalWorkCategoryUpdate(BaseModel):
    name: str | None = None
    sort_order: int | None = None
    active: bool | None = None


class AdditionalWorkCategoryResponse(AdditionalWorkCategoryBase):
    id: int
    model_config = ConfigDict(from_attributes=True)
