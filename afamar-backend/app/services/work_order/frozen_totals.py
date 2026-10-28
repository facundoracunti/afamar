"""Helpers for preserving a work order's frozen commercial values.

Measurement edits travel through the same JSON arrays as commercial edits. The
comparison below ignores only dimensional fields and conversion snapshots; a
material, price, pool, additional work, discount or payment-method change is
still treated as a commercial change and may recalculate the order.
"""
from __future__ import annotations

import json
from typing import Any


_SNAPSHOT_KEYS = {
    "m2_budgeted",
    "linear_meters_budgeted",
    "total_ars_budgeted",
    "total_usd_budgeted",
}
_MATERIAL_MEASURE_KEYS = {
    "length", "width", "quantity", "largo", "ancho", "cantidad", "m2",
    "m2_used",
}
_FABRICATION_MEASURE_KEYS = _MATERIAL_MEASURE_KEYS | {
    "linear_meters", "metros_lineales",
}


def _parse_list(raw: Any) -> list:
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str) and raw:
        try:
            parsed = json.loads(raw)
        except (TypeError, ValueError):
            return []
        return parsed if isinstance(parsed, list) else []
    return []


def _strip_row(raw: Any, *, kind: str) -> Any:
    if not isinstance(raw, dict):
        return raw
    out = {}
    is_front = str(raw.get("type") or "").lower() == "frente"
    for key, value in raw.items():
        if key in _SNAPSHOT_KEYS:
            continue
        if kind == "material" and key in _MATERIAL_MEASURE_KEYS:
            continue
        if kind == "fabrication" and key in _FABRICATION_MEASURE_KEYS:
            continue
        if kind == "additional" and is_front and key in {"linear_meters", "metros_lineales"}:
            continue
        out[key] = value
    return out


def _normalise_flat(raw: Any, *, kind: str) -> list:
    return [_strip_row(row, kind=kind) for row in _parse_list(raw)]


def _normalise_pieces(raw: Any) -> list:
    pieces = _parse_list(raw)
    out = []
    for piece in pieces:
        if not isinstance(piece, dict):
            out.append(piece)
            continue
        normalized = {}
        for key, value in piece.items():
            if key == "mainMaterial":
                normalized[key] = _strip_row(value, kind="material")
            elif key in {"mainMaterialRows", "alternativeMaterials"}:
                normalized[key] = [
                    _strip_row(row, kind="material")
                    for row in (value if isinstance(value, list) else [])
                ]
            elif key == "fabrication_details":
                normalized[key] = _normalise_flat(value, kind="fabrication")
            elif key == "additional_works_data":
                normalized[key] = _normalise_flat(value, kind="additional")
            else:
                normalized[key] = value
        out.append(normalized)
    return out


def _canonical(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def has_commercial_line_change(order, data: dict) -> bool:
    """Return whether changed line JSON contains a commercial difference."""
    specs = {
        "materials_data": "material",
        "fabrication_details": "fabrication",
        "additional_works_data": "additional",
        "pieces_data": "pieces",
        "pools_data": "pool",
    }
    for key, kind in specs.items():
        if key not in data:
            continue
        current = getattr(order, key, None)
        if kind == "pieces":
            before = _normalise_pieces(current)
            after = _normalise_pieces(data[key])
        elif kind == "pool":
            before = _parse_list(current)
            after = _parse_list(data[key])
        else:
            before = _normalise_flat(current, kind=kind)
            after = _normalise_flat(data[key], kind=kind)
        if _canonical(before) != _canonical(after):
            return True
    return False


def has_commercial_scalar_change(order, data: dict) -> bool:
    """Return whether non-line commercial fields explicitly changed."""
    fields = (
        "material", "material_price_m2", "transport", "transport_usd",
        "installation", "discount", "discount_enabled", "discount_target",
        "discount_percentage", "discount_fixed_amount", "payment_method",
        "payment_method_id", "installments",
    )
    for key in fields:
        if key in data and data[key] is not None and data[key] != getattr(order, key, None):
            return True
    return False


def apply_frozen_financials(order, data: dict) -> None:
    """Keep commercial values and recompute only the native deposit balance."""
    rate = float(order.usd_rate or 0)
    deposit_currency = str(data.get("deposit_currency", order.deposit_currency) or "ARS").upper()
    deposit_ars = float(data.get("deposit_received", order.deposit_received) or 0)
    deposit_usd = float(data.get("deposit_usd", order.deposit_usd) or 0)

    if deposit_currency == "USD":
        deposit_ars_equivalent = deposit_usd * rate if rate > 0 else 0
    else:
        deposit_ars_equivalent = deposit_ars
        if deposit_usd == 0 and deposit_ars > 0 and rate > 0:
            deposit_usd = round((deposit_ars / rate) * 100) / 100

    data["usd_rate"] = order.usd_rate
    for key in ("subtotal", "subtotal_usd", "total", "total_usd"):
        data[key] = getattr(order, key)
    data["balance_due"] = max(0.0, float(order.total or 0) - deposit_ars_equivalent)
    data["balance_due_usd"] = max(0.0, round((float(order.total_usd or 0) - deposit_usd) * 100) / 100)
    if deposit_currency == "ARS" and deposit_ars > 0:
        data["deposit_usd"] = deposit_usd
