"""Tests for `scripts/backfill_measurement_snapshots.py`.

The script's core function `backfill_work_order_snapshots(db, wo)` is imported
via importlib (scripts/ isn't a Python package). The tests seed an in-memory
SQLite budget + work_order, run the backfill, and assert that missing
dimensional/money snapshots are hydrated from the source budget WITHOUT
clobbering existing snapshots.
"""
import importlib.util
import json
from pathlib import Path

import pytest

from app.models.budget import Budget
from app.models.work_order import WorkOrder
from app.models.client import Client
from app.models.reference import PaymentMethod
from tests.conftest import TestingSessionLocal


SCRIPT_PATH = (
    Path(__file__).resolve().parent.parent
    / "scripts"
    / "backfill_measurement_snapshots.py"
)


def _load_script_module():
    spec = importlib.util.spec_from_file_location("backfill_measurement_snapshots", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def backfill_mod():
    return _load_script_module()


@pytest.fixture
def seeded(setup_db):
    """A budget + work_order mirroring A-000003 (the real-world case that
    motivated the script): the WO's fabrication zócalo has a money snapshot
    but no `m2_budgeted`; the frente has NO snapshot at all (it was re-frozen
    after conversion).
    """
    db = TestingSessionLocal()
    try:
        # The seed_db conftest creates reference data (clients, payment methods,
        # etc.) but we only need what's referenced here.
        client = db.query(Client).first()
        if client is None:
            client = Client(
                name="Cliente Test", phone="123", email="t@t.com",
                address="Calle 1",
            )
            db.add(client)
            db.flush()
        pm = db.query(PaymentMethod).first()
        if pm is None:
            pm = PaymentMethod(
                name="EFECTIVO", label="Efectivo",
                is_active=True, sort_order=10,
                type="NONE", value=0.0, is_percentage=False,
                applies_to_installments=False,
            )
            db.add(pm)
            db.flush()

        budget = Budget(
            client_id=client.id,
            number="P-000099",
            status="APPROVED",
            currency="USD",
            usd_rate=1535.0,
            payment_method_id=pm.id,
            fabrication_details=json.dumps([
                {
                    "concept": "BASEBOARD",
                    "material": "FORTALEZA",
                    "length": 2.1,
                    "width": 0.05,
                    "quantity": 1,
                    "currency": "USD",
                    "price": 25.2,
                }
            ], ensure_ascii=False),
            additional_works_data=json.dumps([
                {
                    "additional_work_id": 6,
                    "name": "Frente Ingletetado 45°",
                    "type": "frente",
                    "price": 52.32,
                    "quantity": 1,
                    "total": 130.81,
                    "currency": "USD",
                    "materialName": "STATUARIO MATE",
                    "linear_meters": 2.5,
                },
                {
                    "additional_work_id": 1,
                    "name": "Traforo de Pileta",
                    "type": "flat",
                    "price": 60000,
                    "quantity": 1,
                    "total": 60000,
                    "currency": "ARS",
                    "materialName": "__GLOBAL__",
                },
            ], ensure_ascii=False),
        )
        db.add(budget)
        db.flush()

        work_order = WorkOrder(
            number="A-000099",
            client_id=client.id,
            budget_id=budget.id,
            payment_method_id=pm.id,
            currency="USD",
            usd_rate=1535.0,
            status="MEASUREMENT",
            fabrication_details=json.dumps([
                {
                    "concept": "BASEBOARD",
                    "material": "FORTALEZA",
                    "material_price_m2": 240,
                    "length": 2,
                    "width": 0.05,
                    "m2": 0.1,
                    "quantity": 1,
                    "currency": "USD",
                    "price": 24,
                    "total_ars_budgeted": 38682,
                    "total_usd_budgeted": 25.2,
                }
            ], ensure_ascii=False),
            additional_works_data=json.dumps([
                {
                    "additional_work_id": 1,
                    "name": "Traforo de Pileta",
                    "type": "flat",
                    "price": 60000,
                    "quantity": 1,
                    "total": 60000,
                    "currency": "ARS",
                    "materialName": "__GLOBAL__",
                },
                {
                    "additional_work_id": 6,
                    "name": "Frente Ingletetado 45°",
                    "type": "frente",
                    "price": 52.33,
                    "quantity": 1,
                    "total": 156.98,
                    "currency": "USD",
                    "materialName": "STATUARIO MATE",
                    "linear_meters": 3,
                    "assigned_material_id": 99,
                    "formula_values": {"material_price_m2_at_selection": 350, "multiplier": 1.15},
                },
            ], ensure_ascii=False),
        )
        db.add(work_order)
        db.commit()
        yield {"db": db, "wo": work_order, "budget": budget}
    finally:
        db.close()


def test_zocalo_only_gains_missing_m2_budgeted(backfill_mod, seeded):
    wo = seeded["wo"]
    db = seeded["db"]
    summary = backfill_mod.backfill_work_order_snapshots(db, wo)
    db.commit()

    fab = json.loads(wo.fabrication_details)
    zocalo = next(r for r in fab if r["material"] == "FORTALEZA")
    # Money snapshot was already present (legacy): preserved verbatim.
    assert zocalo["total_ars_budgeted"] == 38682
    assert zocalo["total_usd_budgeted"] == 25.2
    # The dimensional snapshot was missing: now added from the budget row.
    assert abs(zocalo["m2_budgeted"] - 0.105) < 1e-9
    assert summary["fabric_added"][0]["keys"] == ["m2_budgeted"]


def test_frente_full_backfill_with_money_and_ml(backfill_mod, seeded):
    wo = seeded["wo"]
    db = seeded["db"]
    summary = backfill_mod.backfill_work_order_snapshots(db, wo)
    db.commit()

    aws = json.loads(wo.additional_works_data)
    frente = next(a for a in aws if a.get("name") == "Frente Ingletetado 45°")
    assert frente["linear_meters_budgeted"] == 2.5
    assert frente["total_usd_budgeted"] == 130.81
    assert frente["total_ars_budgeted"] == 200793.35  # 130.81 × 1535
    # Operator's re-frozen fields are preserved verbatim (linear_meters 3, total 156.98).
    assert frente["linear_meters"] == 3
    assert frente["total"] == 156.98
    assert frente["assigned_material_id"] == 99
    added_keys = summary["additional_added"][0]["keys"]
    assert set(added_keys) == {
        "linear_meters_budgeted",
        "total_ars_budgeted",
        "total_usd_budgeted",
    }


def test_global_flat_works_are_kept_untouched(backfill_mod, seeded):
    wo = seeded["wo"]
    db = seeded["db"]
    backfill_mod.backfill_work_order_snapshots(db, wo)
    db.commit()

    aws = json.loads(wo.additional_works_data)
    global_row = next(a for a in aws if a["materialName"] == "__GLOBAL__")
    # Globals stay as-is (excluded from the COMPARATIVA DE MEDICIÓN anyway).
    assert "linear_meters_budgeted" not in global_row
    assert "total_ars_budgeted" not in global_row


def test_run_is_idempotent(backfill_mod, seeded):
    wo = seeded["wo"]
    db = seeded["db"]
    first = backfill_mod.backfill_work_order_snapshots(db, wo)
    db.commit()
    assert first["changed"] is True
    second = backfill_mod.backfill_work_order_snapshots(db, wo)
    assert second["changed"] is False
    assert second["fabric_added"] == []
    assert second["additional_added"] == []


def test_duplicate_concept_material_matched_positionally(backfill_mod, setup_db):
    """Two identical zócalos of the same material should each be matched
    against the first two budget zócalos of the same material — position-based
    matching after concept+material.
    """
    db = TestingSessionLocal()
    try:
        client = Client(name="x", phone="1", email=None, address=None)
        db.add(client)
        db.flush()
        budget = Budget(
            client_id=client.id,
            number="P-DUP",
            status="APPROVED",
            currency="USD",
            usd_rate=1000.0,
            fabrication_details=json.dumps([
                {"concept": "BASEBOARD", "material": "MARMOL", "length": 1.0, "width": 0.1, "quantity": 1, "currency": "USD", "price": 100},
                {"concept": "BASEBOARD", "material": "MARMOL", "length": 2.0, "width": 0.1, "quantity": 1, "currency": "USD", "price": 200},
            ]),
        )
        db.add(budget)
        db.flush()
        wo = WorkOrder(
            number="A-DUP",
            client_id=client.id,
            budget_id=budget.id,
            currency="USD",
            usd_rate=1000.0,
            status="MEASUREMENT",
            fabrication_details=json.dumps([
                {"concept": "BASEBOARD", "material": "MARMOL", "length": 1.5, "width": 0.1, "quantity": 1, "currency": "USD", "price": 150},
                {"concept": "BASEBOARD", "material": "MARMOL", "length": 2.5, "width": 0.1, "quantity": 1, "currency": "USD", "price": 250},
            ]),
        )
        db.add(wo)
        db.commit()

        backfill_mod.backfill_work_order_snapshots(db, wo)
        db.commit()

        fab = json.loads(wo.fabrication_details)
        assert fab[0]["m2_budgeted"] == 0.1   # matched budget row 0
        assert fab[1]["m2_budgeted"] == 0.2   # matched budget row 1
        assert fab[0]["total_usd_budgeted"] == 100
        assert fab[1]["total_usd_budgeted"] == 200
    finally:
        db.close()


def test_unmatched_row_is_left_alone(backfill_mod, seeded):
    """A WO row whose concept/material doesn't exist in the budget should be
    skipped (counted as unmatched) and not mutated.
    """
    wo = seeded["wo"]
    # Inject a stray row the budget doesn't have.
    fab = json.loads(wo.fabrication_details)
    fab.append({
        "concept": "TERMINACION",
        "material": "OTRO",
        "length": 5,
        "width": 0.05,
        "quantity": 1,
        "currency": "ARS",
        "price": 500,
    })
    wo.fabrication_details = json.dumps(fab)

    db = seeded["db"]
    summary = backfill_mod.backfill_work_order_snapshots(db, wo)
    assert summary["fabric_unmatched"] == 1
    fab_after = json.loads(wo.fabrication_details)
    stray = next(r for r in fab_after if r["material"] == "OTRO")
    assert "m2_budgeted" not in stray
    assert "linear_meters_budgeted" not in stray


def test_wo_with_null_budget_id_is_skipped(backfill_mod, setup_db):
    db = TestingSessionLocal()
    try:
        client = Client(name="x", phone="1", email=None, address=None)
        db.add(client)
        db.flush()
        wo = WorkOrder(
            number="A-NB",
            client_id=client.id,
            budget_id=None,
            currency="USD",
            usd_rate=1000.0,
            status="MEASUREMENT",
            fabrication_details=json.dumps([
                {"concept": "BASEBOARD", "material": "X", "length": 1, "width": 1, "quantity": 1, "currency": "USD", "price": 10}
            ]),
        )
        db.add(wo)
        db.commit()
        summary = backfill_mod.backfill_work_order_snapshots(db, wo)
        assert summary["changed"] is False
        assert summary["fabric_added"] == []
    finally:
        db.close()