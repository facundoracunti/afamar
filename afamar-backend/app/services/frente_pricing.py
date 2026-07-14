"""Helper that computes the frozen subtotal for `type == 'frente'` rows in
the `additional_works_data` JSON snapshot on a budget / work-order.

The formula is purely multiplicative:
    price_per_meter = material.price_m2 × 0.13 × formula_multiplier
    total           = material.price_m2 × 0.13 × formula_multiplier × linear_meters

`formula_multiplier` defaults to `1.15` when the catalogue row has
`formula_constant = None` (legacy rows before this feature was added).
The DB column name is still `formula_constant` (the catalogue keeps a
single price-related override column; the operator edits it via the
`Multiplicador` field on `/admin/additional-works`).

Both sides are stored in the same currency as the material (per Q1
decision in the implementation plan). The caller is responsible for
filling the row's `currency`, `price`, `total`, and the frozen
`formula_values` audit trail before persisting.

If the referenced material was deleted, the row is passed through
verbatim so the budget doesn't lose data — the legacy `price * quantity`
math takes over.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


FRENTE_FORMULA_MULTIPLIER_DEFAULT = 1.15
FRENTE_LINEAR_COEFFICIENT = 0.13


def resolve_frente_multiplier(catalog_row: Any) -> float:
    """Return the formula multiplier for a catalogue row. Falls back to
    the business default (1.15) when the column is null. Tolerates string
    coercion so legacy catalogue rows (created before the multiplier
    field was added) still compute correctly.

    `catalog_row` accepts anything with a `formula_constant` attribute
    — the SQLAlchemy ORM row, a plain object from a migration script,
    or a test stub.
    """
    raw = getattr(catalog_row, "formula_constant", None)
    if raw is None:
        return FRENTE_FORMULA_MULTIPLIER_DEFAULT
    try:
        v = float(raw)
    except (TypeError, ValueError):
        return FRENTE_FORMULA_MULTIPLIER_DEFAULT
    return v


def compute_frente_subtotal(
    material_price_m2: float,
    formula_multiplier: float,
    linear_meters: float,
) -> Dict[str, float]:
    """Run the formula. Returns `price_per_meter` (rounded to 2dp) and
    `total` (rounded to 2dp). Both stay in the material's currency.

    Multiplicative per the business rule: the cost is 13% of the
    material's per-m² price, scaled by the catalogue's multiplier
    (default 1.15), times the linear meters the operator booked.
    """
    multiplier = float(formula_multiplier)
    price_per_meter = round(
        float(material_price_m2) * FRENTE_LINEAR_COEFFICIENT * multiplier,
        2,
    )
    total = round(
        float(material_price_m2) * FRENTE_LINEAR_COEFFICIENT * multiplier * float(linear_meters),
        2,
    )
    return {"price_per_meter": price_per_meter, "total": total}


def apply_frente_rows(
    rows: List[Dict[str, Any]],
    *,
    catalogue_by_id: Dict[int, Any],
    materials_by_id: Dict[int, Any],
    now_iso: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Mutate-and-return each `frente` row in `rows` with its computed
    `price`, `total`, `currency`, and `formula_values` snapshot.

    Rows whose `type != 'frente'` are returned verbatim (the legacy
    `price * quantity` math runs elsewhere).

    When the linked catalogue row is missing OR the linked material is
    missing, the row is left untouched so the budget doesn't lose
    data; the caller can decide whether to warn or fail.
    """
    if now_iso is None:
        now_iso = datetime.now(timezone.utc).isoformat()

    out: List[Dict[str, Any]] = []
    for row in rows:
        if (row.get("type") or "flat") != "frente":
            out.append(row)
            continue
        catalog_id = row.get("additional_work_id")
        catalog = catalogue_by_id.get(catalog_id) if catalog_id is not None else None
        if catalog is None:
            out.append(row)
            continue
        material_id = row.get("assigned_material_id")
        material = materials_by_id.get(material_id) if material_id is not None else None
        # Legacy snapshots produced before `addMaterialToList` started
        # storing the catalogue id carry `assigned_material_id: null`
        # and the material name in `assigned_material_name` instead. Fall
        # back to a name lookup so old `Frente / Regrueso` rows still
        # resolve against the current materials table.
        if material is None:
            legacy_name = (
                row.get("assigned_material_name")
                or row.get("material_name")
                or row.get("materialName")
            )
            if legacy_name:
                material = next(
                    (m for m in materials_by_id.values() if getattr(m, "name", None) == legacy_name),
                    None,
                )
        if material is None:
            out.append(row)
            continue

        # Pick the material's per-m² price in the material's own currency.
        # Same convention the service layer uses for `Material.currency_id`:
        # `base_price` for ARS rows, `price_usd` for USD rows. We surface
        # the choice as a `currency_code` on the snapshot row so downstream
        # totals can bucket without re-fetching the material.
        material_currency_code = row.get("currency") or _material_currency_code(material)
        if material_currency_code == "USD":
            material_price_m2 = float(getattr(material, "price_usd", 0.0) or 0.0)
        else:
            material_price_m2 = float(getattr(material, "base_price", 0.0) or 0.0)

        multiplier = resolve_frente_multiplier(catalog)
        linear_meters = float(row.get("linear_meters") or 0.0)
        if linear_meters <= 0:
            out.append(row)
            continue

        computed = compute_frente_subtotal(
            material_price_m2=material_price_m2,
            formula_multiplier=multiplier,
            linear_meters=linear_meters,
        )

        new_row = dict(row)
        new_row["price"] = computed["price_per_meter"]
        new_row["total"] = computed["total"]
        new_row["currency"] = material_currency_code
        new_row["formula_values"] = {
            "material_price_m2_at_selection": material_price_m2,
            "multiplier": multiplier,
            "computed_at": now_iso,
        }
        out.append(new_row)

    return out


def _material_currency_code(material: Any) -> str:
    """Resolve the wire-format currency code for a material row. Falls
    back to the legacy `currency` string column when `currency_obj`
    isn't loaded (e.g. on a denormalised import)."""
    obj = getattr(material, "currency_obj", None)
    if obj is not None:
        code = getattr(obj, "code", None)
        if code:
            return str(code).upper()
    legacy = getattr(material, "currency", None)
    return str(legacy or "ARS").upper()
