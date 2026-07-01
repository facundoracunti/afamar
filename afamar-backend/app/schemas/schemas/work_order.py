from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.base import BaseResponse


class WorkOrderBase(BaseModel):
    client_id: int | None = None
    client_name: str | None = None
    client_phone: str | None = None
    client_email: str | None = None
    client_address: str | None = None
    budget_id: int | None = None
    material: str | None = None
    material_price_m2: float = 0.0
    materials_data: str | None = None
    color: str | None = None
    thickness: str | None = None
    finish: str | None = None
    bacha: str | None = None
    anafe: str | None = None
    currency: str = "ARS"
    usd_rate: float = 1000.0
    subtotal: float = 0.0
    transport: float = 0.0
    installation: float = 0.0
    discount: float = 0.0
    discount_percentage: float = 0.0
    discount_fixed_amount: float = 0.0
    total: float = 0.0
    subtotal_usd: float = 0.0
    transport_usd: float = 0.0
    total_usd: float = 0.0
    deposit_received: float = 0.0
    deposit_currency: str = "ARS"
    deposit_usd: float = 0.0
    balance_due: float = 0.0
    balance_due_usd: float = 0.0
    payment_method: str | None = None
    installments: int = 1
    priority: str = "NORMAL"
    delivery_date: Optional[date] = None
    digital_signature: str | None = None
    fabrication_details: str | None = None
    budgeted_details: str | None = None
    pool_id: int | None = None
    pool_price: float = 0.0
    pool_currency: str = "ARS"
    pool_image: str | None = None
    pools_data: str | None = None
    adicionales_data: str | None = None
    design_observations: str | None = None
    important_observations: str | None = None
    notes: str | None = None
    snapshot_name: str | None = None
    snapshot_phone: str | None = None
    snapshot_email: str | None = None
    snapshot_address: str | None = None
    date: Optional[datetime] = None


class WorkOrderCreate(WorkOrderBase):
    pass


class WorkOrderUpdate(BaseModel):
    status: str | None = None
    origin: str | None = None
    material: str | None = None
    material_price_m2: float | None = None
    materials_data: str | None = None
    color: str | None = None
    thickness: str | None = None
    finish: str | None = None
    bacha: str | None = None
    anafe: str | None = None
    currency: str | None = None
    usd_rate: float | None = None
    subtotal: float | None = None
    transport: float | None = None
    installation: float | None = None
    discount: float | None = None
    discount_percentage: float | None = None
    discount_fixed_amount: float | None = None
    total: float | None = None
    subtotal_usd: float | None = None
    transport_usd: float | None = None
    total_usd: float | None = None
    deposit_received: float | None = None
    deposit_currency: str | None = None
    deposit_usd: float | None = None
    balance_due: float | None = None
    balance_due_usd: float | None = None
    balance_paid: bool | None = None
    balance_paid_at: Optional[datetime] = None
    payment_method: str | None = None
    installments: int | None = None
    priority: str | None = None
    delivery_date: Optional[date] = None
    digital_signature: str | None = None
    signed_at: Optional[datetime] = None
    fabrication_details: str | None = None
    budgeted_details: str | None = None
    pool_id: int | None = None
    pool_price: float | None = None
    pool_currency: str | None = None
    pool_image: str | None = None
    stock_deducted: bool | None = None
    pools_data: str | None = None
    adicionales_data: str | None = None
    design_observations: str | None = None
    important_observations: str | None = None
    notes: str | None = None
    snapshot_name: str | None = None
    snapshot_phone: str | None = None
    snapshot_email: str | None = None
    snapshot_address: str | None = None
    date: Optional[datetime] = None


class WorkOrderResponse(WorkOrderBase, BaseResponse):
    id: int
    number: str
    status: str
    origin: str
    stock_deducted: bool
    balance_paid: bool
    balance_paid_at: Optional[datetime] = None
    signed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
