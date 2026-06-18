from sqlalchemy import Column, Integer, String, Float, Text, DateTime, JSON, ForeignKey
from app.database import Base
import datetime

class PresupuestoOnline(Base):
    __tablename__ = "presupuestos_online"

    id = Column(Integer, primary_key=True, index=True)
    numero = Column(String(20), unique=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    cliente = Column(String(255))
    tipo_obra = Column(String(255))
    fecha = Column(String(50))
    estado = Column(String(30), default="ONLINE")
    dolar_dia = Column(Float, default=1000)
    items = Column(JSON, default=list)
    total_neto_ars = Column(Float, default=0)
    total_neto_usd = Column(Float, default=0)
    total_consolidado = Column(Float, default=0)
    pileta_id = Column(Integer, ForeignKey("stock_piletas.id"), nullable=True)
    pileta_precio = Column(Float, default=0)
