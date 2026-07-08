from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.reference import Currency


class MaterialCategory(Base):
    __tablename__ = "material_categories"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)

    materials = relationship("Material", back_populates="category")


class MaterialColor(Base):
    __tablename__ = "material_colors"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    category_id: Mapped[int] = mapped_column(ForeignKey("material_categories.id"), nullable=True)

    category = relationship("MaterialCategory")


class MaterialThickness(Base):
    __tablename__ = "material_thicknesses"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)


class Material(Base):
    __tablename__ = "materials"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category_id: Mapped[int] = mapped_column(ForeignKey("material_categories.id"), nullable=False)
    color: Mapped[str] = mapped_column(String(100), nullable=True)
    available_thickness: Mapped[str] = mapped_column(String(100), nullable=True)
    base_price: Mapped[float] = mapped_column(Float, default=0.0)
    price_usd: Mapped[float] = mapped_column(Float, default=0.0)
    # FK to the `currencies` catalogue. Whichever currency the FK points
    # at tells you which price column is "the price" — `base_price` for
    # ARS rows, `price_usd` for USD rows. The other column is the
    # reference conversion (see the service for the write/read rules).
    currency_id: Mapped[int] = mapped_column(
        ForeignKey("currencies.id", ondelete="RESTRICT"),
        nullable=False,
        default=1,
    )
    supplier: Mapped[str] = mapped_column(String(200), nullable=True)
    stock_available: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    photo: Mapped[str] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    category = relationship("MaterialCategory", back_populates="materials")
    currency_obj = relationship("Currency", back_populates="materials")
    price_history = relationship("PriceHistory", back_populates="material", cascade="all, delete-orphan")
