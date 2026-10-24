from pydantic import BaseModel



class AppOptionCreate(BaseModel):
    category: str
    value: str
    sort_order: int = 0

