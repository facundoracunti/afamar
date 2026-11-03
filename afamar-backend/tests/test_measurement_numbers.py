import pytest

from app.services.work_order.conversion import (
    _snapshot_additional_works,
    _snapshot_fabrication_details,
    _snapshot_materials,
)
from app.services.work_order.snapshots import bake_snapshot_into_pieces
from app.utils.measurement_numbers import measurement_number


@pytest.mark.parametrize(
    ("raw", "expected"),
    [("0.50", 0.5), ("0,50", 0.5), ("0.15", 0.15), ("0,15", 0.15),
     ("1.25", 1.25), ("1,25", 1.25), ("2.50", 2.5), ("2,50", 2.5)],
)
def test_measurement_number_accepts_dot_and_comma(raw, expected):
    assert measurement_number(raw) == pytest.approx(expected)


def test_measurement_number_rejects_ambiguous_grouping():
    with pytest.raises(ValueError):
        measurement_number("1.234,56")


def test_conversion_snapshots_preserve_existing_history_and_fill_missing_values():
    mats, _ = _snapshot_materials([
        {"length": "0,60", "width": "0,50", "quantity": 1, "m2_budgeted": 0.30},
        {"length": "0,60", "width": "0,50", "quantity": 1},
    ], 1000)
    assert mats[0]["m2_budgeted"] == pytest.approx(0.30)
    assert mats[1]["m2_budgeted"] == pytest.approx(0.30)

    fab = _snapshot_fabrication_details([
        {"concept": "BASEBOARD", "length": "0,60", "width": "0,15", "quantity": 1,
         "price": 10, "currency": "USD", "m2_budgeted": 0.09},
    ], 1000)
    assert '"m2_budgeted": 0.09' in fab

    adds = _snapshot_additional_works([
        {"type": "frente", "linear_meters": "1,50", "price": 10, "quantity": 1,
         "linear_meters_budgeted": 1.25},
    ], 1000)
    assert adds[0]["linear_meters_budgeted"] == pytest.approx(1.25)


def test_piece_bake_preserves_existing_snapshot_and_fills_zero_snapshot():
    raw = '[{"mainMaterial":{"length":"0,60","width":"0,50","quantity":1,"m2_budgeted":0.30}}]'
    baked = bake_snapshot_into_pieces(raw, 1000)
    assert '"m2_budgeted": 0.3' in baked

    raw_missing = '[{"mainMaterial":{"length":"0,60","width":"0,50","quantity":1,"m2_budgeted":0}}]'
    baked_missing = bake_snapshot_into_pieces(raw_missing, 1000)
    assert '"m2_budgeted": 0.3' in baked_missing
