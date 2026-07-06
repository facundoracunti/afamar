from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Measurement(Base):
    __tablename__ = "measurements"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    client_name: Mapped[str] = mapped_column(String(200), nullable=True)
    client_phone: Mapped[str] = mapped_column(String(50), nullable=True)
    client_address: Mapped[str] = mapped_column(Text, nullable=True)
    scheduled_date: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    scheduled_time: Mapped[str] = mapped_column(String(10), nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    sketch_data: Mapped[str] = mapped_column(Text, nullable=True)
    photos_data: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="PENDING")

    # Optional link to the work order this medición was created for.
    # Nullable so legacy rows (and standalone mediciones) keep working.
    work_order_id: Mapped[int | None] = mapped_column(
        ForeignKey("work_orders.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
