from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class WorkOrderPoolRequirement(Base):
    """Physical pool demand and allocation history for one work order."""

    __tablename__ = "work_order_pool_requirements"
    __table_args__ = (
        UniqueConstraint(
            "work_order_id",
            "pool_key",
            name="uq_work_order_pool_requirement_key",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    # Nullable on delete so the requirement and movement audit survive an OT
    # deletion after an explicit recovery decision.
    work_order_id: Mapped[int | None] = mapped_column(
        ForeignKey("work_orders.id", ondelete="SET NULL"), nullable=True, index=True
    )
    work_order_number: Mapped[str] = mapped_column(String(20), nullable=False)
    pool_id: Mapped[int | None] = mapped_column(
        ForeignKey("pool_stock.id", ondelete="SET NULL"), nullable=True, index=True
    )
    pool_key: Mapped[str] = mapped_column(String(255), nullable=False)
    pool_snapshot: Mapped[str] = mapped_column(Text, nullable=True)
    required_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    # This is cumulative physical allocation history. It is intentionally not
    # zeroed on cancellation; recovery fields preserve the audit trail.
    allocated_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    recovered_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unrecovered_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="OPEN")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    work_order = relationship("WorkOrder", back_populates="pool_requirements")
    pool = relationship("PoolStock")

    @property
    def pending_quantity(self) -> int:
        return max(0, self.required_quantity - self.allocated_quantity)
