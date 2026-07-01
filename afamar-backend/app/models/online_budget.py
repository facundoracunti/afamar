from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class OnlineBudget(Base):
    __tablename__ = "online_budgets"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    client_name: Mapped[str] = mapped_column(String(200), nullable=True)
    phone: Mapped[str] = mapped_column(String(50), nullable=True)
    work_type: Mapped[str] = mapped_column(String(200), nullable=True)
    date: Mapped[str] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="ONLINE")
    usd_rate: Mapped[float] = mapped_column(Float, default=1000.0)
    items_data: Mapped[str] = mapped_column(Text, nullable=True)
    total_net_ars: Mapped[float] = mapped_column(Float, default=0.0)
    total_net_usd: Mapped[float] = mapped_column(Float, default=0.0)
    total_consolidated: Mapped[float] = mapped_column(Float, default=0.0)
    pool_id: Mapped[int] = mapped_column(ForeignKey("pool_stock.id"), nullable=True)
    pool_price: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    pool = relationship("PoolStock", foreign_keys=[pool_id])
