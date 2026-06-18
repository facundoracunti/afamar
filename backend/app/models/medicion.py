from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from app.database import Base
import datetime

class Medicion(Base):
    __tablename__ = "mediciones"

    id = Column(Integer, primary_key=True, index=True)
    cliente_nombre = Column(String(255))
    cliente_telefono = Column(String(50))
    cliente_direccion = Column(String(255))
    fecha_programada = Column(DateTime)
    hora_programada = Column(String(10))
    observaciones = Column(Text)
    croquis = Column(JSON, default=list)
    fotos = Column(JSON, default=list)
    estado = Column(String(20), default="PENDIENTE")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
