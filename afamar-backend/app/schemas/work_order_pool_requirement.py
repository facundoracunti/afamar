from datetime import datetime

from pydantic import BaseModel, Field


class PoolRecoveryItem(BaseModel):
    requirement_id: int
    recovered_quantity: int = Field(ge=0)


class WorkOrderPoolCancellationRequest(BaseModel):
    recoveries: list[PoolRecoveryItem] = Field(default_factory=list)
    payments_confirmed: bool = False


class PoolRequirementAssignmentRequest(BaseModel):
    quantity: int = Field(gt=0)


class WorkOrderPoolRequirementResponse(BaseModel):
    id: int
    work_order_id: int | None = None
    work_order_number: str
    pool_id: int | None = None
    pool_key: str
    pool_snapshot: str | None = None
    required_quantity: int
    allocated_quantity: int
    pending_quantity: int
    recovered_quantity: int
    unrecovered_quantity: int
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PendingPoolRequirementResponse(BaseModel):
    requirement_id: int
    work_order_id: int
    work_order_number: str
    work_order_status: str
    client_id: int
    client_name: str
    pool_id: int | None = None
    pool_brand: str
    pool_model: str
    required_quantity: int
    allocated_quantity: int
    pending_quantity: int
    available_quantity: int


class PoolRequirementAssignmentResponse(BaseModel):
    requirement: WorkOrderPoolRequirementResponse
    assigned_quantity: int
    available_quantity: int
