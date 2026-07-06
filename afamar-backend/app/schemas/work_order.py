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

    @classmethod
    def from_orm_with_snapshot(cls, order) -> "WorkOrderResponse":
        """Build a response from a WorkOrder ORM row, populating the
        legacy `client_*` fields from `snapshot_*` so list/create/get
        endpoints stay consistent.

        The WorkOrder model only stores `snapshot_name / snapshot_phone /
        snapshot_email / snapshot_address` — there are no `client_*` columns.
        `WorkOrderBase` declares those fields for the inbound payload (the
        frontend sends them on POST), but Pydantic only fills them from the
        ORM if those attributes exist. This helper closes the gap so
        `GET /work-orders/{id}` and the PDF preview see a complete client
        snapshot without round-tripping through Clients.
        """
        data: dict = {
            "id": order.id,
            "number": order.number,
            "client_id": order.client_id,
            "budget_id": order.budget_id,
            "status": order.status,
            "origin": order.origin,
            "stock_deducted": bool(getattr(order, "stock_deducted", False)),
            "balance_paid": bool(getattr(order, "balance_paid", False)),
            "material": order.material,
            "material_price_m2": order.material_price_m2 or 0.0,
            "materials_data": order.materials_data,
            "color": order.color,
            "thickness": order.thickness,
            "finish": order.finish,
            "bacha": order.bacha,
            "anafe": order.anafe,
            "currency": order.currency or "ARS",
            "usd_rate": order.usd_rate or 0.0,
            "subtotal": order.subtotal or 0.0,
            "transport": order.transport or 0.0,
            "installation": order.installation or 0.0,
            "discount": order.discount or 0.0,
            "discount_percentage": order.discount_percentage or 0.0,
            "discount_fixed_amount": order.discount_fixed_amount or 0.0,
            "total": order.total or 0.0,
            "subtotal_usd": order.subtotal_usd or 0.0,
            "transport_usd": order.transport_usd or 0.0,
            "total_usd": order.total_usd or 0.0,
            "deposit_received": order.deposit_received or 0.0,
            "deposit_currency": order.deposit_currency or "ARS",
            "deposit_usd": order.deposit_usd or 0.0,
            "balance_due": order.balance_due or 0.0,
            "balance_due_usd": order.balance_due_usd or 0.0,
            "payment_method": order.payment_method,
            "installments": order.installments or 1,
            "priority": order.priority or "NORMAL",
            "delivery_date": order.delivery_date,
            "digital_signature": order.digital_signature,
            "fabrication_details": order.fabrication_details,
            "budgeted_details": order.budgeted_details,
            "balance_paid_at": getattr(order, "balance_paid_at", None),
            "signed_at": getattr(order, "signed_at", None),
            "pool_id": order.pool_id,
            "pool_price": order.pool_price or 0.0,
            "pool_currency": order.pool_currency or "ARS",
            "pool_image": order.pool_image,
            "pools_data": order.pools_data,
            "adicionales_data": getattr(order, "adicionales_data", None),
            "design_observations": order.design_observations,
            "important_observations": order.important_observations,
            "notes": order.notes,
            "delivery_terms_override": getattr(order, "delivery_terms_override", ""),
            "warranty_override": getattr(order, "warranty_override", ""),
            "snapshot_name": order.snapshot_name,
            "snapshot_phone": order.snapshot_phone,
            "snapshot_email": order.snapshot_email,
            "snapshot_address": order.snapshot_address,
            "date": order.date,
            "created_at": order.created_at,
            "updated_at": order.updated_at,
        }
        # Populate legacy client_* fields from the snapshot so the frontend
        # keeps showing them. New snapshots are always populated; legacy
        # rows from before that fix stay empty (and the frontend falls back
        # to the live Client cache when snapshot is missing).
        data["client_name"] = order.snapshot_name
        data["client_phone"] = order.snapshot_phone
        data["client_email"] = order.snapshot_email
        data["client_address"] = order.snapshot_address
        return cls.model_validate(data)

