"""Tests for `_build_measurement_comparison` (COMPARATIVA DE MEDICIÓN).

The builder mirrors the frontend `buildMeasurementComparison`: one primary
row per main material (M² numbers + its own m²-delta subtotal) and below it
indented detail rows for each linked zócalo/frente. Since the previous
sessions, detail rows also carry unit-aware measure columns — m² for
zócalos, ml for frentes — where the "Presupuestado" value is the
`m2_budgeted` / `linear_meters_budgeted` snapshot taken at conversion and the
"Real" value the current form state. Legacy rows (no dimensional snapshot)
show the real measure with None on budgeted/delta ('—' in the template).
"""
import json

from app.services.pdf_html import _build_measurement_comparison


def _materials(name="NEGRO BRASIL", m2_budgeted=3.0, length=6, width=1, currency="USD",
               price_m2_usd=330.0, price_m2=330000.0, quantity=1):
    return [
        {
            "id": 1,
            "name": name,
            "currency": currency,
            "price_m2_usd": price_m2_usd,
            "price_m2": price_m2,
            "quantity": quantity,
            "length": length,
            "width": width,
            "m2_budgeted": m2_budgeted,
            "is_alternative": False,
        }
    ]


def test_material_row_keeps_measure_columns_and_own_delta():
    rows = _build_measurement_comparison(
        _materials(m2_budgeted=3.0, length=6, width=1),
        usd_rate=1000,
    )
    assert len(rows) == 1
    row = rows[0]
    assert row["is_detail"] is False
    assert row["m2_budgeted_str"] == "3"
    assert row["m2_real_str"] == "6"
    assert row["delta_str"] == "+3"
    assert row["subtotal_usd"] == 990.0  # (6 − 3) × 330 USD/m²
    assert row["subtotal_ars"] == 990000.0


def test_zocalo_detail_row_with_snapshot_shows_full_measure_columns():
    fabrication = json.dumps([
        {
            "concept": "BASEBOARD",
            "material": "NEGRO BRASIL",
            "length": 4,
            "width": 0.105,
            "quantity": 1,
            "price": 50,
            "currency": "USD",
            "m2_budgeted": 0.34,
            "total_ars_budgeted": 30000,
            "total_usd_budgeted": 30,
        }
    ])
    rows = _build_measurement_comparison(
        _materials(), usd_rate=1000, fabrication_raw=fabrication
    )
    zocalo = rows[1]
    assert zocalo["is_detail"] is True
    assert zocalo["name"] == "Zócalo NEGRO BRASIL"
    assert zocalo["measure_unit"] == "m²"
    assert zocalo["measure_budgeted_str"] == "0.34 m²"
    assert zocalo["measure_real_str"] == "0.42 m²"  # 4 × 0.105 × 1
    assert zocalo["measure_delta_str"] == "+0.08 m²"
    assert zocalo["subtotal_usd"] == 20  # money delta 50 − 30 budgeted USD


def test_zocalo_detail_row_without_snapshot_shows_real_only():
    fabrication = json.dumps([
        {
            "concept": "BASEBOARD",
            "material": "NEGRO BRASIL",
            "length": 4,
            "width": 0.105,
            "quantity": 1,
            "price": 50,
            "currency": "USD",
        }
    ])
    rows = _build_measurement_comparison(
        _materials(), usd_rate=1000, fabrication_raw=fabrication
    )
    zocalo = rows[1]
    assert zocalo["measure_unit"] == "m²"
    assert zocalo["measure_real_str"] == "0.42 m²"
    assert zocalo["measure_budgeted_str"] is None
    assert zocalo["measure_delta_str"] is None
    # Without a monetary snapshot either, the money delta is 0 (always shown).
    assert zocalo["subtotal_usd"] == 0
    assert zocalo["subtotal_usd_str"] == "0.00"


def test_frente_detail_row_measured_in_ml():
    additional = json.dumps([
        {
            "name": "Frente Ingletetado 45°",
            "type": "frente",
            "price": 100,
            "quantity": 1,
            "total": 100,
            "currency": "USD",
            "materialName": "NEGRO BRASIL",
            "linear_meters": 3,
            "linear_meters_budgeted": 3,
            "total_ars_budgeted": 80000,
            "total_usd_budgeted": 80,
        }
    ])
    rows = _build_measurement_comparison(
        _materials(), usd_rate=1000, additional_raw=additional
    )
    frente = rows[1]
    assert frente["is_detail"] is True
    assert frente["name"] == "Frente Ingletetado 45°"
    assert frente["measure_unit"] == "ml"
    assert frente["measure_budgeted_str"] == "3 ml"
    assert frente["measure_real_str"] == "3 ml"
    assert frente["measure_delta_str"] == "0 ml"
    assert frente["subtotal_usd"] == 20


def test_flat_additional_work_has_no_measure_columns():
    additional = json.dumps([
        {
            "name": "Pulido general",
            "type": "flat",
            "price": 50000,
            "quantity": 1,
            "total": 50000,
            "currency": "ARS",
            "materialName": "NEGRO BRASIL",
            "total_ars_budgeted": 50000,
            "total_usd_budgeted": 50,
        }
    ])
    rows = _build_measurement_comparison(
        _materials(), usd_rate=1000, additional_raw=additional
    )
    pulido = rows[1]
    assert pulido["measure_unit"] is None
    assert pulido["measure_budgeted_str"] is None
    assert pulido["measure_real_str"] is None
    assert pulido["measure_delta_str"] is None
    assert pulido["subtotal_usd"] == 0  # unchanged → delta 0, still shown


def test_global_and_unmatched_rows_are_skipped():
    additional = json.dumps([
        {
            "name": "Traforo de Pileta",
            "type": "flat",
            "currency": "ARS",
            "price": 60000,
            "quantity": 1,
            "total": 60000,
            "materialName": "POOL_MATERIAL_GLOBAL",
        },
        {
            "name": "Frente de otro material",
            "type": "frente",
            "currency": "USD",
            "price": 50,
            "quantity": 1,
            "total": 50,
            "materialName": "OTRO MATERIAL",
            "linear_meters": 2,
        },
    ])
    rows = _build_measurement_comparison(
        _materials(), usd_rate=1000, additional_raw=additional
    )
    assert len(rows) == 1
    assert rows[0]["is_detail"] is False


def _two_mesadas_negro_brasil():
    """Helper: two NEGRO BRASIL materials — the regression scenario."""
    return [
        {
            "id": 1,
            "name": "NEGRO BRASIL",
            "currency": "USD",
            "price_m2_usd": 330.0,
            "price_m2": 0,
            "quantity": 1,
            "length": 2.75,
            "width": 0.64,
            "m2_budgeted": 1.728,
            "is_alternative": False,
        },
        {
            "id": 2,
            "name": "NEGRO BRASIL",
            "currency": "USD",
            "price_m2_usd": 330.0,
            "price_m2": 0,
            "quantity": 1,
            "length": 0.68,
            "width": 0.64,
            "m2_budgeted": 0.384,
            "is_alternative": False,
        },
    ]


def test_single_frente_assigned_to_multiple_mesadas_is_deduplicated():
    """Regression: one "Frente Ingletetado 45°" assigned to NEGRO BRASIL
    covers two mesadas. The frente is billed in TOTAL METROS LINEALES, so
    the comparison must render it exactly once — not twice.
    """
    additional = json.dumps([
        {
            "additional_work_id": 88,
            "name": "Frente Ingletetado 45°",
            "type": "frente",
            "currency": "USD",
            "price": 49.33,
            "quantity": 1,
            "total": 169.20,  # 49.33 × 3.43 ml (single item, both mesadas)
            "materialName": "NEGRO BRASIL",
            "linear_meters": 3.43,
            "linear_meters_budgeted": 3.3,
            "total_ars_budgeted": 5068.0,
            "total_usd_budgeted": 163.49,
        },
    ])
    rows = _build_measurement_comparison(
        _two_mesadas_negro_brasil(), usd_rate=1000, additional_raw=additional
    )
    # 2 NEGRO BRASIL rows + exactly 1 frente detail row (deduped).
    assert len(rows) == 3
    detail_rows = [r for r in rows if r["is_detail"]]
    assert len(detail_rows) == 1
    frente = detail_rows[0]
    assert frente["name"] == "Frente Ingletetado 45°"
    assert frente["measure_unit"] == "ml"
    assert frente["measure_real_str"] == "3.43 ml"
    assert frente["measure_budgeted_str"] == "3.3 ml"
    assert frente["measure_delta_str"] == "+0.13 ml"
    # Subtotal = real_total − budgeted_total in USD: 169.20 − 163.49 = 5.71.
    assert abs(frente["subtotal_usd"] - 5.71) < 0.01


def test_single_zocalo_fabrication_row_assigned_to_multiple_same_name_pieces_is_deduplicated():
    """Regression: ONE zócalo fabrication row assigned to NEGRO BRASIL covers
    two equally-named mesadas. It must render exactly once (under the first
    matching piece), not under every piece.
    """
    fabrication = json.dumps([
        {
            "concept": "BASEBOARD",
            "detail": "Zócalo",
            "length": 4,
            "width": 0.105,
            "quantity": 1,
            "m2_budgeted": 0.34,
            "price": 50,
            "currency": "USD",
            "material": "NEGRO BRASIL",
            "total_ars_budgeted": 30000.0,
            "total_usd_budgeted": 30.0,
        },
    ])
    rows = _build_measurement_comparison(
        _two_mesadas_negro_brasil(), usd_rate=1000, fabrication_raw=fabrication
    )
    # 2 NEGRO BRASIL rows + exactly 1 zócalo detail row (deduped).
    assert len(rows) == 3
    detail_rows = [r for r in rows if r["is_detail"]]
    assert len(detail_rows) == 1
    zocalo = detail_rows[0]
    assert zocalo["name"] == "Zócalo NEGRO BRASIL"
    assert zocalo["measure_unit"] == "m²"
    assert zocalo["measure_real_str"] == "0.42 m²"  # 4 × 0.105 × 1
    assert zocalo["measure_budgeted_str"] == "0.34 m²"
    assert zocalo["measure_delta_str"] == "+0.08 m²"
    # Subtotal = real_total − budgeted_total in USD: 50 − 30 = 20.
    assert abs(zocalo["subtotal_usd"] - 20.0) < 0.01


def test_rows_grouped_contiguously_by_material_not_input_order():
    """Regression: pieces entered interleaved (CARAVELLAS WHITE, CARRARA,
    CARAVELLAS WHITE) must render grouped by material name — all the same-name
    rows contiguous, zócalos indented under their own piece, no interleaving.
    """
    interleaved = [
        {"id": 1, "name": "CARAVELLAS WHITE", "currency": "USD", "price_m2_usd": 330.0,
         "price_m2": 0, "quantity": 1, "length": 1, "width": 1,
         "m2_budgeted": 1.0, "is_alternative": False},
        {"id": 2, "name": "CARRARA", "currency": "USD", "price_m2_usd": 310.0,
         "price_m2": 0, "quantity": 1, "length": 1.5, "width": 1,
         "m2_budgeted": 1.0, "is_alternative": False},
        {"id": 3, "name": "CARAVELLAS WHITE", "currency": "USD", "price_m2_usd": 330.0,
         "price_m2": 0, "quantity": 1, "length": 2, "width": 1,
         "m2_budgeted": 1.0, "is_alternative": False},
    ]
    fabrication = json.dumps([
        {
            "concept": "BASEBOARD",
            "detail": "Zócalo",
            "length": 4,
            "width": 0.105,
            "quantity": 1,
            "price": 50,
            "currency": "USD",
            "material": "CARRARA",
        },
    ])
    rows = _build_measurement_comparison(
        interleaved, usd_rate=1000, fabrication_raw=fabrication
    )
    names = [r["name"] for r in rows]
    # Material rows sorted by name (CARAVELLAS WHITE < CARRARA), both
    # CARAVELLAS WHITE pieces contiguous, zócalo indented under CARRARA.
    assert names == [
        "CARAVELLAS WHITE",
        "CARAVELLAS WHITE",
        "CARRARA",
        "Zócalo CARRARA",
    ]
    detail_rows = [r for r in rows if r["is_detail"]]
    assert len(detail_rows) == 1


def test_frente_without_id_dedupes_by_name_fallback():
    """When the adicional has no `additional_work_id`, dedupe by `name`
    so a single "Frente Ingletetado 45°" still renders only once even if
    its catalogue id is missing (legacy rows).
    """
    additional = json.dumps([
        {
            "name": "Frente Ingletetado 45°",
            "type": "frente",
            "currency": "USD",
            "price": 49.33,
            "quantity": 1,
            "total": 169.20,
            "materialName": "NEGRO BRASIL",
            "linear_meters": 3.43,
        },
    ])
    rows = _build_measurement_comparison(
        _two_mesadas_negro_brasil(), usd_rate=1000, additional_raw=additional
    )
    detail_rows = [r for r in rows if r["is_detail"]]
    assert len(detail_rows) == 1


def test_build_work_order_pdf_data_keeps_comparison_for_direct_orders():
    """Business rule: the COMPARATIVA DE MEDICIÓN toggle is available for
    BOTH direct work orders and orders converted from a budget. The gate is
    the per-order flag `include_measurement_comparison_in_pdf` only — a
    direct order may still print the comparison (its Presupuestado column
    renders "—" since there is no estimated snapshot).
    """
    from app.services.pdf_html import build_work_order_pdf_data

    base_order = {
        "number": "A-DIRECT-1",
        "status": "MEASUREMENT",
        "client_name": "Test",
        "currency": "ARS",
        "materials_data": json.dumps(_two_mesadas_negro_brasil()),
        "additional_works_data": json.dumps([
            {
                "additional_work_id": 88,
                "name": "Frente Ingletetado 45°",
                "type": "frente",
                "currency": "USD",
                "price": 49.33,
                "quantity": 1,
                "total": 169.20,
                "materialName": "NEGRO BRASIL",
                "linear_meters": 3.43,
            },
        ]),
        # No `budget_id` key → direct work order. The flag is on by
        # default, so the comparison IS built.
        "include_measurement_comparison_in_pdf": True,
        "usd_rate": 1000,
    }
    data = build_work_order_pdf_data(base_order, {}, {}, {})
    assert data["measurement_comparison"] != []

    # And the flag is still honoured: off → empty comparison.
    flag_off = {**base_order, "include_measurement_comparison_in_pdf": False}
    data2 = build_work_order_pdf_data(flag_off, {}, {}, {})
    assert data2["measurement_comparison"] == []