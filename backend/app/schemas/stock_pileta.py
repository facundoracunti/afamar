from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class StockPiletaBase(BaseModel):
    marca: str
    modelo: str
    descripcion: Optional[str] = None
    material: Optional[str] = None
    cantidad: int = 0
    precio: Optional[float] = 0
    precio_usd: Optional[float] = 0

class StockPiletaCreate(StockPiletaBase):
    pass

class StockPiletaUpdate(BaseModel):
    marca: Optional[str] = None
    modelo: Optional[str] = None
    descripcion: Optional[str] = None
    material: Optional[str] = None
    cantidad: Optional[int] = None
    precio: Optional[float] = None
    precio_usd: Optional[float] = None

class StockPileta(StockPiletaBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class MovimientoPiletaBase(BaseModel):
    tipo: str
    cantidad: int
    descripcion: Optional[str] = None

class MovimientoPiletaCreate(MovimientoPiletaBase):
    pileta_id: Optional[int] = None

class MovimientoPileta(MovimientoPiletaBase):
    id: int
    pileta_id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
