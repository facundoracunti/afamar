from sqlalchemy import Column, Integer, String, Text, DateTime, Date, ForeignKey, Float
from sqlalchemy.orm import relationship
from app.database import Base
import datetime


class CajaDiaria(Base):
    __tablename__ = "caja_diaria"

    id = Column(Integer, primary_key=True, index=True)
    fecha = Column(Date, unique=True, nullable=False, index=True)
    saldo_anterior = Column(Float, default=0)
    total_ingresos = Column(Float, default=0)
    total_salidas = Column(Float, default=0)
    suma = Column(Float, default=0)
    saldo_actual = Column(Float, default=0)
    efectivo_real = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    movimientos = relationship("MovimientoCaja", back_populates="caja", cascade="all, delete-orphan",
                               order_by="MovimientoCaja.created_at")


class MovimientoCaja(Base):
    __tablename__ = "movimientos_caja"

    id = Column(Integer, primary_key=True, index=True)
    caja_id = Column(Integer, ForeignKey("caja_diaria.id"), nullable=False)

    tipo = Column(String(10), nullable=False)  # "INGRESO" o "EGRESO"
    monto = Column(Float, nullable=False)
    concepto = Column(String(255), default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Campos específicos para INGRESO (Entradas vinculadas a órdenes)
    orden_id = Column(Integer, nullable=True)
    orden_numero = Column(String(50), nullable=True)
    orden_total = Column(Float, nullable=True)  # Total original de la orden
    cliente_nombre = Column(String(255), nullable=True)
    forma_pago = Column(String(50), nullable=True)  # Efectivo / Transferencia / Tarjeta
    estado_carpeta = Column(String(50), nullable=True)  # Medición / Taller / Terminada / Entregada
    saldo_restante = Column(Float, nullable=True)  # orden_total - monto (deuda pendiente)

    # Campos específicos para EGRESO (Salidas)
    tipo_egreso = Column(String(50), nullable=True)  # Gasto / Transferencia Banco

    caja = relationship("CajaDiaria", back_populates="movimientos")
