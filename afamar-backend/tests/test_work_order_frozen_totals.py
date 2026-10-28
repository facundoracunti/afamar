from types import SimpleNamespace

from app.services.work_order.frozen_totals import (
    apply_frozen_financials,
    has_commercial_line_change,
)


def _order(**overrides):
    values = {
        "materials_data": '[{"name":"Mármol","length":2,"width":1,"quantity":1,"price_m2":100}]',
        "fabrication_details": '[{"concept":"BASEBOARD","length":2,"width":0.1,"price":20}]',
        "additional_works_data": '[{"type":"frente","linear_meters":3,"price":100}]',
        "pieces_data": None,
        "pools_data": '[]',
        "usd_rate": 1200,
        "subtotal": 200,
        "subtotal_usd": 0.17,
        "total": 200,
        "total_usd": 0.17,
        "deposit_received": 0,
        "deposit_usd": 0,
        "deposit_currency": "ARS",
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_measurement_only_changes_are_not_commercial_changes():
    order = _order()
    data = {
        "materials_data": '[{"name":"Mármol","length":3,"width":1,"quantity":1,"m2_used":3,"price_m2":100}]',
        "fabrication_details": '[{"concept":"BASEBOARD","length":3,"width":0.1,"price":20}]',
        "additional_works_data": '[{"type":"frente","linear_meters":4,"price":100}]',
    }

    assert has_commercial_line_change(order, data) is False


def test_price_change_is_a_commercial_change():
    order = _order()
    data = {
        "materials_data": '[{"name":"Mármol","length":3,"width":1,"quantity":1,"price_m2":150}]',
    }

    assert has_commercial_line_change(order, data) is True


def test_frozen_financials_keep_total_and_recompute_only_balance():
    order = _order(deposit_received=50)
    data = {"deposit_received": 80, "usd_rate": 9999}

    apply_frozen_financials(order, data)

    assert data["usd_rate"] == 1200
    assert data["total"] == 200
    assert data["total_usd"] == 0.17
    assert data["balance_due"] == 120
