from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.reference import Currency


class PoolType(Base):
    __tablename__ = "pool_types"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class PoolStock(Base):
    __tablename__ = "pool_stock"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    brand: Mapped[str] = mapped_column(String(200), nullable=False)
    model: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    material: Mapped[str] = mapped_column(String(100), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    # Single price column — the value is in the currency of the FK below.
    # ARS rows store the ARS price; USD rows store the USD price. The
    # service layer converts to the other currency on demand (or the
    # caller passes the usd_rate) so the totals block can show both.
    price: Mapped[float] = mapped_column(Float, default=0.0)
    pool_type_id: Mapped[int] = mapped_column(ForeignKey("pool_types.id"), nullable=True, default=1)
    currency_id: Mapped[int] = mapped_column(
        ForeignKey("currencies.id", ondelete="RESTRICT"),
        nullable=False,
        default=1,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    movements = relationship("StockMovement", back_populates="pool", cascade="all, delete-orphan")
    pool_type = relationship("PoolType")
    currency_obj = relationship("Currency", back_populates="pool_stock")


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    pool_id: Mapped[int] = mapped_column(ForeignKey("pool_stock.id"), nullable=False)
    type: Mapped[str] = mapped_column(String(10), nullable=False)  # entry, exit
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    pool = relationship("PoolStock", back_populates="movements")
