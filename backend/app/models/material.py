from sqlalchemy import Column, Integer, String, Text, DateTime, Float
from app.database import Base
import datetime

class Material(Base):
    __tablename__ = "materiales"
    
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(255), nullable=False)
    categoria = Column(String(50))  # Granitos, Cuarzos, Sinterizados, Mármoles
    color = Column(String(255))
    espesor_disponible = Column(String(100))
    precio_m2 = Column(Float, default=0)
    precio_m2_usd = Column(Float, default=0)
    moneda = Column(String(5), default="ARS")  # ARS o USD
    proveedor = Column(String(255))
    stock_disponible = Column(Integer, default=0)
    observaciones = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
