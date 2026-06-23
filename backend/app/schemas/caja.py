from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime


class MovimientoCajaBase(BaseModel):
    tipo: str  # INGRESO / EGRESO
    monto: float
    concepto: Optional[str] = ""
    forma_pago: Optional[str] = None
    estado_carpeta: Optional[str] = None
    orden_id: Optional[int] = None
    orden_numero: Optional[str] = None
    orden_total: Optional[float] = None
    cliente_nombre: Optional[str] = None
    tipo_egreso: Optional[str] = None
    saldo_restante: Optional[float] = None


class MovimientoCajaCreate(MovimientoCajaBase):
    fecha: date


class MovimientoCajaUpdate(BaseModel):
    monto: Optional[float] = None
    concepto: Optional[str] = None
    forma_pago: Optional[str] = None
    estado_carpeta: Optional[str] = None
    tipo_egreso: Optional[str] = None


class MovimientoCaja(MovimientoCajaBase):
    id: int
    caja_id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CajaDiariaBase(BaseModel):
    fecha: date
    saldo_anterior: float = 0


class CajaDiariaResponse(BaseModel):
    id: int
    fecha: date
    saldo_anterior: float
    total_ingresos: float
    total_salidas: float
    suma: float
    saldo_actual: float
    efectivo_real: float
    cerrada: bool = False
    observaciones: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    movimientos: List[MovimientoCaja] = []

    class Config:
        from_attributes = True


class SaldoAnteriorUpdate(BaseModel):
    fecha: date
    saldo_anterior: float


class CerrarCajaRequest(BaseModel):
    fecha: date
    observaciones: Optional[str] = None
