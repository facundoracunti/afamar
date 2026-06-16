from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class PresupuestoResumen(BaseModel):
    id: int
    numero: str
    cliente_nombre: Optional[str] = None
    total: float = 0
    estado: str = ""
    created_at: Optional[datetime] = None

class OrdenResumen(BaseModel):
    id: int
    numero: str
    cliente_nombre: Optional[str] = None
    total: float = 0
    estado: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class PiletaResumen(BaseModel):
    id: int
    marca: str
    modelo: str
    cantidad: int = 0

class DashboardData(BaseModel):
    presupuestos_pendientes: int = 0
    ordenes_en_medicion: int = 0
    ordenes_en_taller: int = 0
    piletas_en_stock: int = 0
    trabajos_proxima_entrega: int = 0
    total_ordenes_activas: int = 0
    total_presupuestos: int = 0
    total_ordenes: int = 0
    total_ingresos: float = 0
    total_pendiente_cobro: float = 0
    ordenes_entregadas_mes: int = 0
    presupuestos_aprobados_mes: int = 0
    presupuestos_recientes: List[PresupuestoResumen] = []
    ordenes_recientes: List[OrdenResumen] = []
    piletas: List[PiletaResumen] = []
    ordenes_entregadas: List[OrdenResumen] = []
