"""COMPARATIVA DE MEDICIÓN rows for the legacy PDF.

Builds the "Presupuestado vs Real vs Diferencia" table rows out of the
material / fabrication / additional-works arrays. Mirrors the frontend
``buildMeasurementComparison`` in ``buildSectionData.ts``.
"""
from app.services.pdf_html.formatting import _fmt_m2, _fmt_money, _fmt_num


def _parse_raw_list(raw):
    """Parse a JSON array (string or list) into a list of dicts, else []."""
    if not raw:
        return []
    import json as _json
    try:
        parsed = _json.loads(raw) if isinstance(raw, str) else raw
        return parsed if isinstance(parsed, list) else []
    except (_json.JSONDecodeError, TypeError):
        return []


def _build_measurement_comparison(
    materiales_raw: list,
    usd_rate: float = 0,
    fabrication_raw: str = None,
    additional_raw: str = None,
) -> list[dict]:
    """Build "COMPARATIVA DE MEDICIÓN" rows from `materials_data`.

    One primary row per main material with its M² Real (length × width ×
    quantity), M² Presupuestado (the snapshot `m2_budgeted` taken at
    conversion time) and their Diferencia. Only main materials participate
    (alternatives are filtered out upstream by `filter_main_materials`).

    Each primary row carries a monetary DIFERENCIA subtotal (ARS + USD): the
    price of the m² delta `(real − budgeted) × price/m²` in the material's
    native currency, converted to both currencies with `usd_rate` — i.e. the
    material's own delta ONLY.

    Directly below each material, linked zócalo/frente rows are emitted as
    indented detail rows (`is_detail=True`) showing only their own monetary
    delta (ARS + USD, signed) — one line per linked row from BOTH sources
    (fabrication_details + additional_works_data) whose `material` /
    `materialName` matches the material's name. A linked row's delta is
    `subtotal − total_*_budgeted` (snapshot taken at conversion), capturing
    measure (M²/ML) and material re-assignment changes. Global / unmatched
    rows are ignored.
    """

    def _delta(actual, budgeted):
        return 0 if budgeted is None else actual - budgeted

    def _signed(value):
        return f"{'+' if value > 0 else ''}{_fmt_money(value)}"

    def _measure_str(value, unit, sign=False):
        if value is None or not unit:
            return None
        # M² must show exactly 2 decimals (customer-facing); ml keeps the
        # compact measure formatting (`3 ml`, `3.3 ml`). Mirrors the frontend
        # `detailRow` branch in buildSectionData.ts.
        body = _fmt_m2(value) if unit == "m²" else _fmt_num(value)
        if sign and value > 0:
            body = f"+{body}"
        return f"{body} {unit}"

    _FAB_M2_CONCEPTS = {"LENGTH", "BASEBOARD", "FRONT", "LARGO", "ZOCALOS", "FRENTE"}
    _FAB_LINEAR_CONCEPTS = {"TERMINACION"}

    _FAB_LABELS = {
        "BASEBOARD": "Zócalo",
        "ZOCALOS": "Zócalo",
        "FRONT": "Frente",
        "FRENTE": "Frente",
        "LENGTH": "Longitud",
        "TERMINACION": "Terminación",
    }

    fabrication_items = _parse_raw_list(fabrication_raw)
    additional_items = _parse_raw_list(additional_raw)

    rows = []
    # Dedupe set for catalogue frentes: a single `additional_work_id`
    # (or `name` fallback) is emitted exactly once across the whole
    # comparison, even when its `materialName` matches multiple main
    # materials (e.g. one "Frente Ingletetado 45°" assigned to NEGRO
    # BRASIL covers two mesadas — we draw it once under whichever
    # material matches first, not twice). Mirrors the frontend's
    # `emittedFrenteKeys` in buildSectionData.ts.
    emitted_frente_keys = set()
    # Same dedupe for fabrication rows (zócalos): mirrors the frontend's
    # `emittedZocaloKeys` in buildSectionData.ts. A single row (keyed by
    # concept + material + detail + measures) is emitted exactly once,
    # avoiding a "Zócalo NEGRO BRASIL" under every equally-named piece.
    emitted_zocalo_keys = set()
    # Group pieces by material name so the comparison table renders
    # contiguously — all CARRARA rows (and their indented zócalos) together,
    # then all CARAVELLAS WHITE rows, even when entered interleaved.
    # Mirrors the frontend `buildMeasurementComparison` sort in
    # buildSectionData.ts. Stable sort preserves input order within a group.
    materials_sorted = sorted(
        (materiales_raw or []),
        key=lambda m: str(
            (m.get("name") or m.get("nombre") or "").strip().lower()
            if isinstance(m, dict)
            else ""
        ),
    )
    for mat in materials_sorted:
        if not isinstance(mat, dict):
            continue
        length = float(mat.get("length") or mat.get("largo") or 0)
        width = float(mat.get("width") or mat.get("ancho") or 0)
        quantity = float(mat.get("quantity") or mat.get("cantidad") or 1)
        m2_real = length * width * quantity
        m2_budgeted = float(mat.get("m2_budgeted") or 0)
        delta = m2_real - m2_budgeted
        currency = "USD" if str(mat.get("currency") or "").upper() == "USD" else "ARS"
        price_m2 = (
            float(mat.get("price_m2_usd") or mat.get("precio_m2_usd") or 0)
            if currency == "USD"
            else float(mat.get("price_m2") or mat.get("precio_m2") or 0)
        )
        delta_native = delta * price_m2
        subtotal_ars = delta_native if currency == "ARS" else (delta_native * usd_rate if usd_rate > 0 else 0)
        subtotal_usd = delta_native if currency == "USD" else (delta_native / usd_rate if usd_rate > 0 else 0)
        name = mat.get("name") or mat.get("nombre") or ""

        if m2_real > 0 or m2_budgeted > 0:
            rows.append({
                "name": name,
                "is_detail": False,
                "m2_budgeted_str": _fmt_m2(m2_budgeted) if m2_budgeted else None,
                "m2_real_str": _fmt_m2(m2_real),
                "delta_str": f"{'+' if delta > 0 else ''}{_fmt_m2(delta)}" if m2_budgeted else None,
                "subtotal_ars_str": _signed(subtotal_ars) if m2_budgeted else None,
                "subtotal_usd_str": _signed(subtotal_usd) if m2_budgeted else None,
                "subtotal_ars": subtotal_ars,
                "subtotal_usd": subtotal_usd,
            })

        # Indented detail rows — zócalo/frente from the fabrication table.
        for d in fabrication_items:
            mat_name = (d.get("material") or d.get("material_name") or "").strip()
            if not mat_name or mat_name != name:
                continue
            concept_code = str(d.get("concept") or d.get("concepto") or "").strip().upper()
            label = f"{_FAB_LABELS.get(concept_code, concept_code or 'Trabajo de fabricación')} {name}".strip()
            # Measure unit follows the concept: m² for zócalos/frentes, ml for
            # linear work. Budgeted = the `m2_budgeted` / `linear_meters_budgeted`
            # snapshot taken at conversion; legacy rows without it show '—'.
            fd_length = float(d.get("length") or d.get("largo") or 0)
            fd_width = float(d.get("width") or d.get("ancho") or 0)
            fd_qty = float(d.get("quantity") or d.get("cantidad") or 1)
            zocalo_key = (
                f"{concept_code}|{mat_name}|"
                f"{str(d.get('custom_concept') or d.get('detail') or '').strip()}|"
                f"{fd_length}|{fd_width}|{fd_qty}"
            )
            if zocalo_key in emitted_zocalo_keys:
                continue
            if concept_code in _FAB_M2_CONCEPTS:
                unit = "m²"
                real = fd_length * fd_width * fd_qty
                budgeted = d.get("m2_budgeted")
                budgeted = None if budgeted is None else float(budgeted)
            elif concept_code in _FAB_LINEAR_CONCEPTS:
                unit = "ml"
                real = fd_length * fd_qty
                budgeted = d.get("linear_meters_budgeted")
                budgeted = None if budgeted is None else float(budgeted)
            else:
                unit = None
                real = None
                budgeted = None
            d_delta = None if (budgeted is None or real is None) else real - budgeted
            # Monetary delta of the zócalo. Default: current total minus the
            # `total_*_budgeted` snapshot. Zócalos carried at `price: 0` (billed
            # through the base material's m²) fall back to valuing their M²
            # delta at the linked material's `price_m2` — price × qty would
            # otherwise always delta to 0 and hide the financial impact of a
            # real-vs-budgeted m² drift. Mirrors the frontend fallback in
            # buildSectionData.ts::buildMeasurementComparison.
            d_currency = "USD" if str(d.get("currency") or d.get("moneda") or "").upper() == "USD" else "ARS"
            line_total = float(d.get("price") or d.get("precio") or 0) * float(d.get("quantity") or d.get("cantidad") or 1)
            if line_total == 0 and unit == "m²" and d_delta is not None and price_m2 > 0:
                delta_native = d_delta * price_m2
                d_ars = delta_native if currency == "ARS" else (delta_native * usd_rate if usd_rate > 0 else 0)
                d_usd = delta_native if currency == "USD" else (delta_native / usd_rate if usd_rate > 0 else 0)
            else:
                line_ars = line_total if d_currency == "ARS" else (line_total * usd_rate if usd_rate > 0 else 0)
                line_usd = line_total if d_currency == "USD" else (line_total / usd_rate if usd_rate > 0 else 0)
                d_ars = _delta(line_ars, d.get("total_ars_budgeted"))
                d_usd = _delta(line_usd, d.get("total_usd_budgeted"))
            emitted_zocalo_keys.add(zocalo_key)
            rows.append({
                "name": label,
                "is_detail": True,
                "m2_budgeted_str": None,
                "m2_real_str": None,
                "delta_str": None,
                "measure_budgeted": budgeted,
                "measure_real": real,
                "measure_delta": d_delta,
                "measure_unit": unit,
                "measure_budgeted_str": _measure_str(budgeted, unit),
                "measure_real_str": _measure_str(real, unit),
                "measure_delta_str": _measure_str(d_delta, unit, sign=True),
                "subtotal_ars_str": _signed(d_ars),
                "subtotal_usd_str": _signed(d_usd),
                "subtotal_ars": d_ars,
                "subtotal_usd": d_usd,
            })

        # Indented detail rows — frentes/adicionales from the catalogue,
        # assigned to this material (globals are shown separately).
        #
        # Dedupe rule: a single `additional_work_id` (or `name` fallback)
        # is emitted EXACTLY ONCE across the whole comparison, even when
        # its `materialName` matches multiple main materials (e.g. one
        # "Frente Ingletetado 45°" assigned to NEGRO BRASIL covers two
        # mesadas — we draw it once under whichever material matches
        # first, not twice). This mirrors the business reality that
        # frentes are billed in TOTAL METROS LINEALES, not per mesada.
        for r in additional_items:
            raw_mat = str(r.get("materialName") or r.get("material_name") or "")
            if not raw_mat or raw_mat == "POOL_MATERIAL_GLOBAL":
                continue
            if raw_mat.startswith("__ALT__:"):
                raw_mat = raw_mat[len("__ALT__:"):]
            if raw_mat != name:
                continue
            dedupe_key = str(r.get("additional_work_id") or r.get("name") or "")
            if not dedupe_key or dedupe_key in emitted_frente_keys:
                continue
            r_currency = "USD" if str(r.get("currency") or "").upper() == "USD" else "ARS"
            price = float(r.get("price") or 0)
            quantity = float(r.get("quantity") or 1)
            total_src = float(r.get("total") or price * quantity)
            line_ars = total_src if r_currency == "ARS" else (total_src * usd_rate if usd_rate > 0 else 0)
            line_usd = total_src if r_currency == "USD" else (total_src / usd_rate if usd_rate > 0 else 0)
            d_ars = _delta(line_ars, r.get("total_ars_budgeted"))
            d_usd = _delta(line_usd, r.get("total_usd_budgeted"))
            label = str(r.get("name") or "Trabajo adicional")
            # Frentes are measured in ml (snapshot `linear_meters_budgeted`);
            # flat works carry no measure at all.
            is_frente = str(r.get("type") or "").lower() == "frente"
            if is_frente:
                unit = "ml"
                real = None if r.get("linear_meters") is None else float(r.get("linear_meters"))
                budgeted = r.get("linear_meters_budgeted")
                budgeted = None if budgeted is None else float(budgeted)
            else:
                unit = None
                real = None
                budgeted = None
            r_delta = None if (budgeted is None or real is None) else real - budgeted
            rows.append({
                "name": label,
                "is_detail": True,
                "m2_budgeted_str": None,
                "m2_real_str": None,
                "delta_str": None,
                "measure_budgeted": budgeted,
                "measure_real": real,
                "measure_delta": r_delta,
                "measure_unit": unit,
                "measure_budgeted_str": _measure_str(budgeted, unit),
                "measure_real_str": _measure_str(real, unit),
                "measure_delta_str": _measure_str(r_delta, unit, sign=True),
                "subtotal_ars_str": _signed(d_ars),
                "subtotal_usd_str": _signed(d_usd),
                "subtotal_ars": d_ars,
                "subtotal_usd": d_usd,
            })
            emitted_frente_keys.add(dedupe_key)
    return rows
