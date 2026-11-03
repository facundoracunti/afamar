"""Helpers for preserving a work order's frozen commercial values.

Measurement edits travel through the same JSON arrays as commercial edits. The
comparison below ignores only dimensional fields and conversion snapshots; a
material, price, pool, additional work, discount or payment-method change is
still treated as a commercial change and may recalculate the order.
"""
from __future__ import annotations

import json
from typing import Any

from app.services.work_order.helpers import FAB_M2_CONCEPTS

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
_VOLATILE_FORMULA_KEYS = {"computed_at"}


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
    concept = str(raw.get("concept") or raw.get("concepto") or "").upper()
    is_front = str(raw.get("type") or "").lower() == "frente"
    is_catalogue = raw.get("price_source") == "catalog"
    for key, value in raw.items():
        if key in _SNAPSHOT_KEYS:
            continue
        if kind == "material" and key in _MATERIAL_MEASURE_KEYS:
            continue
        if kind == "fabrication" and key in _FABRICATION_MEASURE_KEYS:
            continue
        if kind == "additional" and is_front and key in {"linear_meters", "metros_lineales"}:
            continue
        # These amounts are recalculated from dimensions by the form. Only
        # catalogue rows are safe to treat as derived; manual prices remain
        # commercial changes.
        if kind == "fabrication" and concept in FAB_M2_CONCEPTS and is_catalogue and key == "price":
            continue
        if kind == "additional" and is_front and is_catalogue and key == "total":
            continue
        if key == "formula_values" and isinstance(value, dict):
            value = {
                nested_key: nested_value
                for nested_key, nested_value in value.items()
                if nested_key not in _VOLATILE_FORMULA_KEYS
            }
        out[key] = value
    return out


def _rows_by_index(before: Any, after: Any) -> list[tuple[dict, dict]]:
    before_rows = _parse_list(before)
    after_rows = _parse_list(after)
    return [
        (old, new)
        for old, new in zip(before_rows, after_rows)
        if isinstance(old, dict) and isinstance(new, dict)
    ]


def _measurement_changed(old: dict, new: dict, *, kind: str) -> bool:
    keys = _MATERIAL_MEASURE_KEYS
    if kind in {"fabrication", "additional"}:
        keys = _FABRICATION_MEASURE_KEYS
    if kind == "additional":
        keys = _FABRICATION_MEASURE_KEYS
    return any(old.get(key) != new.get(key) for key in keys)


def _ambiguous_rows(before: Any, after: Any, *, kind: str, label: str) -> list[str]:
    """Find row changes whose derived amount lacks a safe provenance."""
    ambiguous: list[str] = []
    for old, new in _rows_by_index(before, after):
        if not _measurement_changed(old, new, kind=kind):
            continue
        old_source = old.get("price_source")
        new_source = new.get("price_source")
        if old_source in {"catalog", "manual"} and new_source in {"catalog", "manual"}:
            continue
        concept = str(new.get("concept") or new.get("concepto") or "").upper()
        is_front = str(new.get("type") or "").lower() == "frente"
        derived_key_changed = (
            kind == "fabrication"
            and concept in FAB_M2_CONCEPTS
            and old.get("price") != new.get("price")
        ) or (
            kind == "additional"
            and is_front
            and old.get("total") != new.get("total")
        )
        if derived_key_changed:
            ambiguous.append(f"{label} sin price_source explícito")
    return ambiguous


def ambiguous_measurement_changes(order, data: dict) -> list[str]:
    """Return unsafe dimensional changes instead of silently repricing them."""
    ambiguous: list[str] = []
    for key, kind, label in (
        ("fabrication_details", "fabrication", "Fabricación"),
        ("additional_works_data", "additional", "Trabajo adicional"),
    ):
        if key in data:
            ambiguous.extend(
                _ambiguous_rows(getattr(order, key, None), data[key], kind=kind, label=label)
            )

    if "pieces_data" in data:
        for old_piece, new_piece in zip(
            _parse_list(getattr(order, "pieces_data", None)),
            _parse_list(data["pieces_data"]),
        ):
            if not isinstance(old_piece, dict) or not isinstance(new_piece, dict):
                continue
            for key, kind, label in (
                ("fabrication_details", "fabrication", "Fabricación en piezas"),
                ("additional_works_data", "additional", "Trabajo adicional en piezas"),
            ):
                if key in new_piece:
                    ambiguous.extend(
                        _ambiguous_rows(
                            old_piece.get(key),
                            new_piece[key],
                            kind=kind,
                            label=label,
                        )
                    )
    return sorted(set(ambiguous))


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
    for key in (
        "total_exact_ars", "total_exact_usd",
        "rounding_adjustment_ars", "rounding_adjustment_usd",
        "total_contractual_ars", "total_contractual_usd",
    ):
        data[key] = getattr(order, key, None)
    data["balance_due"] = max(0.0, float(order.total or 0) - deposit_ars_equivalent)
    data["balance_due_usd"] = max(0.0, round((float(order.total_usd or 0) - deposit_usd) * 100) / 100)
    if deposit_currency == "ARS" and deposit_ars > 0:
        data["deposit_usd"] = deposit_usd
