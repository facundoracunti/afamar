"""Formatting helpers for the legacy PDF templates.

Date / money / area / unit formatting plus the term-list splitter and the
fabrication-concept label map. All of them are pure functions so the row
builders and the data builders can share them.
"""
from datetime import datetime


def _split_terms(value) -> list[str]:
    """Return a clean list of non-blank terms from `value`.

    Accepts:
      - list[str]: the new structured shape from /admin/configuration
      - str: JSON-encoded list (auto-parsed), or legacy multi-line plain text
      - None/empty: returns []
    """
    if value is None:
        return []
    if isinstance(value, list):
        return [str(t).strip() for t in value if str(t).strip()]
    text = str(value).strip()
    if not text:
        return []
    # Try JSON first — the frontend sends terms as JSON-encoded lists
    if text.startswith("["):
        import json as _json
        try:
            parsed = _json.loads(text)
            if isinstance(parsed, list):
                return [str(t).strip() for t in parsed if str(t).strip()]
        except (_json.JSONDecodeError, TypeError):
            pass
    # Legacy plain-text fallback: split on newlines
    return [t for t in (line.strip() for line in text.splitlines()) if t]


def _format_date(d):
    if not d:
        return datetime.now().strftime("%d/%m/%Y")
    if isinstance(d, str):
        try:
            return datetime.strptime(d[:10], "%Y-%m-%d").strftime("%d/%m/%Y")
        except ValueError:
            return d
    return d.strftime("%d/%m/%Y")


def _format_date_optional(d):
    """Formats `d` for display but returns '' instead of "today" when the
    value is empty — a document without a delivery date must render the
    field blank (the legacy `_format_date` fallback to today would print a
    delivery date the customer never agreed to)."""
    if not d:
        return ""
    return _format_date(d)


_CONCEPT_DISPLAY = {
    "BASEBOARD": "Zócalo",
    "FRONT": "Frente",
    "LENGTH": "Longitud",
    "ZOCALOS": "Zócalos",
    "CUTOUT_SINK": "Traforo de Pileta",
    "CUTOUT_COOKTOP": "Traforo de Anafe",
    "CUTOUT_DROPIN_SINK": "Traforo de Pileta de Apoyo",
    "PILETA MOD": "Pileta Mod.",
    "TERMINACION": "Terminación",
    "OTHER": "Otro",
}


# _STATUS_SUB_MAP (PENDING → "Pendiente", MEASUREMENT → "Medición", etc.)
# used to feed `doc_sub` in the legacy header. The grey status caption was
# dropped from the PDF (2026-09-25 mañana): the cash-board / list page
# already shows the status, so the header was redundant + visually noisy.
# The dict is intentionally kept as documentation of the historical
# status → label mapping (used by the WhatsApp message formatter in
# `app/services/whatsapp.py`); the legacy PDF no longer consumes it.


def _concept_to_display(concept_code: str, custom: str = "") -> str:
    if concept_code == "OTHER" and custom:
        return custom
    return _CONCEPT_DISPLAY.get(concept_code, concept_code or "—")


def _fmt_num(value, decimals: int = 8) -> str:
    """Format a number for the PDF template.

    xhtml2pdf's Jinja2 has a buggy `|format` filter — instead of running the
    Python format spec it often prints the spec string verbatim
    (`%.2f` literal in the rendered PDF). Pre-formatting on the Python side
    sidesteps the bug entirely and gives us consistent output.
    """
    try:
        n = float(value or 0)
    except (TypeError, ValueError):
        n = 0.0
    return f"{n:,.{decimals}f}".rstrip("0").rstrip(".")


def _fmt_money(value) -> str:
    """Format an ARS/USD amount for the PDF (no currency symbol — the
    template renders `$ ` separately to keep right-aligned numbers tidy)."""
    try:
        n = float(value or 0)
    except (TypeError, ValueError):
        n = 0.0
    return f"{n:,.2f}"


def _fmt_m2(value) -> str:
    """Format an area (m²) with EXACTLY 2 decimals for the PDF template.

    Customer-facing M² surfaces must always render `0,42` (never a 3/4-decimal
    `0.4352` trimmed by `_fmt_num`, and never a bare `0.42`). This mirrors the
    frontend `fmtNum(v, 2)` used by the `@react-pdf/renderer` preview.
    """
    try:
        n = float(value or 0)
    except (TypeError, ValueError):
        n = 0.0
    return f"{n:,.2f}"


def _fmt_unit(value, decimals: int = 8, suffix: str = "") -> str:
    """Format a measurement-like value with an optional unit suffix."""
    return f"{_fmt_num(value, decimals)} {suffix}".strip()
