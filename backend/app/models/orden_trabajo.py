from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from app.database import Base
import datetime

class OrdenTrabajo(Base):
    __tablename__ = "ordenes_trabajo"

    id = Column(Integer, primary_key=True, index=True)
    numero = Column(String(20), unique=True, index=True)
    # MEDICION, TALLER, TERMINADA, ENTREGADA
    estado = Column(String(30), default="MEDICION")
    # Presupuestado, Aprobado, Producción, Terminado, Entregado, Cancelado

    # Origen
    presupuesto_id = Column(Integer, ForeignKey("presupuestos.id"), nullable=True)
    origen = Column(String(20), default="Manual")

    # Cliente
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=True)
    cliente_nombre = Column(String(255))
    cliente_telefono_orden = Column(String(100))
    fecha = Column(DateTime)
    domicilio = Column(Text)
    email = Column(String(255))

    # Datos del presupuesto (se copian)
    croquis = Column(JSON, default=list)
    material = Column(String(255))
    material_precio_m2 = Column(Float, default=0)
    materiales = Column(JSON, default=list)
    tipo_cambio = Column(Float, default=1000)
    color_tipo = Column(String(255))
    espesor = Column(String(50))
    acabado = Column(String(50))
    bacha = Column(String(255))
    anafe = Column(String(255))
    observaciones_diseno = Column(Text)

    # Detalle de fabricación
    detalles_fabricacion = Column(JSON, default=list)
    detalles_presupuestados = Column(JSON, default=list)

    # Pileta
    pileta_id = Column(Integer, ForeignKey("stock_piletas.id"), nullable=True)
    pileta_precio = Column(Float, default=0)
    pileta_moneda = Column(String(5), default="ARS")
    pileta_imagen = Column(Text)
    stock_descontado = Column(Boolean, default=False)
    piletas = Column(JSON, default=list)
    adicionales = Column(JSON, default=list)

    # Comercial
    prioridad = Column(String(20), default="Normal")
    subtotal = Column(Float, default=0)
    traslado = Column(Float, default=0)
    instalacion = Column(Float, default=0)
    descuento = Column(Float, default=0)
    total = Column(Float, default=0)
    sena_recibida = Column(Float, default=0)
    sena_moneda = Column(String(5), default="ARS")
    saldo_pendiente = Column(Float, default=0)
    saldo_pagado = Column(Boolean, default=False)
    fecha_pago_saldo = Column(DateTime, nullable=True)
    forma_pago = Column(String(255))
    cuotas = Column(Integer, default=1)
    dolar_dia = Column(Float, default=1000)
    subtotal_usd = Column(Float, default=0)
    traslado_usd = Column(Float, default=0)
    total_usd = Column(Float, default=0)
    sena_usd = Column(Float, default=0)
    saldo_pendiente_usd = Column(Float, default=0)
    fecha_entrega = Column(DateTime)

    # Firma digital (canvas data URL)
    firma_cliente = Column(Text)
    fecha_aprobacion = Column(DateTime)

    # Observaciones
    observaciones = Column(Text)
    observaciones_importantes = Column(Text)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    cliente = relationship("Cliente", back_populates="ordenes")
    presupuesto = relationship("Presupuesto", back_populates="orden_trabajo")
