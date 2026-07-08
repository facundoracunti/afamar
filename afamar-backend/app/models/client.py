from datetime import datetime

from sqlalchemy import DateTime, Float, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[str] = mapped_column(String(50), nullable=True)
    email: Mapped[str] = mapped_column(String(200), nullable=True)
    address: Mapped[str] = mapped_column(Text, nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    total_purchased: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    budgets = relationship("Budget", back_populates="client")
    work_orders = relationship("WorkOrder", back_populates="client")
    measurements = relationship("Measurement", back_populates="client")
    # 1-N: a client (e.g. architect) can have several delivery addresses
    # for different project sites. See `app/models/client_address.py`.
    addresses = relationship(
        "ClientAddress",
        back_populates="client",
        cascade="all, delete-orphan",
        order_by="ClientAddress.is_default.desc(), ClientAddress.id.asc()",
    )
