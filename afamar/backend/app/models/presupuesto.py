from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from app.database import Base
import datetime

class Presupuesto(Base):
    __tablename__ = "presupuestos"
    
    id = Column(Integer, primary_key=True, index=True)
    numero = Column(String(20), unique=True, index=True)
    estado = Column(String(20), default="PENDIENTE")
    
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    
    croquis = Column(JSON, default=list)
    
    material = Column(String(255))
    material_precio_m2 = Column(Float, default=0)
    material_precio_m2_usd = Column(Float, default=0)
    materiales = Column(JSON, default=list)
    color_tipo = Column(String(255))
    espesor = Column(String(50))
    frente = Column(String(255))
    terminacion = Column(String(255))
    bacha = Column(String(255))
    anafe = Column(String(255))
    moneda = Column(String(5), default="ARS")
    tipo_cambio = Column(Float, default=1)
    
    subtotal_materiales = Column(Float, default=0)
    subtotal_servicios = Column(Float, default=0)
    total = Column(Float, default=0)
    
    forma_pago = Column(String(50))
    cuotas = Column(Integer, default=1)
    validez = Column(String(100), default="10 días")
    entrega_aproximada = Column(String(100))
    fecha_estimada_entrega = Column(DateTime)
    condiciones_comerciales = Column(Text)
    
    observaciones = Column(Text)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    cliente = relationship("Cliente", back_populates="presupuestos")
    orden_trabajo = relationship("OrdenTrabajo", back_populates="presupuesto", uselist=False)
    items = relationship("PresupuestoItem", back_populates="presupuesto", cascade="all, delete-orphan")
    adicionales = relationship("PresupuestoAdicional", back_populates="presupuesto", cascade="all, delete-orphan")
    
    # === Nuevos campos (idénticos a OrdenTrabajo) ===
    cliente_nombre = Column(String(255))
    cliente_telefono_orden = Column(String(50))
    email = Column(String(255))
    domicilio = Column(String(255))
    fecha = Column(DateTime, nullable=True)
    prioridad = Column(String(20), default="Normal")
    subtotal = Column(Float, default=0)
    traslado = Column(Float, default=0)
    instalacion = Column(Float, default=0)
    descuento = Column(Float, default=0)
    sena_recibida = Column(Float, default=0)
    saldo_pendiente = Column(Float, default=0)
    saldo_pagado = Column(Boolean, default=False)
    fecha_pago_saldo = Column(DateTime, nullable=True)
    dolar_dia = Column(Float, default=1000)
    subtotal_usd = Column(Float, default=0)
    traslado_usd = Column(Float, default=0)
    total_usd = Column(Float, default=0)
    sena_usd = Column(Float, default=0)
    saldo_pendiente_usd = Column(Float, default=0)
    fecha_entrega = Column(DateTime, nullable=True)
    firma_cliente = Column(Text, nullable=True)
    fecha_aprobacion = Column(DateTime, nullable=True)
    observaciones_diseno = Column(Text)
    observaciones_importantes = Column(Text)
    detalles_fabricacion = Column(JSON, default=list)
    pileta_id = Column(Integer, ForeignKey("stock_piletas.id"), nullable=True)
    pileta_precio = Column(Float, default=0)
    pileta_moneda = Column(String(5), default="ARS")
    pileta_imagen = Column(Text, nullable=True)
    stock_descontado = Column(Boolean, default=False)
    piletas = Column(JSON, default=list)
    acabado = Column(String(50))


class PresupuestoItem(Base):
    __tablename__ = "presupuesto_items"
    
    id = Column(Integer, primary_key=True, index=True)
    presupuesto_id = Column(Integer, ForeignKey("presupuestos.id"), nullable=False)
    sector = Column(String(100))
    unidad_largo = Column(String(5), default="cm")
    unidad_ancho = Column(String(5), default="cm")
    largo = Column(Float, default=0)
    ancho = Column(Float, default=0)
    m2 = Column(Float, default=0)
    cantidad = Column(Integer, default=1)
    precio_m2 = Column(Float, default=0)
    subtotal = Column(Float, default=0)
    
    presupuesto = relationship("Presupuesto", back_populates="items")


class PresupuestoAdicional(Base):
    __tablename__ = "presupuesto_adicionales"
    
    id = Column(Integer, primary_key=True, index=True)
    presupuesto_id = Column(Integer, ForeignKey("presupuestos.id"), nullable=False)
    concepto = Column(String(255))
    detalle = Column(String(255))
    cantidad = Column(Integer, default=1)
    precio_unitario = Column(Float, default=0)
    subtotal = Column(Float, default=0)
    
    presupuesto = relationship("Presupuesto", back_populates="adicionales")
