from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.reference import WorkOrderStatus, PaymentMethod, PriorityLevel, FinishType


class WorkOrder(Base):
    __tablename__ = "work_orders"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False)
    budget_id: Mapped[int] = mapped_column(ForeignKey("budgets.id"), nullable=True)

    status: Mapped[str] = mapped_column(String(20), default="MEASUREMENT")
    origin: Mapped[str] = mapped_column(String(30), default="Manual")

    status_id: Mapped[int | None] = mapped_column(ForeignKey("work_order_statuses.id"), nullable=True)
    payment_method_id: Mapped[int | None] = mapped_column(ForeignKey("payment_methods.id"), nullable=True)
    priority_id: Mapped[int | None] = mapped_column(ForeignKey("priority_levels.id"), nullable=True)
    finish_id: Mapped[int | None] = mapped_column(ForeignKey("finish_types.id"), nullable=True)

    material: Mapped[str] = mapped_column(String(200), nullable=True)
    material_price_m2: Mapped[float] = mapped_column(Float, default=0.0)
    materials_data: Mapped[str] = mapped_column(Text, nullable=True)
    color: Mapped[str] = mapped_column(String(100), nullable=True)
    thickness: Mapped[str] = mapped_column(String(50), nullable=True)
    finish: Mapped[str] = mapped_column(String(100), nullable=True)
    bacha: Mapped[str] = mapped_column(String(100), nullable=True)
    anafe: Mapped[str] = mapped_column(String(100), nullable=True)

    currency: Mapped[str] = mapped_column(String(5), default="ARS")
    usd_rate: Mapped[float] = mapped_column(Float, default=1000.0)
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

    priority: Mapped[str] = mapped_column(String(20), default="NORMAL")
    delivery_date: Mapped[date] = mapped_column(Date, nullable=True)

    digital_signature: Mapped[str] = mapped_column(Text, nullable=True)
    signed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    fabrication_details: Mapped[str] = mapped_column(Text, nullable=True)
    budgeted_details: Mapped[str] = mapped_column(Text, nullable=True)
    # JSON-encoded sketch (matches the wire format the frontend sends/receives
    # on `sketch_elements`). Populated from the source budget on conversion so
    # the customer can see the same croquis in the WO form/PDF that they
    # signed on the budget. See `WorkOrderService.create_from_budget`.
    sketch_elements: Mapped[str] = mapped_column(Text, nullable=True)

    pool_id: Mapped[int] = mapped_column(ForeignKey("pool_stock.id"), nullable=True)
    pool_price: Mapped[float] = mapped_column(Float, default=0.0)
    pool_currency: Mapped[str] = mapped_column(String(5), default="ARS")
    pool_image: Mapped[str] = mapped_column(Text, nullable=True)
    stock_deducted: Mapped[bool] = mapped_column(Boolean, default=False)
    pools_data: Mapped[str] = mapped_column(Text, nullable=True)
    adicionales_data: Mapped[str] = mapped_column(Text, nullable=True)

    design_observations: Mapped[str] = mapped_column(Text, nullable=True)
    important_observations: Mapped[str] = mapped_column(Text, nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=True)

    # Optional per-work-order overrides for the PDF terms.
    delivery_terms_override: Mapped[str] = mapped_column(Text, nullable=True)
    warranty_override: Mapped[str] = mapped_column(Text, nullable=True)
    date: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    status_obj: Mapped["WorkOrderStatus"] = relationship("WorkOrderStatus", back_populates="work_orders", foreign_keys=[status_id])
    payment_method_obj: Mapped["PaymentMethod"] = relationship("PaymentMethod", back_populates="work_orders", foreign_keys=[payment_method_id])
    priority_obj: Mapped["PriorityLevel"] = relationship("PriorityLevel", back_populates="work_orders", foreign_keys=[priority_id])
    finish_obj: Mapped["FinishType"] = relationship("FinishType", back_populates="work_orders", foreign_keys=[finish_id])

    client = relationship("Client", back_populates="work_orders")
    budget = relationship("Budget", back_populates="work_order")
    pool = relationship("PoolStock", foreign_keys=[pool_id])
    measurement = relationship("Measurement", back_populates="work_order", uselist=False)
