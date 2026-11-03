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
        m2_value = round(length * width * quantity, 8) if is_m2 else None
        budgeted_native_total = (
            float(d.get("total_usd_budgeted"))
            if str(d.get("currency") or "ARS").upper() == "USD"
            and d.get("total_usd_budgeted") is not None
            else float(d.get("total_ars_budgeted"))
            if d.get("total_ars_budgeted") is not None
            else None
        )
        display_price = (
            budgeted_native_total
            if use_budgeted_measures and budgeted_native_total is not None
            else price
        )

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
            "price_str": _fmt_money(display_price),
        })
    return result


def _build_materials_pdf(main_materials: list, alternatives: list, use_budgeted_measures: bool = False) -> list[dict]:
    """Build material rows using the dimensions currently stored on the row.

    ``m2_budgeted`` belongs to the measurement comparison, not the visible
    current-measurement row.  Keep the parameter for callers that also build
    fabrication/additional rows, but never let a historical snapshot replace
    the current material surface here.
    """
    result = []
    for src in (main_materials or []) + (alternatives or []):
        length = src.get("largo") or src.get("length", 0) or 0
        width = src.get("ancho") or src.get("width", 0) or 0
        quantity = src.get("cantidad") or src.get("quantity", 1) or 1
        m2 = length * width * quantity
        budgeted_m2 = float(src.get("m2_budgeted")) if src.get("m2_budgeted") is not None else None
        commercial_m2 = budgeted_m2 if use_budgeted_measures and budgeted_m2 is not None else m2
        price_m2 = src.get("precio_m2") or src.get("price_m2", 0) or 0
        subtotal = commercial_m2 * price_m2
        result.append({
            "name": src.get("nombre") or src.get("name", ""),
            "color": src.get("color", ""),
            "length_str": _fmt_unit(length, suffix="m") if length else None,
            "width_str": _fmt_unit(width, suffix="m") if width else None,
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
        # Piece cards show the current measured dimensions.  Historical
        # m2_budgeted is rendered only by the measurement comparison.
        m2 = length * width * quantity
        budgeted_m2 = float(src.get("m2_budgeted")) if src.get("m2_budgeted") is not None else None
        commercial_m2 = (
            budgeted_m2 if use_budgeted_measures and budgeted_m2 is not None else m2
        )
        result.append({
            "name": src.get("name") or src.get("nombre") or "",
            "color": src.get("color") or "",
            "length_str": _fmt_unit(length, suffix="m"),
            "width_str": _fmt_unit(width, suffix="m"),
            "quantity": int(quantity) if quantity.is_integer() else quantity,
            "m2_str": _fmt_m2(m2),
            "price_str": _fmt_money(price),
            "subtotal_str": _fmt_money(commercial_m2 * price),
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
        linear_meters = float(src.get("linear_meters") or src.get("metros_lineales") or 0)
        budgeted_linear_meters = src.get("linear_meters_budgeted")
        displayed_quantity = (
            float(budgeted_linear_meters)
            if use_budgeted_measures and budgeted_linear_meters is not None
            else linear_meters
            if str(src.get("type") or "").lower() == "frente"
            else quantity
        )
        result.append({
            "name": src.get("name") or "Trabajo adicional",
            "detail": src.get("detail") or src.get("detalle") or "",
            "quantity": int(displayed_quantity) if displayed_quantity.is_integer() else displayed_quantity,
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


def _apply_approval_breakdown_to_pieces(
    pieces: list[dict], breakdown: dict | None,
) -> tuple[list[dict], list[dict]]:
    """Overlay approved line amounts without re-running commercial rules.

    Dimensions remain the current fabrication dimensions already present in the
    piece rows. Only the persisted approved line amounts and piece subtotals
    are replaced. Global lines are returned separately so callers do not attach
    them to an arbitrary piece.
    """
    if not isinstance(breakdown, dict):
        return pieces, []
    approved_pieces = breakdown.get("pieces") or []
    for index, piece in enumerate(pieces):
        source = next(
            (candidate for candidate in approved_pieces if candidate.get("name") == piece.get("name")),
            approved_pieces[index] if index < len(approved_pieces) else None,
        )
        if not isinstance(source, dict):
            continue
        by_kind = {}
        for line in source.get("lines") or []:
            by_kind.setdefault(line.get("line_kind"), []).append(line)
        for kind, key in (("material", "materials"), ("fabrication", "fabrication"), ("additional", "additional"), ("pool", "pools")):
            for row, line in zip(piece.get(key) or [], by_kind.get(kind, [])):
                amount = line.get("subtotal_approved") or {}
                native = amount.get("native", amount.get("usd", amount.get("ars", 0)))
                row["currency"] = amount.get("currency", row.get("currency", "ARS"))
                if key == "additional":
                    row["total_str"] = _fmt_money(native)
                elif key == "materials" or key == "pools":
                    row["subtotal_str"] = _fmt_money(native)
                else:
                    row["subtotal_str"] = _fmt_money(native)
        subtotal = source.get("subtotal_approved") or {}
        piece["subtotal_ars_str"] = _fmt_money(subtotal.get("ars", 0))
        piece["subtotal_usd_str"] = _fmt_money(subtotal.get("usd", 0))
    global_rows = []
    for line in breakdown.get("global_lines") or []:
        amount = line.get("subtotal_approved") or {}
        native = amount.get("native", amount.get("usd", amount.get("ars", 0)))
        global_rows.append({
            "name": line.get("concept_type") or line.get("line_kind") or "Concepto global",
            "detail": line.get("material") or "",
            "currency": amount.get("currency", "ARS"),
            "total_str": _fmt_money(native),
        })
    return pieces, global_rows


def _apply_approval_breakdown_to_flat_rows(
    materials: list[dict],
    fabrication: list[dict],
    additional: list[dict],
    pools: list[dict],
    breakdown: dict | None,
) -> tuple[list[dict], list[dict], list[dict], list[dict]]:
    """Apply approved amounts to the legacy flat layout, if it is used."""
    if not isinstance(breakdown, dict):
        return materials, fabrication, additional, pools
    lines = [
        line
        for piece in breakdown.get("pieces") or []
        for line in piece.get("lines") or []
    ] + list(breakdown.get("global_lines") or [])
    by_kind: dict[str, list[dict]] = {}
    for line in lines:
        by_kind.setdefault(line.get("line_kind"), []).append(line)

    def apply(rows: list[dict], kind: str, field: str) -> list[dict]:
        result = []
        for row, line in zip(rows, by_kind.get(kind, [])):
            amount = line.get("subtotal_approved") or {}
            native = amount.get("native", amount.get("usd", amount.get("ars", 0)))
            copy = {**row, "currency": amount.get("currency", row.get("currency", "ARS"))}
            copy[field] = _fmt_money(native)
            result.append(copy)
        return result + rows[len(result):]

    return (
        apply(materials, "material", "subtotal_str"),
        apply(fabrication, "fabrication", "subtotal_str"),
        apply(additional, "additional", "total_str"),
        apply(pools, "pool", "subtotal_str"),
    )
