from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


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
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)


class Material(Base):
    __tablename__ = "materials"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category_id: Mapped[int] = mapped_column(ForeignKey("material_categories.id"), nullable=False)
    color: Mapped[str] = mapped_column(String(100), nullable=True)
    available_thickness: Mapped[str] = mapped_column(String(100), nullable=True)
    base_price: Mapped[float] = mapped_column(Float, default=0.0)
    price_usd: Mapped[float] = mapped_column(Float, default=0.0)
    currency: Mapped[str] = mapped_column(String(5), default="ARS")
    supplier: Mapped[str] = mapped_column(String(200), nullable=True)
    stock_available: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    category = relationship("MaterialCategory", back_populates="materials")
    price_history = relationship("PriceHistory", back_populates="material", cascade="all, delete-orphan")
