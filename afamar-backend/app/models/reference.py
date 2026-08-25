from sqlalchemy import Integer, String, Boolean, DateTime, Float, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Currency(Base):
    """Canonical currency catalogue.

    Anything that carries a price in the system (materials, pool stock,
    fabrication details, etc.) points at one of these rows via a
    `currency_id` FK. The model's `symbol` and `name` are the single
    source of truth for display — never hardcode "ARS" / "USD" /
    "$" / "USD " in the form or PDF code. Add a row here to support
    a new currency (e.g. BRL, EUR) and every consumer follows
    automatically."""

    __tablename__ = "currencies"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    # The 3-letter ISO-4217-style code (or whatever short identifier the
    # business uses). Unique so the lookup-by-code in the service layer
    # is a single-row query.
    code: Mapped[str] = mapped_column(String(5), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    symbol: Mapped[str] = mapped_column(String(10), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    materials = relationship("Material", back_populates="currency_obj")
    pool_stock = relationship("PoolStock", back_populates="currency_obj")


class BudgetStatus(Base):
    __tablename__ = "budget_statuses"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(20), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    budgets = relationship("Budget", back_populates="status_obj")


class WorkOrderStatus(Base):
    __tablename__ = "work_order_statuses"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(20), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    work_orders = relationship("WorkOrder", back_populates="status_obj")


class PaymentMethod(Base):
    """Payment-method catalogue.

    Powers the form's "Forma de pago" `<select>` (one row per
    active method) and the live total calculation in
    `useBudgetCalculations` / `buildPdfData`. Each row carries its
    own `type` / `value` / `is_percentage` / `applies_to_installments`
    so the form has zero per-method hardcoded rules.

    - `type`: `DISCOUNT` (subtracts from total) or `SURCHARGE` (adds).
      `NONE` → the row is just a label (no auto-calculation).
    - `value`: raw amount; interpreted as a percentage when
      `is_percentage=True`, otherwise as a fixed ARS amount.
    - `applies_to_installments`: when True, the live form multiplies
      the value by the selected installment count (legacy
      credit-card rule: 5% per cuota for N >= 3).
    """

    __tablename__ = "payment_methods"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    # Calculation fields. Added by migration b3c4d5e6f7a9 with
    # safe defaults so legacy rows that predate the columns keep
    # behaving as `type=NONE value=0` until the seeder syncs them.
    type: Mapped[str] = mapped_column(String(20), nullable=False, default="NONE", server_default="NONE")
    value: Mapped[float] = mapped_column(Float, nullable=False, default=0.0, server_default="0")
    is_percentage: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    applies_to_installments: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")

    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    budgets = relationship("Budget", back_populates="payment_method_obj")
    work_orders = relationship("WorkOrder", back_populates="payment_method_obj")


class PriorityLevel(Base):
    __tablename__ = "priority_levels"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String(50), nullable=False)
    color: Mapped[str] = mapped_column(String(20), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    budgets = relationship("Budget", back_populates="priority_obj")
    work_orders = relationship("WorkOrder", back_populates="priority_obj")


class FinishType(Base):
    __tablename__ = "finish_types"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    budgets = relationship("Budget", back_populates="finish_obj")
    work_orders = relationship("WorkOrder", back_populates="finish_obj")