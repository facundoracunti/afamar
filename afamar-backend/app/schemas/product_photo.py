
from pydantic import BaseModel



class ProductPhotoBase(BaseModel):
    title: str | None = None
    description: str | None = None


class ProductPhotoUpdate(BaseModel):
    title: str | None = None
    description: str | None = None

