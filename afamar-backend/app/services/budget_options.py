"""Multi-option (multi-escenario) budgets — runtime resolution layer.

2026-10-01, Fase 1 of the "Opciones / Escenarios Independientes"
migration. This module is the SINGLE place that answers "what options
does this budget have?" so every consumer (calculator, PDF, conversion,
UI) shares one interpretation and the legacy path can't drift.

Two shapes are supported side by side (deliberate coexistence — the
legacy per-piece `alternativeMaterials` model keeps working untouched):

* **Legacy** — `options_data` is NULL/''/'[]' and the budget has a
  single implicit configuration in `pieces_data`.
* **Multi-option** — `options_data` holds a JSON array of options, each
  owning its own `pieces`.

Legacy budgets are surfaced as ONE synthetic option (`Opción Única`,
id `SINGLE`) whose `pieces` are the budget's `pieces_data`. Nothing is
written back to the DB, so a budget created before the migration behaves
exactly as before while already being addressable by option id — which
is exactly what Phase 3's `convert_budget_to_work_order(budget_id,
option_id)` needs.
"""
from __future__ import annotations

import json
from typing import Any, Optional

import logging

logger = logging.getLogger(__name__)

# Stable id of the synthetic option that wraps a legacy single-option
# budget. Exported so the conversion endpoint can accept `option_id =
# "SINGLE"` without special-casing NULL in the router.
SINGLE_OPTION_ID = "SINGLE"

# Human label of the synthetic option. "Opción Única" reads correctly
# in the PDF's comparative summary ("Opción Única — Piezas: …").
SINGLE_OPTION_NAME = "Opción Única"


def parse_pieces(raw: Any) -> list[dict]:
    """Parse a `pieces_data`-shaped payload into a list of dicts.

    Accepts the JSON string stored in the DB column, an already-parsed
    list (the frontend's in-memory form state), or None/''. Malformed
    JSON degrades to `[]` rather than raising — a corrupt snapshot must
    not take down the dashboard or the PDF.
    """
    if raw is None or raw == "":
        return []
    if isinstance(raw, list):
        return [p for p in raw if isinstance(p, dict)]
    if isinstance(raw, (bytes, bytearray)):
        try:
            raw = raw.decode("utf-8")
        except Exception:
            logger.warning("Failed to decode pieces snapshot")
            return []
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            logger.warning("Malformed pieces snapshot — ignoring")
            return []
        return [p for p in parsed if isinstance(p, dict)] if isinstance(parsed, list) else []
    return []


def serialize_pieces(pieces: list[dict] | None) -> str | None:
    """Serialise a pieces list for the TEXT column. Returns None when
    there is nothing to store so the column keeps the NULL/'' semantics
    the legacy fallback checks."""
    if not pieces:
        return None
    try:
        return json.dumps(pieces, ensure_ascii=False)
    except (TypeError, ValueError):
        logger.warning("Failed to serialise pieces snapshot")
        return None


def _normalize_option(raw: Any, index: int) -> Optional[dict]:
    """Coerce one raw option dict into the canonical shape.

    Tolerant on the fields Phase 2+ fill in later (`is_selected`,
    `subtotal_*`) — they default here so consumers don't need
    `.get()` chains from day one.
    """
    if not isinstance(raw, dict):
        return None
    # An option without `pieces` is not actionable (it would convert to
    # an empty work order), so it is dropped rather than surfaced.
    pieces = [p for p in (raw.get("pieces") or []) if isinstance(p, dict)]
    if not pieces:
        return None
    return {
        "id": str(raw.get("id") or f"opt-{index + 1}"),
        "name": str(raw.get("name") or f"Opción {index + 1}"),
        "is_selected": bool(raw.get("is_selected") or False),
        "pieces": pieces,
        # Phase 2+ computes these; default 0 keeps the contract stable.
        "subtotal_ars": float(raw.get("subtotal_ars") or 0),
        "subtotal_usd": float(raw.get("subtotal_usd") or 0),
    }


def resolve_budget_options(
    options_data: Any,
    pieces_data: Any = None,
) -> list[dict]:
    """Return the budget's options, synthesising a legacy one when needed.

    This is THE entry point for the multi-option model. It guarantees a
    non-empty list for any budget that has at least one piece, so every
    downstream consumer (calculator, PDF, conversion) can iterate
    `for option in resolve_budget_options(...)` without branching on
    legacy vs multi.

    Behaviour:
      * `options_data` with ≥1 usable option → those options, normalised.
      * `options_data` present but every option is empty/malformed →
        fall back to the legacy synthesis (a corrupt option list must
        not hide the budget's real configuration).
      * no `options_data` → one synthetic `Opción Única` wrapping
        `pieces_data`.
      * neither → `[]` (a budget with no pieces at all).
    """
    raw_options: list = []
    if options_data is not None and options_data != "":
        candidate: Any = options_data
        if isinstance(candidate, (bytes, bytearray)):
            try:
                candidate = candidate.decode("utf-8")
            except Exception:
                candidate = None
        if isinstance(candidate, str):
            try:
                candidate = json.loads(candidate)
            except (json.JSONDecodeError, ValueError):
                logger.warning("Malformed options_data — falling back to legacy")
                candidate = None
        if isinstance(candidate, list):
            raw_options = candidate

    normalized: list[dict] = []
    for i, raw in enumerate(raw_options):
        option = _normalize_option(raw, i)
        if option is not None:
            normalized.append(option)
    if normalized:
        return normalized

    # ── Legacy fallback: one "Opción Única" built from pieces_data ──
    legacy_pieces = parse_pieces(pieces_data)
    if not legacy_pieces:
        return []
    return [{
        "id": SINGLE_OPTION_ID,
        "name": SINGLE_OPTION_NAME,
        "is_selected": True,
        "pieces": legacy_pieces,
        "subtotal_ars": 0.0,
        "subtotal_usd": 0.0,
    }]


def find_option(options: list[dict], option_id: Optional[str]) -> Optional[dict]:
    """Look up one option by id (tolerant of None/'' → the single option).

    With `option_id=None` and exactly one option, that option is returned
    so legacy callers that don't pass an id keep working; with several
    options and no id, `None` is returned because guessing would risk
    converting the wrong one.
    """
    if not options:
        return None
    if option_id in (None, ""):
        return options[0] if len(options) == 1 else None
    key = str(option_id)
    for option in options:
        if str(option.get("id")) == key:
            return option
    return None


def is_multi_option(budget: Any) -> bool:
    """True when the budget carries more than one real (stored) option.

    Reads the raw `options_data` column — a legacy budget answers False
    even though `resolve_budget_options` synthesises one option for it.
    The UI uses this to decide whether to render the option tabs.
    """
    raw = getattr(budget, "options_data", None)
    if not raw:
        return False
    candidate: Any = raw
    if isinstance(candidate, (bytes, bytearray)):
        try:
            candidate = candidate.decode("utf-8")
        except Exception:
            return False
    if isinstance(candidate, str):
        try:
            candidate = json.loads(candidate)
        except (json.JSONDecodeError, ValueError):
            return False
    return isinstance(candidate, list) and len(candidate) > 1