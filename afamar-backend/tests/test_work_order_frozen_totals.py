import json
from types import SimpleNamespace

from app.services.pdf_html.measurement import _build_measurement_comparison
from app.services.pdf_html.work_order_builder import build_work_order_pdf_data
from app.services.work_order.frozen_totals import (
    ambiguous_measurement_changes,
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


def test_catalogue_derived_fabrication_and_front_amounts_are_measurement_only():
    order = _order(
        fabrication_details=(
            '[{"concept":"BASEBOARD","length":2,"width":0.1,"price":20,'
            '"material_price_m2":100,"price_source":"catalog"}]'
        ),
        additional_works_data=(
            '[{"type":"frente","linear_meters":3,"price":100,"total":300,'
            '"price_source":"catalog","formula_values":{"multiplier":1.15,'
            '"computed_at":"old"}}]'
        ),
    )
    data = {
        "fabrication_details": (
            '[{"concept":"BASEBOARD","length":3,"width":0.1,"price":30,'
            '"material_price_m2":100,"price_source":"catalog"}]'
        ),
        "additional_works_data": (
            '[{"type":"frente","linear_meters":4,"price":100,"total":400,'
            '"price_source":"catalog","formula_values":{"multiplier":1.15,'
            '"computed_at":"new"}}]'
        ),
    }

    assert ambiguous_measurement_changes(order, data) == []
    assert has_commercial_line_change(order, data) is False


def test_catalogue_fabrication_price_change_is_not_hidden():
    order = _order(
        fabrication_details=(
            '[{"concept":"BASEBOARD","length":2,"width":0.1,"price":20,'
            '"material_price_m2":100,"price_source":"catalog"}]'
        ),
    )
    data = {
        "fabrication_details": (
            '[{"concept":"BASEBOARD","length":3,"width":0.1,"price":30,'
            '"material_price_m2":120,"price_source":"catalog"}]'
        ),
    }

    assert ambiguous_measurement_changes(order, data) == []
    assert has_commercial_line_change(order, data) is True


def test_front_formula_change_is_a_commercial_change():
    order = _order(
        additional_works_data=(
            '[{"type":"frente","linear_meters":3,"price":100,"total":300,'
            '"price_source":"catalog","formula_values":{"multiplier":1.15}}]'
        ),
    )
    data = {
        "additional_works_data": (
            '[{"type":"frente","linear_meters":4,"price":100,"total":400,'
            '"price_source":"catalog","formula_values":{"multiplier":1.2}}]'
        ),
    }

    assert ambiguous_measurement_changes(order, data) == []
    assert has_commercial_line_change(order, data) is True


def test_manual_fabrication_price_change_is_commercial():
    order = _order(
        fabrication_details=(
            '[{"concept":"BASEBOARD","length":2,"width":0.1,"price":20,'
            '"price_source":"manual"}]'
        ),
    )
    data = {
        "fabrication_details": (
            '[{"concept":"BASEBOARD","length":3,"width":0.1,"price":30,'
            '"price_source":"manual"}]'
        ),
    }

    assert ambiguous_measurement_changes(order, data) == []
    assert has_commercial_line_change(order, data) is True


def test_missing_price_source_rejects_ambiguous_derived_change():
    order = _order(
        fabrication_details=(
            '[{"concept":"BASEBOARD","length":2,"width":0.1,"price":20}]'
        ),
    )
    data = {
        "fabrication_details": (
            '[{"concept":"BASEBOARD","length":3,"width":0.1,"price":30}]'
        ),
    }

    assert ambiguous_measurement_changes(order, data) == [
        "Fabricación sin price_source explícito"
    ]


def test_missing_price_source_in_pieces_is_also_ambiguous():
    piece_before = {
        "fabrication_details": [
            {"concept": "BASEBOARD", "length": 2, "width": 0.1, "price": 20}
        ]
    }
    piece_after = {
        "fabrication_details": [
            {"concept": "BASEBOARD", "length": 3, "width": 0.1, "price": 30}
        ]
    }
    order = _order(pieces_data=json.dumps([piece_before]))
    data = {"pieces_data": json.dumps([piece_after])}

    assert ambiguous_measurement_changes(order, data) == [
        "Fabricación en piezas sin price_source explícito"
    ]


def test_catalogue_derived_changes_in_pieces_are_measurement_only():
    piece_before = {
        "fabrication_details": [
            {
                "concept": "BASEBOARD",
                "length": 2,
                "width": 0.1,
                "price": 20,
                "material_price_m2": 100,
                "price_source": "catalog",
            }
        ],
        "additional_works_data": json.dumps([{
            "type": "frente",
            "linear_meters": 2,
            "price": 100,
            "total": 200,
            "price_source": "catalog",
            "formula_values": {"multiplier": 1.15, "computed_at": "old"},
        }]),
    }
    piece_after = {
        "fabrication_details": [
            {
                "concept": "BASEBOARD",
                "length": 2,
                "width": 0.15,
                "price": 30,
                "material_price_m2": 100,
                "price_source": "catalog",
            }
        ],
        "additional_works_data": json.dumps([{
            "type": "frente",
            "linear_meters": 1.5,
            "price": 100,
            "total": 150,
            "price_source": "catalog",
            "formula_values": {"multiplier": 1.15, "computed_at": "new"},
        }]),
    }
    order = _order(pieces_data=json.dumps([piece_before]))
    data = {"pieces_data": json.dumps([piece_after])}

    assert ambiguous_measurement_changes(order, data) == []
    assert has_commercial_line_change(order, data) is False


def test_update_measurement_only_keeps_the_frozen_commercial_total(monkeypatch):
    from app.services.work_order import updating

    order = _order(
        id=1,
        client_id=1,
        status="MEASUREMENT",
        stock_deducted=False,
        pool_id=None,
        number="A-TEST-001",
        sena_registered=False,
        balance_paid=False,
        total=9089820,
        subtotal=9089820,
        total_usd=5826.81,
        subtotal_usd=5826.81,
        materials_data=(
            '[{"name":"Marmol","length":1,"width":1,"quantity":1,'
            '"price_m2":100}]'
        ),
        fabrication_details=(
            '[{"concept":"BASEBOARD","length":2,"width":0.1,"price":36000,'
            '"material_price_m2":180000,"price_source":"catalog"}]'
        ),
        additional_works_data=(
            '[{"type":"frente","linear_meters":2,"price":26910,"total":53820,'
            '"price_source":"catalog","formula_values":{"multiplier":1.15,'
            '"computed_at":"old"}}]'
        ),
    )
    data = {
        "materials_data": (
            '[{"name":"Marmol","length":1,"width":0.6,"quantity":1,'
            '"price_m2":100}]'
        ),
        "fabrication_details": (
            '[{"concept":"BASEBOARD","length":2,"width":0.15,"price":54000,'
            '"material_price_m2":180000,"price_source":"catalog"}]'
        ),
        "additional_works_data": (
            '[{"type":"frente","linear_meters":1.5,"price":26910,"total":40365,'
            '"price_source":"catalog","formula_values":{"multiplier":1.15,'
            '"computed_at":"new"}}]'
        ),
    }

    captured = {}

    class Repo:
        class DB:
            def commit(self):
                return None

            def refresh(self, _order):
                return None

        db = DB()

        def get_by_id(self, _order_id):
            return order

        def update(self, _order, payload):
            captured.update(payload)
            return order

    monkeypatch.setattr(updating, "apply_client_update", lambda *args: None)
    monkeypatch.setattr(updating, "stash_sketch_into_budgeted_details", lambda _data: None)

    updating.update_work_order(Repo(), 1, data)

    assert captured["total"] == 9089820
    assert captured["subtotal"] == 9089820
    assert captured["total_usd"] == 5826.81


def test_usd_snapshots_use_the_frozen_order_rate_for_measurement_deltas():
    rows = _build_measurement_comparison(
        [{
            "name": "Blanco paloma",
            "currency": "USD",
            "price_m2_usd": 458,
            "length": 1,
            "width": 0.6,
            "quantity": 1,
            "m2_budgeted": 0.5,
        }],
        1550,
        fabrication_raw=json.dumps([{
            "concept": "BASEBOARD",
            "material": "Blanco paloma",
            "currency": "USD",
            "material_price_m2": 458,
            "length": 1,
            "width": 0.6,
            "quantity": 1,
            "price": 274.8,
            "m2_budgeted": 0.5,
            "total_usd_budgeted": 229,
            "total_ars_budgeted": 357240,
        }]),
        additional_raw=json.dumps([{
            "additional_work_id": 6,
            "name": "Frente Ingletetado 45°",
            "type": "frente",
            "materialName": "Blanco paloma",
            "currency": "USD",
            "price": 68.47,
            "total": 109.55,
            "linear_meters": 1.6,
            "linear_meters_budgeted": 1.5,
            "total_usd_budgeted": 102.71,
            "total_ars_budgeted": 160227.6,
        }]),
    )

    assert sum(row["subtotal_ars"] for row in rows) == 152582
    assert rows[-1]["subtotal_ars"] == 10602


def test_approved_work_order_pdf_uses_budgeted_surface_values():
    order = {
        "materials_data": json.dumps([{
            "name": "Blanco paloma",
            "currency": "USD",
            "price_m2_usd": 458,
            "length": 1,
            "width": 0.6,
            "quantity": 1,
            "m2_budgeted": 0.5,
            "is_alternative": False,
        }]),
        "fabrication_details": "[]",
        "additional_works_data": "[]",
        "pools_data": "[]",
        "pieces_data": None,
        "measurement_approvals": [{"id": 1}],
        "include_measurement_comparison_in_pdf": False,
        "usd_rate": 1550,
        "total": 0,
        "total_usd": 0,
        "deposit_received": 0,
        "deposit_usd": 0,
        "balance_due": 0,
        "payment_method": "EFECTIVO",
        "installments": 1,
    }

    pdf = build_work_order_pdf_data(order, {}, {}, {})

    assert pdf["materials"][0]["m2_str"] == "0.60"


def test_work_order_pdf_keeps_current_dimensions_and_switches_line_amounts_on_approval():
    piece = {
        "name": "Cocina",
        "mainMaterial": {
            "name": "Blanco paloma",
            "currency": "USD",
            "price_m2_usd": 458,
            "length": 1,
            "width": 0.6,
            "quantity": 1,
            "m2_budgeted": 0.5,
        },
        "fabrication_details": json.dumps([{
            "concept": "BASEBOARD",
            "material": "Blanco paloma",
            "currency": "USD",
            "length": 1,
            "width": 0.6,
            "quantity": 1,
            "price": 274.8,
            "m2_budgeted": 0.5,
            "total_usd_budgeted": 229,
        }]),
        "additional_works_data": json.dumps([{
            "name": "Frente Ingletetado 45°",
            "type": "frente",
            "materialName": "Blanco paloma",
            "currency": "USD",
            "price": 68.47,
            "total": 109.55,
            "quantity": 1,
            "linear_meters": 1.6,
            "linear_meters_budgeted": 1.5,
            "total_usd_budgeted": 102.71,
        }]),
        "pools": [],
    }
    base = {
        "materials_data": json.dumps([piece["mainMaterial"]]),
        "fabrication_details": piece["fabrication_details"],
        "additional_works_data": piece["additional_works_data"],
        "pools_data": "[]",
        "pieces_data": json.dumps([piece]),
        "include_measurement_comparison_in_pdf": False,
        "usd_rate": 1550,
        "total": 0,
        "total_usd": 0,
        "subtotal": 0,
        "subtotal_usd": 0,
        "deposit_received": 0,
        "deposit_usd": 0,
        "balance_due": 0,
        "payment_method": "EFECTIVO",
        "installments": 1,
    }

    before = build_work_order_pdf_data(base, {}, {}, {})["work_order_pieces"][0]
    approved = dict(base, measurement_approvals=[{"id": 1}])
    after = build_work_order_pdf_data(approved, {}, {}, {})["work_order_pieces"][0]

    assert before["materials"][0]["length_str"] == "1 m"
    assert before["materials"][0]["width_str"] == "0.6 m"
    assert before["materials"][0]["m2_str"] == "0.60"
    assert before["materials"][0]["subtotal_str"] == "229.00"
    assert before["fabrication"][0]["length_str"] == "1 m"
    assert before["fabrication"][0]["width_str"] == "0.6 m"
    assert before["fabrication"][0]["price_str"] == "229.00"
    assert before["additional"][0]["quantity"] == 1.5
    assert before["additional"][0]["total_str"] == "102.71"

    assert after["materials"][0]["m2_str"] == "0.60"
    assert after["materials"][0]["subtotal_str"] == "274.80"
    assert after["fabrication"][0]["m2_label"] == "0.60"
    assert after["fabrication"][0]["price_str"] == "274.80"
    assert after["additional"][0]["quantity"] == 1.6
    assert after["additional"][0]["total_str"] == "109.55"
