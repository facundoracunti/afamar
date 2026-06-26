from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class TrabajoRealizadoBase(BaseModel):
    titulo: str
    descripcion: Optional[str] = None
    foto: Optional[str] = None

class TrabajoRealizadoCreate(TrabajoRealizadoBase):
    pass

class TrabajoRealizadoUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    foto: Optional[str] = None

class TrabajoRealizado(TrabajoRealizadoBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
