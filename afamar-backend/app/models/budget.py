from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.reference import BudgetStatus, PaymentMethod, PriorityLevel, FinishType


class Budget(Base):
    __tablename__ = "budgets"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="PENDING")

    material: Mapped[str] = mapped_column(String(200), nullable=True)
    material_price_m2: Mapped[float] = mapped_column(Float, default=0.0)
    material_price_m2_usd: Mapped[float] = mapped_column(Float, default=0.0)
    materials_data: Mapped[str] = mapped_column(Text, nullable=True)
    color: Mapped[str] = mapped_column(String(100), nullable=True)
    thickness: Mapped[str] = mapped_column(String(50), nullable=True)
    front: Mapped[str] = mapped_column(String(100), nullable=True)
    finish: Mapped[str] = mapped_column(String(100), nullable=True)
    bacha: Mapped[str] = mapped_column(String(100), nullable=True)
    anafe: Mapped[str] = mapped_column(String(100), nullable=True)
    perforations: Mapped[str] = mapped_column(String(200), nullable=True)

    currency: Mapped[str] = mapped_column(String(5), default="ARS")
    usd_rate: Mapped[float] = mapped_column(Float, default=1000.0)
    subtotal_materials: Mapped[float] = mapped_column(Float, default=0.0)
    subtotal_services: Mapped[float] = mapped_column(Float, default=0.0)
    subtotal: Mapped[float] = mapped_column(Float, default=0.0)
    transport: Mapped[float] = mapped_column(Float, default=0.0)
    installation: Mapped[float] = mapped_column(Float, default=0.0)
    discount: Mapped[float] = mapped_column(Float, default=0.0)
    discount_percentage: Mapped[float] = mapped_column(Float, default=0.0)
    discount_fixed_amount: Mapped[float] = mapped_column(Float, default=0.0)
    total: Mapped[float] = mapped_column(Float, default=0.0)
    subtotal_usd: Mapped[float] = mapped_column(Float, default=0.0)
    transport_usd: Mapped[float] = mapped_column(Float, default=0.0)
    total_usd: Mapped[float] = mapped_column(Float, default=0.0)
    deposit_received: Mapped[float] = mapped_column(Float, default=0.0)
    deposit_currency: Mapped[str] = mapped_column(String(5), default="ARS")
    deposit_usd: Mapped[float] = mapped_column(Float, default=0.0)
    balance_due: Mapped[float] = mapped_column(Float, default=0.0)
    balance_due_usd: Mapped[float] = mapped_column(Float, default=0.0)
    balance_paid: Mapped[bool] = mapped_column(Boolean, default=False)
    balance_paid_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    payment_method: Mapped[str] = mapped_column(String(50), nullable=True)
    installments: Mapped[int] = mapped_column(Integer, default=1)
    validity_days: Mapped[int] = mapped_column(Integer, default=15)
    estimated_delivery: Mapped[str] = mapped_column(String(100), nullable=True)
    estimated_date: Mapped[date] = mapped_column(Date, nullable=True)

    priority: Mapped[str] = mapped_column(String(20), default="NORMAL")
    date: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    delivery_date: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    # Foreign keys to reference tables
    status_id: Mapped[int | None] = mapped_column(ForeignKey("budget_statuses.id"), nullable=True)
    payment_method_id: Mapped[int | None] = mapped_column(ForeignKey("payment_methods.id"), nullable=True)
    priority_id: Mapped[int | None] = mapped_column(ForeignKey("priority_levels.id"), nullable=True)
    finish_id: Mapped[int | None] = mapped_column(ForeignKey("finish_types.id"), nullable=True)

    # Relationships to reference objects
    status_obj: Mapped["BudgetStatus"] = relationship("BudgetStatus", back_populates="budgets", foreign_keys=[status_id])
    payment_method_obj: Mapped["PaymentMethod"] = relationship("PaymentMethod", back_populates="budgets", foreign_keys=[payment_method_id])
    priority_obj: Mapped["PriorityLevel"] = relationship("PriorityLevel", back_populates="budgets", foreign_keys=[priority_id])
    finish_obj: Mapped["FinishType"] = relationship("FinishType", back_populates="budgets", foreign_keys=[finish_id])

    digital_signature: Mapped[str] = mapped_column(Text, nullable=True)
    signed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    approval_date: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    design_observations: Mapped[str] = mapped_column(Text, nullable=True)
    important_observations: Mapped[str] = mapped_column(Text, nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    fabrication_details: Mapped[str] = mapped_column(Text, nullable=True)

    # Optional per-budget overrides for the PDF terms (stored as JSON list[str]).
    # Empty string = inherit the global terms from /admin/configuration.
    budget_terms_override: Mapped[str] = mapped_column(Text, nullable=True)
    warranty_override: Mapped[str] = mapped_column(Text, nullable=True)

    pool_id: Mapped[int] = mapped_column(ForeignKey("pool_stock.id"), nullable=True)
    pool_price: Mapped[float] = mapped_column(Float, default=0.0)
    pool_currency: Mapped[str] = mapped_column(String(5), default="ARS")
    pool_image: Mapped[str] = mapped_column(Text, nullable=True)
    stock_deducted: Mapped[bool] = mapped_column(Boolean, default=False)
    pools_data: Mapped[str] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    client = relationship("Client", back_populates="budgets")
    items = relationship("BudgetItem", back_populates="budget", cascade="all, delete-orphan")
    adicionales = relationship("BudgetAdicional", back_populates="budget", cascade="all, delete-orphan")
    sketch_elements = relationship("BudgetSketchElement", back_populates="budget", cascade="all, delete-orphan")
    work_order = relationship("WorkOrder", back_populates="budget", uselist=False)
    pool = relationship("PoolStock", foreign_keys=[pool_id])

    @property
    def work_order_id(self) -> int | None:
        return self.work_order.id if self.work_order else None

    @property
    def work_order_number(self) -> str | None:
        return self.work_order.number if self.work_order else None


class BudgetItem(Base):
    __tablename__ = "budget_items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    budget_id: Mapped[int] = mapped_column(ForeignKey("budgets.id"), nullable=False)
    sector: Mapped[str] = mapped_column(String(100), nullable=True)
    description: Mapped[str] = mapped_column(String(300), nullable=False)
    unit_length: Mapped[str] = mapped_column(String(5), default="cm")
    unit_width: Mapped[str] = mapped_column(String(5), default="cm")
    length: Mapped[float] = mapped_column(Float, default=0.0)
    width: Mapped[float] = mapped_column(Float, default=0.0)
    m2: Mapped[float] = mapped_column(Float, default=0.0)
    quantity: Mapped[float] = mapped_column(Float, default=1.0)
    price_m2: Mapped[float] = mapped_column(Float, default=0.0)
    unit_price: Mapped[float] = mapped_column(Float, default=0.0)
    total: Mapped[float] = mapped_column(Float, default=0.0)

    budget = relationship("Budget", back_populates="items")


class BudgetAdicional(Base):
    __tablename__ = "budget_adicionales"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    budget_id: Mapped[int] = mapped_column(ForeignKey("budgets.id"), nullable=False)
    concept: Mapped[str] = mapped_column(String(255), nullable=True)
    detail: Mapped[str] = mapped_column(String(255), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[float] = mapped_column(Float, default=0.0)
    total: Mapped[float] = mapped_column(Float, default=0.0)

    budget = relationship("Budget", back_populates="adicionales")


class BudgetSketchElement(Base):
    __tablename__ = "budget_sketch_elements"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    budget_id: Mapped[int] = mapped_column(ForeignKey("budgets.id"), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    data: Mapped[str] = mapped_column(Text, nullable=True)
    order: Mapped[int] = mapped_column(Integer, default=0)

    budget = relationship("Budget", back_populates="sketch_elements")
