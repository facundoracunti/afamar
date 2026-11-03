"""Typed commercial breakdown stored with a measurement approval.

The breakdown is intentionally separate from ``measurement_snapshot``:
the latter is the immutable measurement input, while this contract captures
the commercial result produced by the approval proposal.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ApprovalMeasurement(BaseModel):
    model_config = ConfigDict(extra="forbid")

    length: float | None = None
    width: float | None = None
    quantity: float | None = None
    linear_meters: float | None = None


class ApprovalAmount(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ars: float = 0.0
    usd: float = 0.0
    native: float = 0.0
    currency: Literal["ARS", "USD"] = "ARS"


class ApprovalBreakdownLine(BaseModel):
    model_config = ConfigDict(extra="forbid")

    line_key: str = Field(min_length=1)
    line_kind: Literal["material", "fabrication", "additional", "pool"]
    concept_type: str
    material: str | None = None
    measurement_before: ApprovalMeasurement | None = None
    measurement_approved: ApprovalMeasurement | None = None
    unit_price: float = 0.0
    currency: Literal["ARS", "USD"] = "ARS"
    subtotal_before: ApprovalAmount
    subtotal_approved: ApprovalAmount
    difference: ApprovalAmount


class ApprovalPiece(BaseModel):
    model_config = ConfigDict(extra="forbid")

    piece_key: str = Field(min_length=1)
    piece_id: str | None = None
    name: str
    lines: list[ApprovalBreakdownLine] = Field(default_factory=list)
    subtotal_before: ApprovalAmount
    subtotal_approved: ApprovalAmount
    difference: ApprovalAmount


class ApprovalAdjustment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    before: float = 0.0
    approved: float = 0.0
    difference: float = 0.0
    currency: Literal["ARS", "USD"] = "ARS"
    before_usd: float = 0.0
    approved_usd: float = 0.0
    difference_usd: float = 0.0


class ApprovalReconciliation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    line_subtotal_before: ApprovalAmount
    line_subtotal_approved: ApprovalAmount
    subtotal_error_ars: float = 0.0
    subtotal_error_usd: float = 0.0
    total_reconstructed_before: ApprovalAmount
    total_reconstructed_approved: ApprovalAmount
    total_error_ars: float = 0.0
    total_error_usd: float = 0.0
    precision_error_ars: float = 0.0
    precision_error_usd: float = 0.0
    is_reconciled: bool


class ApprovalBreakdown(BaseModel):
    """Immutable commercial ledger for one approval event."""

    model_config = ConfigDict(extra="forbid")

    version: Literal[1] = 1
    usd_rate: float
    rounding_policy: str
    pieces: list[ApprovalPiece] = Field(default_factory=list)
    global_lines: list[ApprovalBreakdownLine] = Field(default_factory=list)
    transport: ApprovalAdjustment
    discount: ApprovalAdjustment
    surcharge: ApprovalAdjustment
    subtotal_before: ApprovalAmount
    subtotal_approved: ApprovalAmount
    total_before: ApprovalAmount
    total_approved: ApprovalAmount
    difference: ApprovalAmount
    # The line reconciliation remains exact; these fields record the silent
    # document-level commercial rounding without distributing it to lines.
    exact_total_before: ApprovalAmount | None = None
    exact_total_approved: ApprovalAmount | None = None
    rounding_adjustment: ApprovalAdjustment | None = None
    reconciliation: ApprovalReconciliation
