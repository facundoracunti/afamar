"""COMPARATIVA DE MEDICIÓN — snapshot round-trip through Budget → WO.

Regression sentinels for the 2026-09-22 fix: the budgeted-measurement
snapshots (m² / ml / ARS / USD) written by `create_from_budget` must ALSO be
baked INTO `pieces_data` (`_bake_snapshot_into_pieces`), because the frontend
is pieces-first and re-derives the flat arrays from the pieces on every edit
(`flattenPieces` in `useBudgetPieces.commit`). Without the bake, the
comparison's "Presupuestado" column died at the first Medición change.

It also covers the unified "Seña / Pagos Registrados" row: the PDF of a work
order sums the INCOME `cash_movements` of the order (the backend is the
source of truth for accumulated paid), derives `saldo = total − paid`, and
falls back to `deposit_ars_equivalent` when no movements exist.

We cover the real user flow end-to-end against an in-memory SQLite DB:

1. convert an APPROVED budget → the flat arrays AND the pieces both carry
   `m2_budgeted` / `linear_meters_budgeted` / `total_ars/usd_budgeted`;
2. edit the real measure in MEDICIÓN (re-flattened arrays preserving the
   snapshots, exactly like the fixed frontend) → snapshots survive the
   recalc and `build_work_order_pdf_data` renders Presupuestado vs Real
   vs Diferencia with correct monetary subtotals;
3. `_bake_snapshot_into_pieces` is guarded for absent/malformed payloads.
"""
import json
from datetime import date

import pytest

from app.models.budget import Budget
from app.models.client import Client
from app.models.daily_cash import CashMovement, DailyCash
from app.services.pdf_helpers import prepare_work_order_payload
from app.services.pdf_html import build_work_order_pdf_data
from app.services.work_order import WorkOrderService, _bake_snapshot_into_pieces

from tests.conftest import TestingSessionLocal


# ────────────────────────────────────────────────────────────────────
# Test data — budget with 2 NEGRO BRASIL mesadas, one zócalo and one frente
# ────────────────────────────────────────────────────────────────────

USD_RATE = 1000.0

ZOCALO_ROW = {
    "concept": "BASEBOARD",
    "detail": "Zócalo",
    "material": "NEGRO BRASIL",
    "length": 4,
    "width": 0.105,
    "quantity": 1,
    "price": 50,
    "currency": "USD",
}

FRENTE_ROW = {
    "additional_work_id": 88,
    "name": "Frente Ingletetado 45°",
    "type": "frente",
    "currency": "USD",
    "price": 49.33,
    "quantity": 1,
    "total": 162.79,  # 49.33 × 3.3 ml
    "materialName": "NEGRO BRASIL",
    "linear_meters": 3.3,
}

MAT_1 = {  # 2.75 × 0.64 = 1.76 m² @ USD 330 → 580.80
    "id": 1, "name": "NEGRO BRASIL", "currency": "USD",
    "price_m2": 330000.0, "price_m2_usd": 330.0,
    "quantity": 1, "length": 2.75, "width": 0.64, "is_alternative": False,
}

MAT_2 = {  # 0.68 × 0.64 = 0.4352 m² @ USD 330 → 143.616
    "id": 2, "name": "NEGRO BRASIL", "currency": "USD",
    "price_m2": 330000.0, "price_m2_usd": 330.0,
    "quantity": 1, "length": 0.68, "width": 0.64, "is_alternative": False,
}


def _build_budget(**overrides) -> Budget:
    pieces = [
        {
            "id": "p-mesada-1",
            "name": "Mesada 1",
            "mainMaterial": MAT_1,
            "mainMaterialRows": [],
            "alternativeMaterials": [],
            "fabrication_details": [ZOCALO_ROW],
            "additional_works_data": json.dumps([FRENTE_ROW], ensure_ascii=False),
            "pools": [],
        },
        {
            "id": "p-mesada-2",
            "name": "Mesada 2",
            "mainMaterial": MAT_2,
            "mainMaterialRows": [],
            "alternativeMaterials": [],
            "fabrication_details": [],
            "additional_works_data": "[]",
            "pools": [],
        },
    ]
    budget = Budget(
        number="P-TEST-001",
        client_id=1,
        status="APPROVED",
        currency="USD",
        usd_rate=USD_RATE,
        materials_data=json.dumps([MAT_1, MAT_2]),
        fabrication_details=json.dumps([ZOCALO_ROW]),
        additional_works_data=json.dumps([FRENTE_ROW]),
        pieces_data=json.dumps(pieces, ensure_ascii=False),
        material_price_m2=330000.0,
        material_price_m2_usd=330.0,
        material="NEGRO BRASIL",
        subtotal=937206.0,
        subtotal_usd=937.206,
        total=937206.0,
        total_usd=937.206,
        balance_due=937206.0,
        balance_due_usd=937.206,
        deposit_received=0.0,
        deposit_usd=0.0,
        payment_method="EFECTIVO",
        installments=1,
    )
    for key, value in overrides.items():
        setattr(budget, key, value)
    return budget


@pytest.fixture
def seeded_budget_db():
    db = TestingSessionLocal()
    try:
        db.add(Client(id=1, name="Juan Pérez", phone="+54 11 0000-0000",
                      address="Calle Test 123", email="juan@test.com"))
        db.add(_build_budget())
        db.commit()
        yield db
    finally:
        db.close()


def test_create_from_budget_bakes_snapshots_into_flat_and_pieces(seeded_budget_db):
    db = seeded_budget_db
    budget = db.query(Budget).first()
    order = WorkOrderService(db).create_from_budget(budget)

    # Flat materials: each row carries the quoted m² so the comparison's
    # "Presupuestado" survives any later edit of the real measure.
    mats = json.loads(order.materials_data)
    assert len(mats) == 2
    assert mats[0]["m2_budgeted"] == pytest.approx(1.76, abs=1e-6)
    assert mats[1]["m2_budgeted"] == pytest.approx(0.4352, abs=1e-6)

    # Flat fabrication (zócalo): monetary + M² snapshot.
    fabs = json.loads(order.fabrication_details)
    assert len(fabs) == 1
    assert fabs[0]["m2_budgeted"] == pytest.approx(0.42, abs=1e-6)
    assert fabs[0]["total_usd_budgeted"] == pytest.approx(50.0, abs=1e-6)
    assert fabs[0]["total_ars_budgeted"] == pytest.approx(50000.0, abs=1e-6)

    # Flat additional (frente): monetary + ml snapshot.
    adds = json.loads(order.additional_works_data)
    assert len(adds) == 1
    assert adds[0]["linear_meters_budgeted"] == pytest.approx(3.3, abs=1e-6)
    assert adds[0]["total_usd_budgeted"] == pytest.approx(162.79, abs=1e-6)
    assert adds[0]["total_ars_budgeted"] == pytest.approx(162790.0, abs=1e-6)

    # THE regression target: the same snapshots must ALSO be baked into the
    # pieces (the frontend re-derives the flat arrays from them on every
    # edit — without the bake the snapshot dies at the first edit).
    pieces = json.loads(order.pieces_data)
    assert len(pieces) == 2
    p0_main = pieces[0]["mainMaterial"]
    assert p0_main["m2_budgeted"] == pytest.approx(1.76, abs=1e-6)
    p0_zocalo = pieces[0]["fabrication_details"][0]
    assert p0_zocalo["m2_budgeted"] == pytest.approx(0.42, abs=1e-6)
    assert p0_zocalo["total_usd_budgeted"] == pytest.approx(50.0, abs=1e-6)
    p0_add = json.loads(pieces[0]["additional_works_data"])
    assert p0_add[0]["linear_meters_budgeted"] == pytest.approx(3.3, abs=1e-6)
    assert p0_add[0]["total_usd_budgeted"] == pytest.approx(162.79, abs=1e-6)
    assert pieces[1]["mainMaterial"]["m2_budgeted"] == pytest.approx(0.4352, abs=1e-6)


def test_full_flow_snapshot_survives_measurement_adjust_and_drives_comparison(seeded_budget_db):
    """Presupuesto → OT → Medición edit → PDF: the fixed frontend is
    pieces-first, so the Medición PATCH re-flattens the arrays FROM the
    pieces — keeping every `*_budgeted` key. The comparison must then show
    the frozen Presupuestado (1.76), the new Real (3.0 × 0.64 = 1.92), the
    Diferencia (+0.16) and the correct money subtotal (0.16 × 330 = 52.80).
    """
    db = seeded_budget_db
    budget = db.query(Budget).first()
    svc = WorkOrderService(db)
    order = svc.create_from_budget(budget)

    # Simulate the operator's Medición edit: the REAL length of mesada 1
    # changes from 2.75 m → 3.0 m. The frontend keeps `m2_budgeted` (1.76)
    # because the piece carries it, and re-flattens:
    mats = json.loads(order.materials_data)
    mats[0]["length"] = 3.0  # m2_budgeted stays 1.76
    pieces = json.loads(order.pieces_data)
    pieces[0]["mainMaterial"]["length"] = 3.0  # m2_budgeted stays 1.76

    order2 = svc.update(order.id, {
        "materials_data": json.dumps(mats),
        "pieces_data": json.dumps(pieces, ensure_ascii=False),
        "fabrication_details": order.fabrication_details,
        "additional_works_data": order.additional_works_data,
        "include_measurement_comparison_in_pdf": True,
    })

    # Persisted rows keep the snapshot after the recalc.
    persisted_mats = json.loads(order2.materials_data)
    assert persisted_mats[0]["length"] == pytest.approx(3.0, abs=1e-6)
    assert persisted_mats[0]["m2_budgeted"] == pytest.approx(1.76, abs=1e-6)
    persisted_pieces = json.loads(order2.pieces_data)
    assert persisted_pieces[0]["mainMaterial"]["length"] == pytest.approx(3.0, abs=1e-6)
    assert persisted_pieces[0]["mainMaterial"]["m2_budgeted"] == pytest.approx(1.76, abs=1e-6)

    # Render the real PDF payload and inspect the comparison rows.
    order_data, client_dict, company, terms = prepare_work_order_payload(order2, db)
    pdf = build_work_order_pdf_data(order_data, client_dict, company, terms, db=db)
    cmp = pdf["measurement_comparison"]
    assert len(cmp) == 4  # 2 × NEGRO BRASIL primary + zócalo + frente details

    primary = [r for r in cmp if not r["is_detail"]]
    assert len(primary) == 2
    mesada_1 = next(r for r in primary if r["m2_real_str"] == "1.92")
    assert mesada_1["m2_budgeted_str"] == "1.76"
    assert mesada_1["delta_str"] == "+0.16"
    assert mesada_1["subtotal_usd"] == pytest.approx(52.8, abs=0.01)
    assert mesada_1["subtotal_ars"] == pytest.approx(52800.0, abs=0.01)
    mesada_2 = next(r for r in primary if r["m2_budgeted_str"] == "0.44")
    assert mesada_2["delta_str"] == "0.00"
    assert mesada_2["subtotal_usd"] == 0

    details = [r for r in cmp if r["is_detail"]]
    assert len(details) == 2  # zócalo + frente (each deduped exactly once)
    zocalo = next(r for r in details if r["measure_unit"] == "m²")
    assert zocalo["name"] == "Zócalo NEGRO BRASIL"
    assert zocalo["measure_budgeted_str"] == "0.42 m²"
    assert zocalo["measure_real_str"] == "0.42 m²"
    assert zocalo["measure_delta_str"] == "0.00 m²"
    frente = next(r for r in details if r["measure_unit"] == "ml")
    assert frente["name"] == "Frente Ingletetado 45°"
    assert frente["measure_budgeted_str"] == "3.3 ml"
    assert frente["measure_real_str"] == "3.3 ml"

    assert pdf["measurement_comparison_total_usd"] == "+52.80"
    assert pdf["measurement_comparison_total_ars"] == "+52,800.00"


def test_bake_snapshot_into_pieces_is_guarded_for_absent_or_malformed(seeded_budget_db):
    # Absent / falsy payloads come back unchanged (None for None).
    assert _bake_snapshot_into_pieces(None, 1000.0) is None
    assert _bake_snapshot_into_pieces("", 1000.0) == ""
    # Malformed JSON / non-list payloads are returned untouched.
    assert _bake_snapshot_into_pieces("not-json", 1000.0) == "not-json"
    assert _bake_snapshot_into_pieces('{"a": 1}', 1000.0) == '{"a": 1}'
    # A list of pieces still bakes (smoke) even though the flat snapshot
    # layer handled the real payload in `create_from_budget`.
    baked = json.loads(_bake_snapshot_into_pieces(json.dumps(
        [{"id": "p", "name": "Mesada", "mainMaterial": MAT_1, "pools": []}]
    ), USD_RATE))
    assert baked[0]["mainMaterial"]["m2_budgeted"] == pytest.approx(1.76, abs=1e-6)


def test_unified_paid_row_sums_income_movements_and_derives_balance(seeded_budget_db):
    """Seña / Pagos Registrados: the WO PDF totals the INCOME cash movements
    of the order (seña + pagos del módulo) and derives saldo = total − paid,
    so Paid + Saldo = TOTAL. EXPENSE movements and rows of other orders must
    not count.
    """
    db = seeded_budget_db
    budget = db.query(Budget).first()
    order = WorkOrderService(db).create_from_budget(budget)

    # Two INCOME payments for THIS order + one EXPENSE (must NOT count) and
    # one INCOME of another order id (must NOT count either).
    box = DailyCash(
        number=1,
        date=date.today(),
        is_closed=False,
        previous_balance=0.0,
    )
    db.add(box)
    db.flush()
    db.add_all([
        CashMovement(daily_cash_id=box.id, type="INCOME", amount=500000.0,
                     order_id=order.id, payment_method="EFECTIVO", description="seña"),
        CashMovement(daily_cash_id=box.id, type="INCOME", amount=200000.0,
                     order_id=order.id, payment_method="EFECTIVO", description="pago módulo"),
        CashMovement(daily_cash_id=box.id, type="EXPENSE", amount=90000.0,
                     order_id=order.id, payment_method="EFECTIVO", description="no cuenta"),
        CashMovement(daily_cash_id=box.id, type="INCOME", amount=100000.0,
                     order_id=order.id + 999, payment_method="EFECTIVO", description="otra OT"),
    ])
    db.commit()

    order_data, client_dict, company, terms = prepare_work_order_payload(order, db)
    pdf = build_work_order_pdf_data(order_data, client_dict, company, terms, db=db)

    assert pdf["paid_label"] == "Seña / Pagos Registrados"
    assert pdf["total_paid_ars"] == pytest.approx(700000.0, abs=1e-2)
    assert pdf["total_paid_usd"] == pytest.approx(700.0, abs=1e-2)
    # Paid + Saldo = TOTAL exacto (saldo siempre derivado, nunca snapshot).
    assert pdf["balance_due"] == pytest.approx(
        max(0.0, pdf["total"] - pdf["total_paid_ars"]), abs=1e-2
    )


def test_unified_paid_row_falls_back_to_deposit_when_no_movements(seeded_budget_db):
    """Without INCOME movements the WO PDF falls back to the deposit
    equivalent (legacy OTs / builder called without a db session)."""
    db = seeded_budget_db
    budget = db.query(Budget).first()
    order = WorkOrderService(db).create_from_budget(budget)

    order_data, client_dict, company, terms = prepare_work_order_payload(order, db)
    pdf = build_work_order_pdf_data(order_data, client_dict, company, terms, db=None)

    assert pdf["paid_label"] == "Seña / Pagos Registrados"
    # La OT fixture nace sin seña y sin movimientos → fallback = equivalente de
    # la seña = 0 (la fila se renderiza igual; el saldo cubre todo el total).
    assert pdf["total_paid_ars"] == 0.0
    assert pdf["total_paid_usd"] == 0.0
    assert pdf["balance_due"] == pytest.approx(pdf["total"], abs=1e-2)