import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class CashMovementBase(BaseModel):
    type: str
    amount: float
    # Native currency of `amount` ('ARS' or 'USD'). For USD movements
    # `amount_ars`/`usd_rate` carry the conversion so box totals stay ARS.
    currency: str = "ARS"
    amount_ars: Optional[float] = None
    usd_rate: Optional[float] = None
    description: Optional[str] = ""
    payment_method: Optional[str] = None
    folder_status: Optional[str] = None
    order_id: Optional[int] = None
    order_number: Optional[str] = None
    order_total: Optional[float] = None
    client_name: Optional[str] = None
    expense_type: Optional[str] = None
    remaining_balance: Optional[float] = None
    # Optional checkout URL (Payway / Mercado Pago / etc.) attached to the
    # movement. Persists across reloads so the operator can re-share the
    # link with the client via WhatsApp.
    payway_checkout_url: Optional[str] = None


class CashMovementCreate(CashMovementBase):
    # No `date`: the movement always lands on the single currently-open box.
    pass


class CashMovementUpdate(BaseModel):
    amount: Optional[float] = None
    description: Optional[str] = None
    payment_method: Optional[str] = None
    folder_status: Optional[str] = None
    expense_type: Optional[str] = None


class CashMovementResponse(CashMovementBase):
    id: int
    daily_cash_id: int
    created_at: Optional[datetime.datetime] = None

    model_config = ConfigDict(from_attributes=True)


class DailyCashResponse(BaseModel):
    id: int
    number: Optional[int] = None
    opened_at: Optional[datetime.datetime] = None
    closed_at: Optional[datetime.datetime] = None
    previous_balance: float = 0
    total_income: float = 0
    total_expenses: float = 0
    total_sum: float = 0
    current_balance: float = 0
    real_cash: float = 0
    is_closed: bool = False
    notes: Optional[str] = None
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None
    movements: list[CashMovementResponse] = []

    model_config = ConfigDict(from_attributes=True)


class OpenCashRequest(BaseModel):
    previous_balance: float = 0


class UpdatePreviousBalance(BaseModel):
    previous_balance: float = 0


class CloseCashRequest(BaseModel):
    notes: Optional[str] = None


class CashSummary(BaseModel):
    number: Optional[int] = None
    opened_at: Optional[datetime.datetime] = None
    closed_at: Optional[datetime.datetime] = None
    duration_seconds: int = 0
    total_by_payment: dict[str, float] = {}
    ingreso_count: int = 0
    egreso_count: int = 0
    previous_balance: float = 0
    total_income: float = 0
    total_expenses: float = 0
    current_balance: float = 0
    real_cash: float = 0


class CloseCashResponse(BaseModel):
    closed_cash: DailyCashResponse
    summary: CashSummary
    next_cash: DailyCashResponse
