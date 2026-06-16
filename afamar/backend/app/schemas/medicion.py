from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class MedicionBase(BaseModel):
    cliente_nombre: str = ""
    cliente_telefono: str = ""
    cliente_direccion: str = ""
    fecha_programada: Optional[datetime] = None
    hora_programada: str = ""
    observaciones: str = ""
    croquis: list = []
    fotos: list = []
    estado: str = "PENDIENTE"

class MedicionCreate(MedicionBase):
    pass

class MedicionUpdate(BaseModel):
    cliente_nombre: Optional[str] = None
    cliente_telefono: Optional[str] = None
    cliente_direccion: Optional[str] = None
    fecha_programada: Optional[datetime] = None
    hora_programada: Optional[str] = None
    observaciones: Optional[str] = None
    croquis: Optional[list] = None
    fotos: Optional[list] = None
    estado: Optional[str] = None

class Medicion(MedicionBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
