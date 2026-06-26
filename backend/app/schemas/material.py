from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class MaterialBase(BaseModel):
    nombre: str
    categoria: Optional[str] = None
    color: Optional[str] = None
    espesor_disponible: Optional[str] = None
    precio_m2: Optional[float] = 0
    precio_m2_usd: Optional[float] = 0
    moneda: Optional[str] = "ARS"
    proveedor: Optional[str] = None
    stock_disponible: Optional[int] = 0
    foto: Optional[str] = None
    observaciones: Optional[str] = None

class MaterialCreate(MaterialBase):
    pass

class MaterialUpdate(BaseModel):
    nombre: Optional[str] = None
    categoria: Optional[str] = None
    color: Optional[str] = None
    espesor_disponible: Optional[str] = None
    precio_m2: Optional[float] = None
    precio_m2_usd: Optional[float] = None
    moneda: Optional[str] = None
    proveedor: Optional[str] = None
    stock_disponible: Optional[int] = None
    foto: Optional[str] = None
    observaciones: Optional[str] = None

class Material(MaterialBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class PriceHistorySchema(BaseModel):
    id: int
    material_id: int
    material_nombre: Optional[str] = None
    precio_m2: float
    fecha: Optional[datetime] = None

    class Config:
        from_attributes = True
