from pydantic import BaseModel
from typing import Optional, Any, List
from datetime import datetime

class FabricacionDetalle(BaseModel):
    concepto: str = ""
    detalle: str = ""
    concepto_personalizado: Optional[str] = None
    material: Optional[str] = None
    material_precio_m2: Optional[float] = 0
    largo: Optional[float] = 0
    ancho: Optional[float] = 0
    m2: Optional[float] = 0
    mano_de_obra: Optional[float] = 0
    moneda: str = "ARS"
    cantidad: int = 1
    precio: Optional[float] = 0

class OrdenTrabajoBase(BaseModel):
    cliente_id: Optional[int] = None
    cliente_nombre: Optional[str] = None
    cliente_telefono_orden: Optional[str] = None
    presupuesto_id: Optional[int] = None
    origen: Optional[str] = "Manual"
    fecha: Optional[datetime] = None
    domicilio: Optional[str] = None
    email: Optional[str] = None
    croquis: Optional[Any] = None
    material: Optional[str] = None
    material_precio_m2: float = 0
    tipo_cambio: Optional[float] = 1000
    materiales: Optional[List[Any]] = None
    color_tipo: Optional[str] = None
    espesor: Optional[str] = None
    acabado: Optional[str] = None
    bacha: Optional[str] = None
    anafe: Optional[str] = None
    observaciones_diseno: Optional[str] = None
    detalles_fabricacion: Optional[List[FabricacionDetalle]] = None
    detalles_presupuestados: Optional[List[FabricacionDetalle]] = None
    pileta_id: Optional[int] = None
    pileta_precio: float = 0
    pileta_moneda: Optional[str] = "ARS"
    pileta_imagen: Optional[str] = None
    stock_descontado: Optional[bool] = False
    piletas: Optional[List[Any]] = None
    adicionales: Optional[List[Any]] = None
    subtotal: Optional[float] = 0
    traslado: Optional[float] = 0
    instalacion: Optional[float] = 0
    descuento: Optional[float] = 0
    total: Optional[float] = 0
    sena_recibida: Optional[float] = 0
    sena_moneda: Optional[str] = "ARS"
    saldo_pendiente: Optional[float] = 0
    forma_pago: Optional[str] = None
    cuotas: Optional[int] = None
    saldo_pagado: Optional[bool] = False
    fecha_pago_saldo: Optional[datetime] = None
    dolar_dia: Optional[float] = 1000
    subtotal_usd: Optional[float] = 0
    traslado_usd: Optional[float] = 0
    total_usd: Optional[float] = 0
    sena_usd: Optional[float] = 0
    saldo_pendiente_usd: Optional[float] = 0
    fecha_entrega: Optional[datetime] = None
    prioridad: Optional[str] = "Normal"
    firma_cliente: Optional[str] = None
    fecha_aprobacion: Optional[datetime] = None
    observaciones: Optional[str] = None
    observaciones_importantes: Optional[str] = None

class OrdenTrabajoCreate(OrdenTrabajoBase):
    pass

class OrdenTrabajoUpdate(BaseModel):
    estado: Optional[str] = None
    cliente_id: Optional[int] = None
    cliente_nombre: Optional[str] = None
    cliente_telefono_orden: Optional[str] = None
    fecha: Optional[datetime] = None
    domicilio: Optional[str] = None
    email: Optional[str] = None
    croquis: Optional[Any] = None
    material: Optional[str] = None
    material_precio_m2: float = 0
    tipo_cambio: Optional[float] = None
    materiales: Optional[List[Any]] = None
    color_tipo: Optional[str] = None
    espesor: Optional[str] = None
    acabado: Optional[str] = None
    bacha: Optional[str] = None
    anafe: Optional[str] = None
    observaciones_diseno: Optional[str] = None
    detalles_fabricacion: Optional[List[FabricacionDetalle]] = None
    detalles_presupuestados: Optional[List[FabricacionDetalle]] = None
    pileta_id: Optional[int] = None
    pileta_precio: float = 0
    pileta_moneda: Optional[str] = None
    pileta_imagen: Optional[str] = None
    stock_descontado: Optional[bool] = None
    subtotal: Optional[float] = None
    traslado: Optional[float] = None
    instalacion: Optional[float] = None
    descuento: Optional[float] = None
    total: Optional[float] = None
    sena_recibida: Optional[float] = None
    sena_moneda: Optional[str] = None
    saldo_pendiente: Optional[float] = None
    forma_pago: Optional[str] = None
    cuotas: Optional[int] = None
    saldo_pagado: Optional[bool] = None
    fecha_pago_saldo: Optional[datetime] = None
    dolar_dia: Optional[float] = None
    subtotal_usd: Optional[float] = None
    traslado_usd: Optional[float] = None
    total_usd: Optional[float] = None
    sena_usd: Optional[float] = None
    saldo_pendiente_usd: Optional[float] = None
    fecha_entrega: Optional[datetime] = None
    prioridad: Optional[str] = None
    firma_cliente: Optional[str] = None
    fecha_aprobacion: Optional[datetime] = None
    observaciones: Optional[str] = None
    observaciones_importantes: Optional[str] = None
    piletas: Optional[List[Any]] = None

class OrdenTrabajo(OrdenTrabajoBase):
    id: int
    numero: str
    estado: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    cliente_nombre: Optional[str] = None
    cliente_telefono: Optional[str] = None
    presupuesto_numero: Optional[str] = None

    class Config:
        from_attributes = True
