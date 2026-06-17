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

class PresupuestoItemSchema(BaseModel):
    id: Optional[int] = None
    sector: Optional[str] = None
    unidad_largo: Optional[str] = "cm"
    unidad_ancho: Optional[str] = "cm"
    largo: Optional[float] = 0
    ancho: Optional[float] = 0
    m2: Optional[float] = 0
    cantidad: Optional[int] = 1
    precio_m2: Optional[float] = 0
    subtotal: Optional[float] = 0

class PresupuestoAdicionalSchema(BaseModel):
    id: Optional[int] = None
    concepto: Optional[str] = None
    detalle: Optional[str] = None
    cantidad: Optional[int] = 1
    precio_unitario: Optional[float] = 0
    subtotal: Optional[float] = 0

class PresupuestoBase(BaseModel):
    cliente_id: Optional[int] = None
    croquis: Optional[Any] = None
    material: Optional[str] = None
    material_precio_m2: Optional[float] = 0
    material_precio_m2_usd: Optional[float] = 0
    color_tipo: Optional[str] = None
    materiales: Optional[List[Any]] = None
    espesor: Optional[str] = None
    frente: Optional[str] = None
    terminacion: Optional[str] = None
    bacha: Optional[str] = None
    anafe: Optional[str] = None
    moneda: Optional[str] = "ARS"
    tipo_cambio: Optional[float] = 1
    subtotal_materiales: Optional[float] = 0
    subtotal_servicios: Optional[float] = 0
    total: Optional[float] = 0
    forma_pago: Optional[str] = None
    validez: Optional[str] = "10 días"
    entrega_aproximada: Optional[str] = None
    fecha_estimada_entrega: Optional[datetime] = None
    condiciones_comerciales: Optional[str] = None
    observaciones: Optional[str] = None
    items: Optional[List[PresupuestoItemSchema]] = []
    adicionales: Optional[List[PresupuestoAdicionalSchema]] = []
    # === Nuevos campos ===
    cliente_nombre: Optional[str] = None
    cliente_telefono_orden: Optional[str] = None
    email: Optional[str] = None
    domicilio: Optional[str] = None
    fecha: Optional[datetime] = None
    prioridad: Optional[str] = "Normal"
    subtotal: Optional[float] = 0
    traslado: Optional[float] = 0
    instalacion: Optional[float] = 0
    descuento: Optional[float] = 0
    sena_recibida: Optional[float] = 0
    saldo_pendiente: Optional[float] = 0
    saldo_pagado: Optional[bool] = False
    fecha_pago_saldo: Optional[datetime] = None
    dolar_dia: Optional[float] = 1000
    subtotal_usd: Optional[float] = 0
    traslado_usd: Optional[float] = 0
    total_usd: Optional[float] = 0
    sena_usd: Optional[float] = 0
    saldo_pendiente_usd: Optional[float] = 0
    fecha_entrega: Optional[datetime] = None
    firma_cliente: Optional[str] = None
    fecha_aprobacion: Optional[datetime] = None
    observaciones_diseno: Optional[str] = None
    observaciones_importantes: Optional[str] = None
    detalles_fabricacion: Optional[List[FabricacionDetalle]] = None
    pileta_id: Optional[int] = None
    pileta_precio: float = 0
    pileta_moneda: Optional[str] = "ARS"
    pileta_imagen: Optional[str] = None
    stock_descontado: Optional[bool] = False
    piletas: Optional[List[Any]] = None
    acabado: Optional[str] = None

class PresupuestoCreate(PresupuestoBase):
    pass

class PresupuestoUpdate(BaseModel):
    estado: Optional[str] = None
    croquis: Optional[Any] = None
    material: Optional[str] = None
    material_precio_m2: Optional[float] = None
    material_precio_m2_usd: Optional[float] = None
    color_tipo: Optional[str] = None
    materiales: Optional[List[Any]] = None
    espesor: Optional[str] = None
    frente: Optional[str] = None
    terminacion: Optional[str] = None
    bacha: Optional[str] = None
    anafe: Optional[str] = None
    moneda: Optional[str] = None
    tipo_cambio: Optional[float] = None
    subtotal_materiales: Optional[float] = None
    subtotal_servicios: Optional[float] = None
    total: Optional[float] = None
    forma_pago: Optional[str] = None
    validez: Optional[str] = None
    entrega_aproximada: Optional[str] = None
    fecha_estimada_entrega: Optional[datetime] = None
    condiciones_comerciales: Optional[str] = None
    observaciones: Optional[str] = None
    cliente_id: Optional[int] = None
    items: Optional[List[PresupuestoItemSchema]] = None
    adicionales: Optional[List[PresupuestoAdicionalSchema]] = None
    # === Nuevos campos ===
    cliente_nombre: Optional[str] = None
    cliente_telefono_orden: Optional[str] = None
    email: Optional[str] = None
    domicilio: Optional[str] = None
    fecha: Optional[datetime] = None
    prioridad: Optional[str] = None
    subtotal: Optional[float] = None
    traslado: Optional[float] = None
    instalacion: Optional[float] = None
    descuento: Optional[float] = None
    sena_recibida: Optional[float] = None
    saldo_pendiente: Optional[float] = None
    saldo_pagado: Optional[bool] = None
    fecha_pago_saldo: Optional[datetime] = None
    dolar_dia: Optional[float] = None
    subtotal_usd: Optional[float] = None
    traslado_usd: Optional[float] = None
    total_usd: Optional[float] = None
    sena_usd: Optional[float] = None
    saldo_pendiente_usd: Optional[float] = None
    fecha_entrega: Optional[datetime] = None
    firma_cliente: Optional[str] = None
    fecha_aprobacion: Optional[datetime] = None
    observaciones_diseno: Optional[str] = None
    observaciones_importantes: Optional[str] = None
    detalles_fabricacion: Optional[List[FabricacionDetalle]] = None
    pileta_id: Optional[int] = None
    pileta_precio: float = 0
    pileta_moneda: Optional[str] = None
    pileta_imagen: Optional[str] = None
    stock_descontado: Optional[bool] = None
    acabado: Optional[str] = None

class Presupuesto(PresupuestoBase):
    id: int
    numero: str
    estado: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    cliente_nombre: Optional[str] = None
    cliente_telefono: Optional[str] = None
    cliente_email: Optional[str] = None
    cliente_direccion: Optional[str] = None
    orden_trabajo_numero: Optional[str] = None

    class Config:
        from_attributes = True
