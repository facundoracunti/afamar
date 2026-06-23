from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class PresupuestoOnlineItem(BaseModel):
    detalle: str = "LONGITUD"
    largo: float = 0
    ancho: float = 0
    m2: float = 0
    es_unidad: bool = False
    moneda: str = "ARS"
    mano_de_obra: float = 0
    cantidad: int = 1
    precio_unitario: float = 0
    subtotal: float = 0
    material: str = ""
    pileta_id: Optional[int] = None
    opcion: int = 0

class PresupuestoOnlineBase(BaseModel):
    cliente: Optional[str] = None
    telefono: Optional[str] = None
    tipo_obra: Optional[str] = None
    fecha: Optional[str] = None
    estado: Optional[str] = "ONLINE"
    dolar_dia: float = 1000
    items: List[PresupuestoOnlineItem] = []
    total_neto_ars: float = 0
    total_neto_usd: float = 0
    total_consolidado: float = 0
    pileta_id: Optional[int] = None
    pileta_precio: float = 0

class PresupuestoOnlineCreate(PresupuestoOnlineBase):
    pass

class PresupuestoOnlineUpdate(BaseModel):
    cliente: Optional[str] = None
    tipo_obra: Optional[str] = None
    fecha: Optional[str] = None
    estado: Optional[str] = None
    dolar_dia: Optional[float] = None
    items: Optional[List[PresupuestoOnlineItem]] = None
    total_neto_ars: Optional[float] = None
    total_neto_usd: Optional[float] = None
    total_consolidado: Optional[float] = None
    pileta_id: Optional[int] = None
    pileta_precio: Optional[float] = None

class PresupuestoOnline(PresupuestoOnlineBase):
    id: int
    numero: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
