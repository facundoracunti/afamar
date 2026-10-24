"""Per-option totals for multi-option (multi-escenario) budgets.

2026-10-01, Fase 2 of the "Opciones / Escenarios Independientes"
migration. Each option owns its own `pieces` (same wire shape as
`Budget.pieces_data`), so its subtotal is computed by flattening ONLY
that option's pieces — no cross-option leakage.

The rule set reuses the existing per-document helpers
(`calculate_material_totals` / `compute_detail_totals` /
`compute_additional_totals` / `compute_pool_totals`) so a legacy
single-option budget and a multi-option budget are priced by the SAME
math. `flatten_pieces` is NOT reused on the whole budget (that would mix
options); it is applied per option via `_flatten_option_pieces`.
"""
from __future__ import annotations

from typing import Any, Optional

from app.services.budget_calculator import (
    calculate_material_totals,
    compute_additional_totals,
    compute_detail_totals,
    compute_pool_totals,
    parse_additional_works_snapshot,
)
from app.services.budget_options import parse_pieces, resolve_budget_options


def _flatten_option_pieces(option: dict) -> dict[str, list]:
    """Flatten ONE option's pieces into the four flat lists.

    Mirrors `budget_calculator.flatten_pieces` but scoped to the option.

    The option's piletas are the ones its own pieces carry — the per-variant
    sink override (`alternative_pool`) was removed on 2026-10-23: the
    top-level OPCIONES are the only place where a variant is defined, and
    each option carries its own piletas.

    The principal row and its extra panes ("tramos") are collected
    INDEPENDENTLY — a piece whose anchor row was removed still keeps its
    panes, and dropping them would price the option at $0 while the
    document's flat arrays (built by `flatten_pieces` with the same
    independent handling) kept the material's amount.
    """
    materials: list = []
    fabrication: list = []
    additional: list = []
    pools: list = []

    for piece in option.get("pieces") or []:
        if not isinstance(piece, dict):
            continue

        main = piece.get("mainMaterial")
        if isinstance(main, dict):
            materials.append({**main, "is_alternative": False})
        for tramo in piece.get("mainMaterialRows") or []:
            if isinstance(tramo, dict):
                materials.append({**tramo, "is_alternative": False})

        alternatives = [
            a for a in (piece.get("alternativeMaterials") or []) if isinstance(a, dict)
        ]
        for alt in alternatives:
            materials.append({**alt, "is_alternative": True})

        fabrication.extend(
            [f for f in (piece.get("fabrication_details") or []) if isinstance(f, dict)]
        )
        additional.extend(parse_additional_works_snapshot(piece.get("additional_works_data")))
        pools.extend([p for p in (piece.get("pools") or []) if isinstance(p, dict)])

    return {
        "materials": materials,
        "fabrication": fabrication,
        "additional": additional,
        "pools": pools,
    }


def _fabrication_totals(rows: list) -> tuple:
    """(ars, usd) for fabrication rows, tolerant of BOTH key spellings.

    `compute_detail_totals` used to read ONLY the legacy Spanish keys
    (`precio` / `cantidad` / `moneda`), while the pieces flow sends the
    English ones (`price` / `quantity` / `currency`) — reusing it verbatim
    would silently price every zócalo at $0. The helper is now tolerant
    (English wins, Spanish is the fallback), so this wrapper just delegates
    and keeps the module's public surface stable.
    """
    return compute_detail_totals(rows)


def compute_option_subtotals(option: dict, usd_rate: float) -> dict:
    """Native-currency subtotals (ARS bucket / USD bucket) for ONE option.

    Returns the four component buckets plus their sum. No ARS↔USD
    conversion happens here — the caller applies the document rate once,
    matching `compute_pool_totals` / `compute_additional_totals`.
    """
    flat = _flatten_option_pieces(option)
    # Only MAIN materials bill the option (alternatives are quoted
    # separately, exactly like `filter_main_materials` does document-wide).
    main_materials = [m for m in flat["materials"] if not m.get("is_alternative")]
    # `calculate_material_totals` returns a dict; the `compute_*` helpers
    # return (ars, usd) tuples — normalise both to a tuple.
    mat_totals = calculate_material_totals(main_materials, usd_rate)
    mat_ars, mat_usd = float(mat_totals["ars"]), float(mat_totals["usd"])
    fab_ars, fab_usd = _fabrication_totals(flat["fabrication"])
    add_ars, add_usd = compute_additional_totals(flat["additional"])
    pool_ars, pool_usd = compute_pool_totals(flat["pools"])
    return {
        "materials_ars": round(mat_ars, 2),
        "materials_usd": round(mat_usd, 2),
        "fabrication_ars": round(fab_ars, 2),
        "fabrication_usd": round(fab_usd, 2),
        "additional_ars": round(add_ars, 2),
        "additional_usd": round(add_usd, 2),
        "pools_ars": round(pool_ars, 2),
        "pools_usd": round(pool_usd, 2),
        "subtotal_ars": round(mat_ars + fab_ars + add_ars + pool_ars, 2),
        "subtotal_usd": round(mat_usd + fab_usd + add_usd + pool_usd, 2),
    }


def compute_options_report(
    options_data: Any,
    pieces_data: Any = None,
    usd_rate: float = 0.0,
) -> list[dict]:
    """Per-option subtotals for the comparative summary (PDF / API).

    `resolve_budget_options` already folds a legacy budget into a single
    synthetic option, so a legacy budget returns exactly one row here and
    the caller needs no branch.
    """
    report: list[dict] = []
    for option in resolve_budget_options(options_data, pieces_data):
        subtotals = compute_option_subtotals(option, usd_rate)
        report.append({
            "id": option["id"],
            "name": option["name"],
            "is_selected": option["is_selected"],
            "pieces": option["pieces"],
            "piece_names": [p.get("name") or "Pieza" for p in option["pieces"]],
            "subtotal_ars": subtotals["subtotal_ars"],
            "subtotal_usd": subtotals["subtotal_usd"],
            "components": {
                "materials_ars": subtotals["materials_ars"],
                "materials_usd": subtotals["materials_usd"],
                "fabrication_ars": subtotals["fabrication_ars"],
                "fabrication_usd": subtotals["fabrication_usd"],
                "additional_ars": subtotals["additional_ars"],
                "additional_usd": subtotals["additional_usd"],
                "pools_ars": subtotals["pools_ars"],
                "pools_usd": subtotals["pools_usd"],
            },
        })
    return report


def pick_winning_option(
    options_data: Any,
    pieces_data: Any = None,
    option_id: Optional[str] = None,
) -> Optional[dict]:
    """Resolve the option the operator is converting.

    Falls back to the explicitly selected option, then to a single
    available option (legacy), and returns `None` when the choice would
    be ambiguous — the caller must NOT guess, because converting the
    wrong option bills the wrong price and deducts the wrong sink.
    """
    from app.services.budget_options import find_option, SINGLE_OPTION_ID

    options = resolve_budget_options(options_data, pieces_data)
    if not options:
        return None

    # An explicit id always wins.
    if option_id not in (None, ""):
        return find_option(options, option_id)
    # `is_selected` is the persisted "winning option" marker.
    selected = [o for o in options if o.get("is_selected")]
    if len(selected) == 1:
        return selected[0]
    # A legacy budget (or any single-option budget) needs no id.
    if len(options) == 1:
        return options[0]
    # Legacy constant still resolves by id (Phase 3 endpoint accepts it).
    if len(options) == 1 and options[0]["id"] == SINGLE_OPTION_ID:
        return options[0]
    return None


def winning_option_flat(budget_data: dict) -> Optional[dict]:
    """The flat arrays of the WINNING option, or `None`.

    Used by the legacy (xhtml2pdf) budget PDF: a multi-option budget
    stores the ACTIVE option in the document-level flat arrays (they are
    what the form was editing when it was saved), so the client-facing
    download could show a different scenario than the one the operator
    converted. Re-deriving the flat arrays from the winning option keeps
    the download aligned with the frontend preview.

    ONLY applies to a genuine MULTI-OPTION budget (2+ options): a legacy or
    single-option budget keeps its stored flat arrays untouched, so a row
    that was authored outside the pieces flow is never dropped.
    """
    from app.services.budget_options import resolve_budget_options

    options = resolve_budget_options(
        budget_data.get("options_data"),
        budget_data.get("pieces_data"),
    )
    if len(options) < 2:
        return None

    option = pick_winning_option(
        budget_data.get("options_data"),
        budget_data.get("pieces_data"),
    )
    if not option:
        return None
    flat = _flatten_option_pieces(option)
    return {
        "materials": flat["materials"],
        "fabrication": flat["fabrication"],
        "additional": flat["additional"],
        "pools": flat["pools"],
    }