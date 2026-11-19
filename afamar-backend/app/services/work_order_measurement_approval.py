"""Backward-compatible facade for measurement approval services.

The implementation now lives under ``services.measurement_approval`` so the
feature has a dedicated package. This module remains importable because older
routers, tests, and administrative scripts referenced its historical path.
"""
from __future__ import annotations

from app.services.measurement_approval import service as _implementation
from app.services.measurement_approval.service import (
    _approval_breakdown,
    measurement_fingerprint,
    measurement_snapshot,
)


def build_measurement_adjustment(order, db):
    """Build a proposal while preserving legacy monkeypatch behavior."""
    return _implementation.build_measurement_adjustment(
        order,
        db,
        breakdown_builder=_approval_breakdown,
    )


def approve_measurement_adjustment(
    db,
    order_id,
    user_id,
    fingerprint,
    previous_total,
    previous_total_usd,
):
    """Approve a proposal through the implementation package."""
    return _implementation.approve_measurement_adjustment(
        db,
        order_id,
        user_id,
        fingerprint,
        previous_total,
        previous_total_usd,
        proposal_builder=build_measurement_adjustment,
    )


def __getattr__(name: str):
    """Keep historical helper imports readable during the transition."""
    return getattr(_implementation, name)


__all__ = [
    "approve_measurement_adjustment",
    "build_measurement_adjustment",
    "measurement_fingerprint",
    "measurement_snapshot",
]
