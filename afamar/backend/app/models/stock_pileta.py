from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from app.database import Base
import datetime

class StockPileta(Base):
    __tablename__ = "stock_piletas"
    
    id = Column(Integer, primary_key=True, index=True)
    marca = Column(String(255), index=True)
    modelo = Column(String(255), index=True)
    descripcion = Column(Text)
    material = Column(String(255))
    cantidad = Column(Integer, default=0)
    precio = Column(Float, default=0)
    precio_usd = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    movimientos = relationship("MovimientoPileta", back_populates="pileta", cascade="all, delete-orphan")

class MovimientoPileta(Base):
    __tablename__ = "movimientos_piletas"
    
    id = Column(Integer, primary_key=True, index=True)
    pileta_id = Column(Integer, ForeignKey("stock_piletas.id"), nullable=False)
    tipo = Column(String(10))  # Ingreso, Egreso
    cantidad = Column(Integer, nullable=False)
    descripcion = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    pileta = relationship("StockPileta", back_populates="movimientos")
