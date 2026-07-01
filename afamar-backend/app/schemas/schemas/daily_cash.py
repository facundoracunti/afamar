from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class CashMovementBase(BaseModel):
    type: str
    amount: float
    description: Optional[str] = ""
    payment_method: Optional[str] = None
    folder_status: Optional[str] = None
    order_id: Optional[int] = None
    order_number: Optional[str] = None
    order_total: Optional[float] = None
    client_name: Optional[str] = None
    expense_type: Optional[str] = None
    remaining_balance: Optional[float] = None


class CashMovementCreate(CashMovementBase):
    date: date


class CashMovementUpdate(BaseModel):
    amount: Optional[float] = None
    description: Optional[str] = None
    payment_method: Optional[str] = None
    folder_status: Optional[str] = None
    expense_type: Optional[str] = None


class CashMovementResponse(CashMovementBase):
    id: int
    daily_cash_id: int
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class DailyCashBase(BaseModel):
    date: date
    previous_balance: float = 0


class DailyCashResponse(BaseModel):
    id: int
    date: date
    previous_balance: float
    total_income: float
    total_expenses: float
    total_sum: float
    current_balance: float
    real_cash: float
    is_closed: bool = False
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    movements: list[CashMovementResponse] = []

    model_config = ConfigDict(from_attributes=True)


class UpdatePreviousBalance(BaseModel):
    date: date
    previous_balance: float


class CloseCashRequest(BaseModel):
    date: date
    notes: Optional[str] = None
