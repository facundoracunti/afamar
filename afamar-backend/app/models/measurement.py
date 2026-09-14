from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

# Photos are stored as base64 data-URLs inside a JSON array — a single phone
# photo easily exceeds the 65 KB cap of MySQL TEXT, which truncates silently
# and corrupts the JSON (photos "disappear" on reload). LONGTEXT (4 GB) via a
# MySQL variant keeps SQLite on plain TEXT (unlimited).
_TEXT = Text().with_variant(LONGTEXT(), "mysql")


class Measurement(Base):
    __tablename__ = "measurements"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    client_id: Mapped[int | None] = mapped_column(
        ForeignKey("clients.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    scheduled_date: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    scheduled_time: Mapped[str] = mapped_column(String(10), nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    sketch_data: Mapped[str] = mapped_column(_TEXT, nullable=True)
    photos_data: Mapped[str] = mapped_column(_TEXT, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="PENDING")

    work_order_id: Mapped[int | None] = mapped_column(
        ForeignKey("work_orders.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    client = relationship("Client", back_populates="measurements")
    work_order = relationship("WorkOrder", back_populates="measurement", uselist=False)
