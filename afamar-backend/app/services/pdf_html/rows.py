"""Row builders for the legacy PDF templates.

Turn the raw JSON arrays (``fabrication_details`` / ``materials_data`` /
``pools_data``) into the pre-computed row dicts the Jinja2 template
consumes. The template can't compute, so every cell is formatted here.
"""
from app.services.pdf_html.formatting import (
    _concept_to_display,
    _fmt_m2,
    _fmt_money,
    _fmt_unit,
)


def _parse_fabrication_details(raw, use_budgeted_measures: bool = False) -> list[dict]:
    if not raw:
        return []
    import json as _json
    try:
        parsed = _json.loads(raw) if isinstance(raw, str) else raw
        items = parsed if isinstance(parsed, list) else []
    except (_json.JSONDecodeError, TypeError):
        return []

    # Concepts that are priced per square meter (Largo × Ancho × Cant × $/m²).
    # Map to the English concept code shipped by the frontend today; keep the
    # legacy Spanish keys so older rows still classify correctly.
    M2_CONCEPTS = {"LENGTH", "BASEBOARD", "FRONT", "LARGO", "ZOCALOS", "FRENTE"}
    # Concepts that are billed per piece / per cut (Cant × $).
    UNIT_CONCEPTS = {
        "CUTOUT_SINK", "CUTOUT_COOKTOP", "CUTOUT_DROPIN_SINK", "PILETA MOD",
        "TRAFORO_PILETA", "TRAFORO_ANAFE", "TRAFORO_PILETA_APOYO",
    }
    # Concepts billed per linear meter (Largo × $).
    LINEAR_CONCEPTS = {"TERMINACION"}

    result = []
    for d in items:
        # Accept both legacy Spanish keys (`concepto`, `largo`, `ancho`, …)
        # and the English keys that the frontend now ships after the type
        # migration (`concept`, `length`, `width`, …). Older rows in the DB
        # were stored in Spanish; newer ones in English.
        concept_code = (
            (d.get("concepto") or d.get("concept") or "").strip().upper()
        )
        custom = (d.get("concepto_personalizado") or d.get("custom_concept") or "").strip()
        length = float(d.get("largo", 0) or d.get("length", 0) or 0)
        width = float(d.get("ancho", 0) or d.get("width", 0) or 0)
        quantity = float(d.get("cantidad", 1) or d.get("quantity", 1) or 1)
        price = float(d.get("precio", 0) or d.get("price", 0) or 0)

        # Decide which columns apply. This drives the "—" placeholders the
        # template renders for irrelevant fields — the schema is rich but no
        # single row uses every column.
        is_m2 = concept_code in M2_CONCEPTS
        is_unit = concept_code in UNIT_CONCEPTS
        is_linear = concept_code in LINEAR_CONCEPTS
        show_length = is_m2 or is_linear or length > 0
        show_width = is_m2 or width > 0
        show_m2 = is_m2
        show_quantity = is_m2 or is_unit or quantity > 0

        # M² is meaningful only when we actually have length & width. For
        # unit cuts the cell shows "U" (unit) instead.
        budgeted_m2 = float(d.get("m2_budgeted")) if d.get("m2_budgeted") is not None else None
        m2_value = (
            budgeted_m2 if use_budgeted_measures and budgeted_m2 is not None
            else round(length * width * quantity, 8)
        ) if is_m2 else None

        result.append({
            "concept": _concept_to_display(concept_code, custom),
            "detail": d.get("detalle", "") or d.get("detail", "") or "",
            "material": d.get("material", "") or "",
            "show_length": show_length,
            "show_width": show_width,
            "show_m2": show_m2,
            "show_quantity": show_quantity,
            "length_str": _fmt_unit(length, suffix="m") if show_length and length else None,
            "width_str": _fmt_unit(width, suffix="m") if show_width and width else None,
            "m2_label": "U" if is_unit else _fmt_m2(m2_value) if is_m2 else None,
            "quantity": int(quantity) if quantity and float(quantity).is_integer() else quantity,
            "price_str": _fmt_money(price),
        })
    return result


def _build_materials_pdf(main_materials: list, alternatives: list, use_budgeted_measures: bool = False) -> list[dict]:
    result = []
    for src in (main_materials or []) + (alternatives or []):
        length = src.get("largo") or src.get("length", 0) or 0
        width = src.get("ancho") or src.get("width", 0) or 0
        quantity = src.get("cantidad") or src.get("quantity", 1) or 1
        budgeted_m2 = float(src.get("m2_budgeted")) if src.get("m2_budgeted") is not None else None
        m2 = budgeted_m2 if use_budgeted_measures and budgeted_m2 is not None else length * width * quantity
        price_m2 = src.get("precio_m2") or src.get("price_m2", 0) or 0
        subtotal = m2 * price_m2
        result.append({
            "name": src.get("nombre") or src.get("name", ""),
            "color": src.get("color", ""),
            "length_str": _fmt_unit(length, suffix="m"),
            "width_str": _fmt_unit(width, suffix="m"),
            "quantity": int(quantity) if float(quantity).is_integer() else float(quantity),
            "m2_str": _fmt_m2(m2),
            "price_m2_str": _fmt_money(price_m2),
            "subtotal_str": _fmt_money(subtotal),
        })
    return result


def _build_pools_pdf(pools: list) -> list[dict]:
    result = []
    for p in pools or []:
        quantity = p.get("cantidad") or p.get("quantity", 1) or 1
        price = p.get("precio") or p.get("price", 0) or 0
        subtotal = price * quantity
        result.append({
            "brand": p.get("marca") or p.get("brand", ""),
            "model": p.get("modelo") or p.get("model", ""),
            "quantity": int(quantity) if float(quantity).is_integer() else float(quantity),
            "price_str": _fmt_money(price),
            "subtotal_str": _fmt_money(subtotal),
        })
    return result


def _parse_piece_list(raw) -> list[dict]:
    """Parse a piece-owned JSON list without changing the source data."""
    if not raw:
        return []
    import json as _json

    try:
        parsed = _json.loads(raw) if isinstance(raw, str) else raw
    except (_json.JSONDecodeError, TypeError):
        return []
    return parsed if isinstance(parsed, list) else []


def _build_piece_materials_pdf(materials: list, use_budgeted_measures: bool = False) -> list[dict]:
    """Build display rows for the OT piece cards.

    This mirrors the existing material row presentation but keeps the native
    currency visible for the piece layout. It does not feed document totals.
    """
    result = []
    for src in materials or []:
        if not isinstance(src, dict):
            continue
        length = float(src.get("length") or src.get("largo") or 0)
        width = float(src.get("width") or src.get("ancho") or 0)
        quantity = float(src.get("quantity") or src.get("cantidad") or 1)
        currency = "USD" if str(src.get("currency") or "").upper() == "USD" else "ARS"
        price_key = "price_m2_usd" if currency == "USD" else "price_m2"
        price = float(src.get(price_key) or 0)
        budgeted_m2 = float(src.get("m2_budgeted")) if src.get("m2_budgeted") is not None else None
        m2 = budgeted_m2 if use_budgeted_measures and budgeted_m2 is not None else length * width * quantity
        result.append({
            "name": src.get("name") or src.get("nombre") or "",
            "color": src.get("color") or "",
            "length_str": _fmt_unit(length, suffix="m"),
            "width_str": _fmt_unit(width, suffix="m"),
            "quantity": int(quantity) if quantity.is_integer() else quantity,
            "m2_str": _fmt_m2(m2),
            "price_str": _fmt_money(price),
            "subtotal_str": _fmt_money(m2 * price),
            "currency": currency,
        })
    return result


def _build_piece_additional_pdf(raw, use_budgeted_measures: bool = False) -> list[dict]:
    """Build presentation rows for piece-owned additional works."""
    result = []
    for src in _parse_piece_list(raw):
        if not isinstance(src, dict):
            continue
        currency = "USD" if str(src.get("currency") or "").upper() == "USD" else "ARS"
        price = float(src.get("price") or 0)
        quantity = float(src.get("quantity") or 1)
        budgeted_key = "total_usd_budgeted" if currency == "USD" else "total_ars_budgeted"
        budgeted_total = float(src[budgeted_key]) if src.get(budgeted_key) is not None else None
        total = budgeted_total if use_budgeted_measures and budgeted_total is not None else float(src.get("total") or price * quantity)
        result.append({
            "name": src.get("name") or "Trabajo adicional",
            "detail": src.get("detail") or src.get("detalle") or "",
            "quantity": int(quantity) if quantity.is_integer() else quantity,
            "price_str": _fmt_money(price),
            "total_str": _fmt_money(total),
            "currency": currency,
        })
    return result


def _build_work_order_pieces_pdf(raw, usd_rate: float = 0, use_budgeted_measures: bool = False) -> list[dict]:
    """Adapt ``pieces_data`` into presentation-only OT card rows.

    The legacy builder remains flat for budgets and for OTs without valid
    pieces. These rows are only consumed by the conditional OT template block;
    financial values continue to come from the persisted order fields.
    """
    pieces = _parse_piece_list(raw)
    result = []
    for piece in pieces:
        if not isinstance(piece, dict):
            continue
        main = piece.get("mainMaterial")
        main_rows = piece.get("mainMaterialRows") or []
        materials = ([main] if isinstance(main, dict) else []) + [
            row for row in main_rows if isinstance(row, dict)
        ]
        fabrication = _parse_fabrication_details(piece.get("fabrication_details"), use_budgeted_measures)
        for row in fabrication:
            row["currency"] = "USD" if str(row.get("currency") or "").upper() == "USD" else "ARS"
        result.append({
            "name": piece.get("name") or "Pieza",
            "materials": _build_piece_materials_pdf(materials, use_budgeted_measures),
            "fabrication": fabrication,
            "additional": _build_piece_additional_pdf(piece.get("additional_works_data"), use_budgeted_measures),
            "pools": _build_pools_pdf(piece.get("pools") or []),
        })
    return [
        piece for piece in result
        if piece["materials"] or piece["fabrication"] or piece["additional"] or piece["pools"]
    ]
