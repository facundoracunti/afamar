"""Strict parsing for dimensions received inside JSON form fields."""
from __future__ import annotations

import re
from typing import Any

_DECIMAL = re.compile(r"^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$")


def measurement_number(value: Any, *, default: float = 0.0) -> float:
    """Parse dot/comma decimals without treating grouping separators as data."""
    if value is None or value == "":
        return default
    if isinstance(value, bool):
        raise TypeError("boolean is not a measurement")
    if isinstance(value, (int, float)):
        return float(value)
    raw = str(value).strip()
    if raw.count(".") + raw.count(",") > 1:
        raise ValueError(f"ambiguous measurement: {value!r}")
    normalized = raw.replace(",", ".")
    if not _DECIMAL.fullmatch(normalized):
        raise ValueError(f"invalid measurement: {value!r}")
    return float(normalized)


def positive_snapshot(value: Any) -> float | None:
    """Return an existing positive snapshot, including comma-decimal strings."""
    if value is None:
        return None
    parsed = measurement_number(value)
    return parsed if parsed > 0 else None
