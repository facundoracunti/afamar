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