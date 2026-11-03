"""Silent commercial rounding for persisted document totals.

The ARS contractual total is the commercial source of truth.  Existing
documents keep their legacy nullable fields; callers only apply this helper
when creating a new document or explicitly approving a new measurement total.
"""
from __future__ import annotations

from decimal import ROUND_CEILING, Decimal, InvalidOperation
from typing import Any

from app.core.exceptions import ValidationError

ROUNDING_UNIT_ARS = Decimal("5000")
SNAPSHOT_KEYS = (
    "total_exact_ars",
    "total_exact_usd",
    "rounding_adjustment_ars",
    "rounding_adjustment_usd",
    "total_contractual_ars",
    "total_contractual_usd",
)
SNAPSHOT_TOLERANCE = Decimal("0.02")


def _decimal(value: Any) -> Decimal:
    try:
        return Decimal(str(value or 0))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal("0")


def contractual_totals(exact_ars: Any, usd_rate: Any) -> dict[str, float]:
    """Return exact, adjustment and contractual ARS/USD values.

    Totals are non-negative by the existing pricing contract.  Decimal is
    used for the ceiling and currency conversion so binary float artifacts
    cannot move a value across a 5,000 boundary.
    """
    exact = max(Decimal("0"), _decimal(exact_ars))
    rate = _decimal(usd_rate)
    contractual = (exact / ROUNDING_UNIT_ARS).to_integral_value(
        rounding=ROUND_CEILING,
    ) * ROUNDING_UNIT_ARS
    adjustment = contractual - exact
    contractual_usd = contractual / rate if rate > 0 else Decimal("0")
    exact_usd = exact / rate if rate > 0 else Decimal("0")
    return {
        "exact_ars": float(exact.quantize(Decimal("0.01"))),
        "exact_usd": float(exact_usd.quantize(Decimal("0.01"))),
        "adjustment_ars": float(adjustment.quantize(Decimal("0.01"))),
        "adjustment_usd": float((contractual_usd - exact_usd).quantize(Decimal("0.01"))),
        "contractual_ars": float(contractual.quantize(Decimal("0.01"))),
        "contractual_usd": float(contractual_usd.quantize(Decimal("0.01"))),
    }


def contractual_snapshot_state(row: Any) -> str:
    """Classify a persisted commercial snapshot without treating NULL as zero."""
    values = {
        key: getattr(row, key, None) if not isinstance(row, dict) else row.get(key)
        for key in SNAPSHOT_KEYS
    }
    present = [value is not None for value in values.values()]
    if not any(present):
        return "absent"
    if not all(present):
        return "partial"

    ars_ok = abs(
        _decimal(values["total_exact_ars"])
        + _decimal(values["rounding_adjustment_ars"])
        - _decimal(values["total_contractual_ars"])
    ) <= SNAPSHOT_TOLERANCE
    usd_ok = abs(
        _decimal(values["total_exact_usd"])
        + _decimal(values["rounding_adjustment_usd"])
        - _decimal(values["total_contractual_usd"])
    ) <= SNAPSHOT_TOLERANCE
    return "complete" if ars_ok and usd_ok else "partial"


def apply_contractual_totals(data: dict, *, exact_ars: Any | None = None) -> dict:
    """Mutate a payload with the contractual financial snapshot.

    ``total`` and ``total_usd`` remain the compatibility fields consumed by
    existing payment/PDF code; the explicit fields retain the audit values.
    """
    values = contractual_totals(
        data.get("total") if exact_ars is None else exact_ars,
        data.get("usd_rate"),
    )
    data.update(
        total_exact_ars=values["exact_ars"],
        total_exact_usd=values["exact_usd"],
        rounding_adjustment_ars=values["adjustment_ars"],
        rounding_adjustment_usd=values["adjustment_usd"],
        total_contractual_ars=values["contractual_ars"],
        total_contractual_usd=values["contractual_usd"],
        total=values["contractual_ars"],
        total_usd=values["contractual_usd"],
    )
    _apply_contractual_balance(data, values)
    return data


def has_contractual_totals(row: Any) -> bool:
    """Whether a row is part of the new persisted rounding contract."""
    return contractual_snapshot_state(row) == "complete"


def copy_contractual_totals(data: dict, source: Any) -> dict:
    """Copy a previously frozen snapshot without recomputing or rounding it."""
    state = contractual_snapshot_state(source)
    if state == "partial":
        raise ValidationError(
            "El documento tiene un snapshot contractual incompleto o inconsistente."
        )
    if state != "complete":
        return data
    for key in SNAPSHOT_KEYS:
        value = source.get(key) if isinstance(source, dict) else getattr(source, key, None)
        data[key] = value
    data["total"] = data["total_contractual_ars"]
    data["total_usd"] = data["total_contractual_usd"]
    _apply_contractual_balance(
        data,
        {
            "contractual_ars": data["total_contractual_ars"],
            "contractual_usd": data["total_contractual_usd"],
        },
    )
    return data


def _apply_contractual_balance(data: dict, values: dict[str, float]) -> None:
    """Recompute balances from the contractual total, never from the exact one."""
    rate = _decimal(data.get("usd_rate"))
    deposit_ars = _decimal(data.get("deposit_received"))
    deposit_usd = _decimal(data.get("deposit_usd"))
    currency = str(data.get("deposit_currency") or "ARS").upper()
    if currency == "USD":
        deposit_ars_equivalent = deposit_usd * rate if rate > 0 else Decimal("0")
    else:
        deposit_ars_equivalent = deposit_ars
        if deposit_usd == 0 and deposit_ars > 0 and rate > 0:
            deposit_usd = (deposit_ars / rate).quantize(Decimal("0.01"))
    data["balance_due"] = float(
        max(Decimal("0"), _decimal(values["contractual_ars"]) - deposit_ars_equivalent)
        .quantize(Decimal("0.01"))
    )
    data["balance_due_usd"] = float(
        max(Decimal("0"), _decimal(values["contractual_usd"]) - deposit_usd)
        .quantize(Decimal("0.01"))
    )
    if currency == "ARS" and deposit_ars > 0:
        data["deposit_usd"] = float(deposit_usd)
