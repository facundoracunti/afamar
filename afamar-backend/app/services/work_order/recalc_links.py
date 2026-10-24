"""Alternative-material link predicates for the server-side totals recalc.

Extracted verbatim from the former monolithic ``recalc.py`` so the
"is this row linked to an alternative material?" rule lives in ONE place.
"""
import json


def _collect_alt_material_names(materials_data) -> set[str]:
    """Return the set of material names flagged ``is_alternative=true``.

    Used by ``_is_alt_linked`` to skip pools / fabrication / additional
    rows assigned to an alternative material when computing the main
    Presupuesto subtotal (matches the frontend hook's ``isAltLinked``
    predicate).
    """
    names: set[str] = set()
    if not materials_data:
        return names
    try:
        parsed = materials_data if not isinstance(materials_data, str) else json.loads(materials_data)
    except (json.JSONDecodeError, TypeError):
        return names
    if isinstance(parsed, list):
        names = {m.get("name") for m in parsed if m.get("is_alternative")}
    return names


def _is_alt_linked(material_field, alt_names: set[str]) -> bool:
    """True when ``material_field`` points at an alternative material.

    Honours the magic prefixes the frontend uses:
      - ``"__GLOBAL__"`` → unassigned (count for everyone).
      - ``"__ALT__:Foo"`` → alternative material "Foo" (always linked).
      - plain string in ``alt_names`` → alternative material via name match.
    """
    if not material_field:
        return False
    if material_field == "__GLOBAL__":
        return False
    if isinstance(material_field, str) and material_field.startswith("__ALT__:"):
        return True
    return material_field in alt_names
