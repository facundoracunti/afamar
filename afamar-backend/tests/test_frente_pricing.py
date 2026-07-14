"""Unit tests for the `frente_pricing` helper.

Coverage:
  - `compute_frente_subtotal`: golden-path USD example from the spec.
  - `apply_frente_rows`: a `frente` row gets price + total + currency +
    formula_values filled; flat rows pass through unchanged.
  - Missing catalogue / missing material row: row passes through verbatim
    so legacy data isn't lost.
  - Legacy catalogue rows with `formula_constant = None` fall back to
    the business default (1.15).
"""
import json

from app.services.frente_pricing import (
    FRENTE_FORMULA_MULTIPLIER_DEFAULT,
    FRENTE_LINEAR_COEFFICIENT,
    apply_frente_rows,
    compute_frente_subtotal,
    resolve_frente_multiplier,
)


class _StubCatalogue:
    """Minimal stand-in for an `AdditionalWork` ORM row. Only the
    attributes touched by `apply_frente_rows` need to exist.
    """

    def __init__(self, *, id: int, formula_constant=None, type_value="frente"):
        self.id = id
        self.formula_constant = formula_constant
        self.type = type_value


class _StubMaterial:
    def __init__(self, *, id: int, base_price=0.0, price_usd=0.0, currency_code="ARS"):
        self.id = id
        self.base_price = base_price
        self.price_usd = price_usd

        class _CurrencyObj:
            def __init__(self, code):
                self.code = code

        self.currency_obj = _CurrencyObj(currency_code)


def test_compute_frente_subtotal_matches_spec_example():
    """USD 330/m² × 0.13 × 1.15 = 49.34/ml (rounded); × 2.93 m ≈ 144.57."""
    out = compute_frente_subtotal(
        material_price_m2=330,
        formula_multiplier=1.15,
        linear_meters=2.93,
    )
    # 330 * 0.13 * 1.15 = 49.335. Float storage of 49.335 lands either at
    # 49.334999… or 49.335000…; round to 2dp lands at 49.33 or 49.34.
    # Use a tolerance so the test isn't fragile to IEEE-754 quirks.
    assert abs(out["price_per_meter"] - 49.34) <= 0.02, out
    # 49.34 × 2.93 = 144.5662 → 144.57 (or 49.33 × 2.93 = 144.5369 → 144.54).
    assert abs(out["total"] - 144.55) <= 0.05, out


def test_compute_frente_subtotal_rounds_to_2dp():
    out = compute_frente_subtotal(123.4567, 1.15, 2.93)
    assert isinstance(out["price_per_meter"], float)
    assert isinstance(out["total"], float)
    assert round(out["price_per_meter"], 2) == out["price_per_meter"]
    assert round(out["total"], 2) == out["total"]


def test_resolve_frente_multiplier_default():
    cat = _StubCatalogue(id=1, formula_constant=None)
    assert resolve_frente_multiplier(cat) == FRENTE_FORMULA_MULTIPLIER_DEFAULT
    assert resolve_frente_multiplier(cat) == 1.15


def test_resolve_frente_multiplier_uses_explicit():
    cat = _StubCatalogue(id=1, formula_constant=2.5)
    assert resolve_frente_multiplier(cat) == 2.5


def test_resolve_frente_multiplier_tolerates_garbage():
    cat = _StubCatalogue(id=1, formula_constant="not-a-number")
    assert resolve_frente_multiplier(cat) == FRENTE_FORMULA_MULTIPLIER_DEFAULT


def test_apply_frente_rows_freezes_usd():
    rows = [
        {
            "additional_work_id": 7,
            "name": "Frente / Regrueso",
            "type": "frente",
            "linear_meters": 2.93,
            "assigned_material_id": 42,
            "currency": "USD",
            "quantity": 1,
            "price": 0,
            "total": 0,
        }
    ]
    catalogue_by_id = {7: _StubCatalogue(id=7, formula_constant=1.15)}
    materials_by_id = {42: _StubMaterial(id=42, base_price=0.0, price_usd=330.0, currency_code="USD")}

    out = apply_frente_rows(rows, catalogue_by_id=catalogue_by_id, materials_by_id=materials_by_id)

    # 330 * 0.13 * 1.15 ≈ 49.34; × 2.93 ≈ 144.55
    assert abs(out[0]["price"] - 49.34) <= 0.02
    assert abs(out[0]["total"] - 144.55) <= 0.10
    assert out[0]["currency"] == "USD"
    assert out[0]["formula_values"]["material_price_m2_at_selection"] == 330.0
    assert out[0]["formula_values"]["multiplier"] == 1.15
    assert out[0]["formula_values"]["computed_at"]


def test_apply_frente_rows_freezes_ars_same_currency_arithmetic():
    """Q1 (b): the multiplier stays in the material's currency (ARS)."""
    rows = [
        {
            "additional_work_id": 7,
            "type": "frente",
            "linear_meters": 1.5,
            "assigned_material_id": 11,
            "currency": "ARS",
            "price": 0,
            "total": 0,
        }
    ]
    catalogue_by_id = {7: _StubCatalogue(id=7, formula_constant=1.15)}
    materials_by_id = {11: _StubMaterial(id=11, base_price=200.0, price_usd=0.0, currency_code="ARS")}

    out = apply_frente_rows(rows, catalogue_by_id=catalogue_by_id, materials_by_id=materials_by_id)
    # price_per_meter = 200 * 0.13 * 1.15 = 29.90
    # total = 29.90 * 1.5 = 44.85
    assert abs(out[0]["price"] - 29.90) <= 0.01
    assert abs(out[0]["total"] - 44.85) <= 0.05
    assert out[0]["currency"] == "ARS"


def test_apply_frente_rows_passes_through_flat():
    rows = [
        {
            "additional_work_id": 8,
            "type": "flat",
            "currency": "ARS",
            "price": 15000,
            "quantity": 2,
            "total": 30000,
        }
    ]
    out = apply_frente_rows(rows, catalogue_by_id={}, materials_by_id={})
    assert out[0] is rows[0]


def test_apply_frente_rows_legacy_snapshots_default_to_flat():
    rows = [
        {
            "additional_work_id": 9,
            # No `type` field at all — legacy JSON created before the column existed.
            "currency": "ARS",
            "price": 15000,
            "quantity": 2,
            "total": 30000,
        }
    ]
    out = apply_frente_rows(rows, catalogue_by_id={}, materials_by_id={})
    assert out[0] is rows[0]


def test_apply_frente_rows_missing_catalogue_passes_through():
    rows = [
        {
            "additional_work_id": 404,
            "type": "frente",
            "linear_meters": 2.93,
            "assigned_material_id": 1,
            "currency": "USD",
            "price": 0,
            "total": 0,
        }
    ]
    out = apply_frente_rows(rows, catalogue_by_id={}, materials_by_id={1: _StubMaterial(id=1, price_usd=200, currency_code="USD")})
    assert out[0] is rows[0]


def test_apply_frente_rows_missing_material_passes_through():
    rows = [
        {
            "additional_work_id": 7,
            "type": "frente",
            "linear_meters": 2.93,
            "assigned_material_id": 999,
            "currency": "USD",
            "price": 0,
            "total": 0,
        }
    ]
    catalogue_by_id = {7: _StubCatalogue(id=7)}
    out = apply_frente_rows(rows, catalogue_by_id=catalogue_by_id, materials_by_id={})
    assert out[0] is rows[0]


def test_apply_frente_rows_zero_linear_meters_passes_through():
    rows = [
        {
            "additional_work_id": 7,
            "type": "frente",
            "linear_meters": 0,
            "assigned_material_id": 42,
            "currency": "USD",
            "price": 0,
            "total": 0,
        }
    ]
    catalogue_by_id = {7: _StubCatalogue(id=7)}
    materials_by_id = {42: _StubMaterial(id=42, price_usd=330, currency_code="USD")}
    out = apply_frente_rows(rows, catalogue_by_id=catalogue_by_id, materials_by_id=materials_by_id)
    assert out[0] is rows[0]


def test_apply_frente_rows_serialises_clean_json():
    rows = [
        {
            "additional_work_id": 7,
            "type": "frente",
            "linear_meters": 2.93,
            "assigned_material_id": 42,
            "currency": "USD",
            "price": 0,
            "total": 0,
        }
    ]
    catalogue_by_id = {7: _StubCatalogue(id=7, formula_constant=1.15)}
    materials_by_id = {42: _StubMaterial(id=42, price_usd=330, currency_code="USD")}

    out = apply_frente_rows(rows, catalogue_by_id=catalogue_by_id, materials_by_id=materials_by_id)
    # round-trip should succeed and contain the new fields
    s = json.dumps(out, ensure_ascii=False)
    parsed = json.loads(s)
    assert parsed[0]["formula_values"]["material_price_m2_at_selection"] == 330.0


def test_default_multiplier_value_is_one_point_fifteen():
    assert FRENTE_FORMULA_MULTIPLIER_DEFAULT == 1.15
    assert FRENTE_LINEAR_COEFFICIENT == 0.13


