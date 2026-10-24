"""HTTP contract of `POST /budgets/{id}/convert` (Fase 3, 2026-10-01).

Uses the FastAPI TestClient so the route, the body schema and the status
codes are pinned — not just the service layer.
"""
import json

import pytest
from fastapi.testclient import TestClient

from app.models.budget import Budget
from app.models.client import Client
from app.models.pool_stock import PoolStock, StockMovement
from app.models.reference import Currency
from app.models.work_order import WorkOrder


def _seed(db) -> None:
    for model in (WorkOrder, Budget, StockMovement, PoolStock):
        db.query(model).delete()
    db.commit()
    if not db.query(Currency).first():
        db.add(Currency(id=1, code="ARS", symbol="$", name="Peso Argentino"))
    if not db.query(Client).first():
        db.add(Client(
            id=1, name="API Test", phone="+54 11 0000-0000",
            address="Calle 1", email="api@test.com",
        ))
    db.add(PoolStock(id=1, brand="JOHNSON", model="Q 76 A", material="Acero",
                     quantity=5, price=850_000.0, currency_id=1))
    db.add(PoolStock(id=2, brand="MI PILETA", model="DESIGNA 787",
                     material="Acero", quantity=5, price=1_100_000.0,
                     currency_id=1))
    db.commit()


def _piece(pid, name, material, price, pool_id=None):
    p = {
        "id": pid, "name": name,
        "mainMaterial": {
            "id": 1, "name": material, "price_m2": price, "price_m2_usd": 0,
            "currency": "ARS", "quantity": 1, "length": 2, "width": 1,
            "is_alternative": False,
        },
        "alternativeMaterials": [], "fabrication_details": [],
        "additional_works_data": "[]", "pools": [],
    }
    if pool_id:
        p["pools"] = [{
            "pool_id": pool_id, "brand": "X", "model": "Y",
            "price": 850_000.0, "currency": "ARS", "quantity": 1,
        }]
    return p


def _budget(options):
    b = Budget(
        number="P-API-001", client_id=1, status="APPROVED",
        currency="ARS", usd_rate=1000.0,
        subtotal=2_000_000.0, subtotal_usd=2_000.0,
        total=2_000_000.0, total_usd=2_000.0,
        balance_due=2_000_000.0, balance_due_usd=2_000.0,
        deposit_received=0, deposit_usd=0, deposit_currency="ARS",
        payment_method="EFECTIVO", installments=1,
        discount_percentage=0, discount_enabled=False, discount_target="total",
        stock_deducted=False,
        options_data=json.dumps(options),
    )
    return b


OPTIONS = [
    {"id": "opt-1", "name": "Opción 1", "is_selected": True,
     "pieces": [_piece("p1", "COCINA", "CALACATTA", 100_000, pool_id=1)]},
    {"id": "opt-2", "name": "Opción 2", "is_selected": False,
     "pieces": [_piece("p2", "COCINA", "NEGRO BRASIL", 300_000, pool_id=2)]},
]


def test_post_convert_requires_a_winner_on_multi_option(client):
    from tests.conftest import TestingSessionLocal
    db = TestingSessionLocal()
    try:
        _seed(db)
        # NEITHER option marked selected → no unambiguous winner.
        db.add(_budget([
            {**OPTIONS[0], "is_selected": False},
            {**OPTIONS[1], "is_selected": False},
        ]))
        db.commit()
    finally:
        db.close()

    # No body (and no winner) → the request is rejected (never guesses).
    # NOTE: the app's global `ValidationError` handler answers 422 with the
    # message under `error`, so the assertion pins "rejected" + the message
    # rather than a specific code (the route's own 400 path is covered by
    # `test_post_convert_twice_returns_400`, which DOES reach the route).
    r = client.post("/api/v1/budgets/1/convert")
    assert r.status_code in (400, 422)
    assert r.json()["success"] is False
    assert "opci" in r.json()["error"].lower()


def test_post_convert_with_option_id_succeeds(client):
    from tests.conftest import TestingSessionLocal
    db = TestingSessionLocal()
    try:
        _seed(db)
        db.add(_budget(OPTIONS))
        db.commit()
        winner_before = db.query(PoolStock).filter(PoolStock.id == 1).one().quantity
        loser_before = db.query(PoolStock).filter(PoolStock.id == 2).one().quantity
    finally:
        db.close()

    r = client.post("/api/v1/budgets/1/convert", json={"option_id": "opt-1"})
    assert r.status_code == 201, r.text
    body = r.json()["data"]
    assert body["option_id"] == "opt-1"
    assert body["option_name"] == "Opción 1"
    assert body["work_order"]["material"] == "CALACATTA"

    db = TestingSessionLocal()
    try:
        # The winning option's sink was debited; the loser's was not.
        assert db.query(PoolStock).filter(PoolStock.id == 1).one().quantity == winner_before - 1
        assert db.query(PoolStock).filter(PoolStock.id == 2).one().quantity == loser_before
        moves = db.query(StockMovement).filter(StockMovement.type == "exit").all()
        assert [m.pool_id for m in moves] == [1]
    finally:
        db.close()


def test_post_convert_unknown_option_returns_400(client):
    from tests.conftest import TestingSessionLocal
    db = TestingSessionLocal()
    try:
        _seed(db)
        db.add(_budget(OPTIONS))
        db.commit()
    finally:
        db.close()

    r = client.post("/api/v1/budgets/1/convert", json={"option_id": "opt-99"})
    assert r.status_code == 400


def test_post_convert_missing_budget_returns_404(client):
    r = client.post("/api/v1/budgets/9999/convert", json={"option_id": "opt-1"})
    assert r.status_code == 404


def test_post_convert_legacy_budget_needs_no_option_id(client):
    from tests.conftest import TestingSessionLocal
    db = TestingSessionLocal()
    try:
        _seed(db)
        legacy = Budget(
            number="P-API-LEGACY", client_id=1, status="APPROVED",
            currency="ARS", usd_rate=1000.0,
            subtotal=200_000.0, subtotal_usd=200.0,
            total=200_000.0, total_usd=200.0,
            balance_due=200_000.0, balance_due_usd=200.0,
            deposit_received=0, deposit_usd=0, deposit_currency="ARS",
            payment_method="EFECTIVO", installments=1,
            discount_percentage=0, discount_enabled=False,
            discount_target="total", stock_deducted=False,
            options_data=None,
            pieces_data=json.dumps([_piece("p1", "COCINA", "CALACATTA", 100_000)]),
        )
        db.add(legacy)
        db.commit()
    finally:
        db.close()

    # Legacy budget → no option_id needed, historical origin preserved.
    r = client.post("/api/v1/budgets/1/convert", json={})
    assert r.status_code == 201, r.text
    body = r.json()["data"]
    assert body["option_id"] == "SINGLE"
    assert body["work_order"]["origin"] == "Budget"


def test_post_convert_twice_returns_400(client):
    from tests.conftest import TestingSessionLocal
    db = TestingSessionLocal()
    try:
        _seed(db)
        db.add(_budget(OPTIONS))
        db.commit()
    finally:
        db.close()

    assert client.post(
        "/api/v1/budgets/1/convert", json={"option_id": "opt-1"}
    ).status_code == 201
    # A second conversion is refused (the budget is already CONVERTED_TO_OT).
    assert client.post(
        "/api/v1/budgets/1/convert", json={"option_id": "opt-2"}
    ).status_code == 400