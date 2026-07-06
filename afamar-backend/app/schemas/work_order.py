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
    # Optional per-work-order term overrides (JSON list, may be empty string).
    delivery_terms_override: str | None = ""
    warranty_override: str | None = ""
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

    @classmethod
    def from_orm_with_client(cls, order) -> "WorkOrderResponse":
        """Build a response from a WorkOrder ORM row, populating client_*
        from the related Client (JOIN). The WorkOrder model has no
        client_name column — only client_id — so without this helper the
        response would have client_name=None."""
        data = cls.model_validate(order).model_dump()
        client = getattr(order, "client", None)
        if client:
            data["client_name"] = client.name or data.get("client_name") or ""
            data["client_phone"] = client.phone or data.get("client_phone") or ""
            data["client_email"] = client.email or data.get("client_email") or ""
            data["client_address"] = client.address or data.get("client_address") or ""
        return cls.model_validate(data)

