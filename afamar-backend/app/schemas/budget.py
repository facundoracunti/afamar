from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.base import BaseResponse


class BudgetItemBase(BaseModel):
    sector: str | None = None
    description: str = ""
    unit_length: str = "cm"
    unit_width: str = "cm"
    length: float = 0.0
    width: float = 0.0
    m2: float = 0.0
    quantity: float = 1.0
    price_m2: float = 0.0
    unit_price: float = 0.0
    total: float = 0.0


class BudgetItemCreate(BudgetItemBase):
    pass


class BudgetItemResponse(BudgetItemBase, BaseResponse):
    id: int
    budget_id: int


class BudgetAdicionalBase(BaseModel):
    concept: str | None = None
    detail: str | None = None
    quantity: int = 1
    unit_price: float = 0.0
    total: float = 0.0


class BudgetAdicionalCreate(BudgetAdicionalBase):
    pass


class BudgetAdicionalResponse(BudgetAdicionalBase, BaseResponse):
    id: int
    budget_id: int


class BudgetSketchElementBase(BaseModel):
    type: str
    data: str | None = None
    order: int = 0


class BudgetSketchElementCreate(BudgetSketchElementBase):
    pass


class BudgetSketchElementResponse(BudgetSketchElementBase, BaseResponse):
    id: int
    budget_id: int


class BudgetBase(BaseModel):
    client_id: int | None = None
    client_name: str | None = None
    client_phone: str | None = None
    client_email: str | None = None
    client_address: str | None = None
    material: str | None = None
    material_price_m2: float = 0.0
    material_price_m2_usd: float = 0.0
    materials_data: str | None = None
    color: str | None = None
    thickness: str | None = None
    front: str | None = None
    finish: str | None = None
    bacha: str | None = None
    anafe: str | None = None
    perforations: str | None = None

    currency: str = "ARS"
    usd_rate: float = 1000.0
    subtotal_materials: float = 0.0
    subtotal_services: float = 0.0
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
    balance_paid: bool = False
    balance_paid_at: Optional[datetime] = None
    payment_method: str | None = None
    installments: int = 1
    validity_days: int = 15
    estimated_delivery: str | None = None
    estimated_date: Optional[date] = None
    priority: str = "NORMAL"
    date: Optional[datetime] = None
    delivery_date: Optional[datetime] = None
    digital_signature: str | None = None
    signed_at: Optional[datetime] = None
    approval_date: Optional[datetime] = None
    design_observations: str | None = None
    important_observations: str | None = None
    notes: str | None = None
    fabrication_details: str | None = None
    # Optional per-budget term overrides (JSON list, may be empty string).
    budget_terms_override: str | None = ""
    warranty_override: str | None = ""
    pool_id: int | None = None
    pool_price: float = 0.0
    pool_currency: str = "ARS"
    pool_image: str | None = None
    stock_deducted: bool = False
    pools_data: str | None = None


class BudgetCreate(BudgetBase):
    items: list[BudgetItemCreate] = []
    adicionales: list[BudgetAdicionalCreate] = []
    sketch_elements: list[BudgetSketchElementCreate] = []


class BudgetUpdate(BaseModel):
    status: str | None = None
    material: str | None = None
    material_price_m2: float | None = None
    material_price_m2_usd: float | None = None
    materials_data: str | None = None
    color: str | None = None
    thickness: str | None = None
    front: str | None = None
    finish: str | None = None
    bacha: str | None = None
    anafe: str | None = None
    perforations: str | None = None
    currency: str | None = None
    usd_rate: float | None = None
    subtotal_materials: float | None = None
    subtotal_services: float | None = None
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
    validity_days: int | None = None
    estimated_delivery: str | None = None
    estimated_date: Optional[date] = None
    priority: str | None = None
    date: Optional[datetime] = None
    delivery_date: Optional[datetime] = None
    digital_signature: str | None = None
    signed_at: Optional[datetime] = None
    approval_date: Optional[datetime] = None
    design_observations: str | None = None
    important_observations: str | None = None
    notes: str | None = None
    fabrication_details: str | None = None
    budget_terms_override: str | None = ""
    warranty_override: str | None = ""
    pool_id: int | None = None
    pool_price: float | None = None
    pool_currency: str | None = None
    pool_image: str | None = None
    stock_deducted: bool | None = None
    pools_data: str | None = None
    items: list[BudgetItemCreate] | None = None
    adicionales: list[BudgetAdicionalCreate] | None = None
    sketch_elements: list[BudgetSketchElementCreate] | None = None


class BudgetResponse(BudgetBase, BaseResponse):
    id: int
    number: str
    status: str
    created_at: datetime
    updated_at: datetime
    items: list[BudgetItemResponse] = []
    adicionales: list[BudgetAdicionalResponse] = []
    sketch_elements: list[BudgetSketchElementResponse] = []
    work_order_id: int | None = None
    work_order_number: str | None = None

    @classmethod
    def from_orm_with_client(cls, budget) -> "BudgetResponse":
        """Build a response from a Budget ORM row, populating client_*
        fields from the related Client (JOIN). The Budget model has no
        client_name column — only client_id — so without this helper the
        response would have client_name=None."""
        data = cls.model_validate(budget).model_dump()
        client = getattr(budget, "client", None)
        if client:
            data["client_name"] = client.name or data.get("client_name") or ""
            data["client_phone"] = client.phone or data.get("client_phone") or ""
            data["client_email"] = client.email or data.get("client_email") or ""
            data["client_address"] = client.address or data.get("client_address") or ""
        return cls.model_validate(data)
