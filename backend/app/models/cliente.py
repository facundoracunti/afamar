from sqlalchemy import Column, Integer, String, Text, DateTime, Float
from sqlalchemy.orm import relationship
from app.database import Base
import datetime

class Cliente(Base):
    __tablename__ = "clientes"
    
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(255), nullable=False, index=True)
    telefono = Column(String(50), index=True)
    email = Column(String(255))
    direccion = Column(String(255), index=True)
    observaciones = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    presupuestos = relationship("Presupuesto", back_populates="cliente", cascade="all, delete-orphan")
    ordenes = relationship("OrdenTrabajo", back_populates="cliente", cascade="all, delete-orphan")
