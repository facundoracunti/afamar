from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class DailyCash(Base):
    __tablename__ = "daily_cash"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    opened_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    previous_balance: Mapped[float] = mapped_column(Float, default=0.0)
    total_income: Mapped[float] = mapped_column(Float, default=0.0)
    total_expenses: Mapped[float] = mapped_column(Float, default=0.0)
    total_sum: Mapped[float] = mapped_column(Float, default=0.0)
    current_balance: Mapped[float] = mapped_column(Float, default=0.0)
    real_cash: Mapped[float] = mapped_column(Float, default=0.0)
    is_closed: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())

    movements: Mapped[list["CashMovement"]] = relationship(
        back_populates="daily_cash", cascade="all, delete-orphan",
        order_by="CashMovement.created_at",
    )


class CashMovement(Base):
    __tablename__ = "cash_movements"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    daily_cash_id: Mapped[int] = mapped_column(ForeignKey("daily_cash.id"), nullable=False)

    type: Mapped[str] = mapped_column(String(10), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    # Native currency of `amount`: 'ARS' (default) or 'USD'. `amount_ars`
    # carries the ARS equivalent of a USD movement (amount × usd_rate) so
    # the box totals (income/expenses/balance/real_cash) stay ARS-consistent
    # even when the operator registers a payment in dólar billete (USD).
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="ARS", server_default="ARS")
    amount_ars: Mapped[float | None] = mapped_column(Float, nullable=True)
    usd_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    description: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    order_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    order_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    order_total: Mapped[float | None] = mapped_column(Float, nullable=True)
    client_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    payment_method: Mapped[str | None] = mapped_column(String(50), nullable=True)
    folder_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    remaining_balance: Mapped[float | None] = mapped_column(Float, nullable=True)

    expense_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # Checkout URL generated for Payway / Mercado Pago / etc. (text column
    # so it accommodates any gateway's URL length). Populated by
    # POST /payments/payway/checkout when the operator generates a link;
    # the operator may also paste a real gateway URL manually.
    payway_checkout_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    daily_cash: Mapped["DailyCash"] = relationship(back_populates="movements")
