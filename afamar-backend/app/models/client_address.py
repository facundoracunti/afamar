from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ClientAddress(Base):
    """Alternative delivery addresses for a client (e.g. an architect with
    several project sites). The `is_default` row is the one that fills in
    the legacy `Client.address` field for backward compat and is the
    default in any new Budget/WorkOrder that doesn't pick a specific one.

    `ondelete='CASCADE'` removes the addresses automatically when the
    owning client is deleted."""

    __tablename__ = "client_addresses"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    client_id: Mapped[int] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    address: Mapped[str] = mapped_column(Text, nullable=False)
    label: Mapped[str] = mapped_column(String(50), nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(),
    )

    client = relationship("Client", back_populates="addresses")
