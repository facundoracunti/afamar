from sqlalchemy import Column, Integer, String, Text, DateTime
from app.database import Base
import datetime

class TrabajoRealizado(Base):
    __tablename__ = "trabajos_realizados"

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String(255), nullable=False)
    descripcion = Column(Text, nullable=True)
    foto = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
