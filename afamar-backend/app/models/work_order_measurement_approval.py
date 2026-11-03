from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class WorkOrderMeasurementApproval(Base):
    """Append-only commercial approval of a measured work-order adjustment."""

    __tablename__ = "work_order_measurement_approvals"

    id: Mapped[int] = mapped_column(primary_key=True)
    work_order_id: Mapped[int] = mapped_column(
        ForeignKey("work_orders.id", ondelete="CASCADE"), index=True, nullable=False
    )
    approved_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
    approved_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    previous_total: Mapped[float] = mapped_column(Float, nullable=False)
    previous_total_usd: Mapped[float] = mapped_column(Float, nullable=False)
    positive_difference_ars: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    negative_difference_ars: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    difference_ars: Mapped[float] = mapped_column(Float, nullable=False)
    difference_usd: Mapped[float] = mapped_column(Float, nullable=False)
    discount_difference_ars: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    new_total: Mapped[float] = mapped_column(Float, nullable=False)
    new_total_usd: Mapped[float] = mapped_column(Float, nullable=False)
    new_total_exact_ars: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    new_total_exact_usd: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    rounding_adjustment_ars: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    rounding_adjustment_usd: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    usd_rate: Mapped[float] = mapped_column(Float, nullable=False)
    measurement_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    measurement_snapshot: Mapped[str] = mapped_column(Text, nullable=False)
    # Nullable for approvals created before the commercial breakdown existed.
    approval_breakdown: Mapped[str | None] = mapped_column(Text, nullable=True)

    work_order = relationship("WorkOrder", back_populates="measurement_approvals")
    approved_by = relationship("User")
