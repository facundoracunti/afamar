"""AdditionalWork — global catalogue of add-on items.

Reusable items that can be attached to a budget or work order (e.g.
"Edge polishing", "Delivery", "Engraving"). Operates on the same
`currencies` catalogue as Materials and PoolStock so the wire format
keeps `currency: "ARS"|"USD"` and the service translates to the
`currency_id` FK on save.

Decoupled from `Budget` / `WorkOrder`: the linkage between a budget
and one or more additional works is the `additional_works_data` JSON blob on the
budget/work-order row, which lists additional work ids + quantity. That keeps
this catalogue small and avoids having to migrate legacy `BudgetAdicional`
1-N rows in the same migration.
"""
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.reference import Currency


class AdditionalWork(Base):
    __tablename__ = "additional_works"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    detail: Mapped[str] = mapped_column(Text, nullable=True)
    # Single price column — value is in the currency of the FK below.
    # ARS rows store the ARS price; USD rows store the USD price. The
    # `price_usd` column was dropped during the FK migration because the
    # currency is now the single source of truth for which column the
    # price lives in.
    price: Mapped[float] = mapped_column(Float, default=0.0)
    # FK to the `currencies` catalogue. ondelete='RESTRICT' so the
    # operator can't accidentally drop a currency that's still in use.
    currency_id: Mapped[int] = mapped_column(
        ForeignKey("currencies.id", ondelete="RESTRICT"),
        nullable=False,
        default=1,
    )
    # `type` controls how the row's total is computed at budget save time.
    # - 'flat' (default): total = price * quantity (legacy behavior).
    # - 'frente': labor cost per linear meter is computed from a material's
    #   price per m² using the formula (price_per_m2 * 0.13) + formula_constant.
    #   The store keeps `price` as the default unit price (mostly informational
    #   for the catalogue UI); the budget snapshot freezes the computed value
    #   so historical budgets don't drift if the material price changes.
    type: Mapped[str] = mapped_column(String(50), nullable=False, default="flat", server_default="flat")
    # Only meaningful when type == 'frente'. Defaults to 1.15 to match the
    # business rule at migration time; operators can override per catalogue
    # item from the `/admin/additional-works` UI.
    formula_constant: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    currency_obj = relationship("Currency")
