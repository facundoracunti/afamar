"""Isolated regression tests for the MITER_45 front height contract."""

import json
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.dependencies import get_current_user, get_db
from app.api.routers import budgets, work_orders
from app.db.base import Base
from app.models.additional_work import AdditionalWork
from app.models.budget import Budget
from app.models.client import Client
from app.models.reference import Currency
from app.models.user import User
from app.models.work_order import WorkOrder
from app.services.budget_helpers import _process_additional_works_snapshot
from app.services.pdf_html.rows import _build_piece_additional_pdf
from app.services.work_order.conversion import (
    _snapshot_additional_works,
    build_conversion_payload,
)


@pytest.fixture
def isolated_api():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Session = sessionmaker(bind=engine)
    Base.metadata.create_all(engine)
    db = Session()
    db.add_all([
        Currency(id=1, code="ARS", name="Pesos", symbol="$"),
        Currency(id=2, code="USD", name="Dólares", symbol="USD"),
        Client(id=1, name="Cliente de prueba"),
        AdditionalWork(
            id=1, name="Frente Ingletetado 45°", type="frente",
            price=0, currency_id=2, formula_constant=1.15, front_kind="MITER_45",
        ),
        AdditionalWork(
            id=2, name="Frente Ingletado 45° auxiliar", type="frente",
            price=0, currency_id=2, formula_constant=1.15, front_kind="MITER_45",
        ),
        Budget(id=1, number="P-TEST01", client_id=1, additional_works_data="[]"),
        WorkOrder(id=1, number="A-TEST01", client_id=1, additional_works_data="[]"),
    ])
    db.commit()

    app = FastAPI()
    app.include_router(budgets.router, prefix="/budgets")
    app.include_router(work_orders.router, prefix="/work-orders")

    def override_db():
        yield db

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: User(
        id=1, username="admin", email="admin@test", is_active=True, is_admin=True,
    )
    with TestClient(app) as client:
        yield client, db
    db.close()
    Base.metadata.drop_all(engine)


def frente(work_id: int, height: float | None, name: str) -> dict:
    return {
        "additional_work_id": work_id,
        "type": "frente",
        "name": name,
        "linear_meters": 2.5,
        "quantity": 1,
        "currency": "USD",
        "front_kind": "MITER_45",
        "front_height_cm": height,
    }


def test_catalogue_identifies_miter45_and_preserves_two_distinct_heights(isolated_api):
    _, db = isolated_api
    rows = [frente(1, 12.5, "Frente Ingletetado 45°"), frente(2, 18.0, "Frente auxiliar")]

    saved = _process_additional_works_snapshot(
        db, json.dumps(rows), usd_rate=1000,
    )
    result = json.loads(saved)

    assert [row["front_kind"] for row in result] == ["MITER_45", "MITER_45"]
    assert [row["front_height_cm"] for row in result] == [12.5, 18.0]
    assert [row["linear_meters"] for row in result] == [2.5, 2.5]


@pytest.mark.parametrize("payload_row", [
    frente(1, None, "Frente Ingletetado 45°"),
    frente(1, 0, "Frente Ingletetado 45°"),
    frente(1, -2, "Frente Ingletetado 45°"),
])
def test_budget_and_work_order_api_reject_invalid_miter45_height(isolated_api, payload_row):
    client, _ = isolated_api
    payload = {"additional_works_data": json.dumps([payload_row])}

    budget_response = client.put("/budgets/1", json=payload)
    work_order_response = client.put("/work-orders/1", json=payload)

    assert budget_response.status_code == 422
    assert work_order_response.status_code == 422
    assert "altura positiva" in budget_response.json()["detail"]
    assert "altura positiva" in work_order_response.json()["detail"]


def test_api_persists_two_miter45_heights_without_swapping(isolated_api):
    client, db = isolated_api
    rows = [frente(1, 10.0, "Frente A"), frente(2, 24.0, "Frente B")]
    payload = {"additional_works_data": json.dumps(rows)}

    assert client.put("/budgets/1", json=payload).status_code == 200
    assert client.put("/work-orders/1", json=payload).status_code == 200

    budget = db.get(Budget, 1)
    order = db.get(WorkOrder, 1)
    assert [row["front_height_cm"] for row in json.loads(budget.additional_works_data)] == [10.0, 24.0]
    assert [row["front_height_cm"] for row in json.loads(order.additional_works_data)] == [10.0, 24.0]


def test_budget_update_recalculates_live_total_without_contractual_freeze(isolated_api):
    """An editable quote must update its total and keep no frozen snapshot."""
    client, db = isolated_api
    initial_material = {
        "name": "BLANCO SUGGAR",
        "length": 2.0,
        "width": 1.0,
        "quantity": 1,
        "price_m2": 405000,
        "price_m2_usd": 0,
        "currency": "ARS",
        "is_alternative": False,
    }

    first = client.put(
        "/budgets/1",
        json={"materials_data": json.dumps([initial_material])},
    )
    assert first.status_code == 200
    assert db.get(Budget, 1).total == 810000

    updated_material = {**initial_material, "length": 1.0, "width": 2.31}
    second = client.put(
        "/budgets/1",
        json={"materials_data": json.dumps([updated_material])},
    )
    assert second.status_code == 200

    budget = db.get(Budget, 1)
    assert budget.total == 940000
    assert budget.total != 810000
    assert budget.total_exact_ars is None
    assert budget.total_contractual_ars is None
    assert budget.balance_due == 940000


def test_budget_create_edit_and_remove_pool_recalculates_without_ghost_amounts(isolated_api):
    """The API flow must price the current item set, including deletions."""
    client, db = isolated_api
    material = {
        "name": "BLANCO SUGGAR",
        "length": 1.0,
        "width": 1.0,
        "quantity": 1,
        "price_m2": 500000,
        "price_m2_usd": 0,
        "currency": "ARS",
        "is_alternative": False,
    }
    pool = {
        "pool_id": 1,
        "brand": "JOHNSON",
        "model": "LUXOR",
        "price": 435440,
        "currency": "ARS",
        "quantity": 1,
    }

    created = client.post(
        "/budgets",
        json={
            "client_id": 1,
            "usd_rate": 1000,
            "materials_data": json.dumps([material]),
            "fabrication_details": "[]",
            "additional_works_data": "[]",
            "pools_data": json.dumps([pool]),
        },
    )
    assert created.status_code == 201, created.text
    budget_id = created.json()["data"]["id"]
    budget = db.get(Budget, budget_id)
    assert budget.subtotal == 935440
    assert budget.total == 940000

    edited_material = {**material, "price_m2": 600000}
    edited = client.put(
        f"/budgets/{budget_id}",
        json={
            "materials_data": json.dumps([edited_material]),
            "pools_data": json.dumps([pool]),
        },
    )
    assert edited.status_code == 200, edited.text
    budget = db.get(Budget, budget_id)
    assert budget.subtotal == 1035440
    assert budget.total == 1040000

    removed_pool = client.put(
        f"/budgets/{budget_id}",
        json={"pools_data": "[]"},
    )
    assert removed_pool.status_code == 200, removed_pool.text
    budget = db.get(Budget, budget_id)
    assert budget.pools_data == "[]"
    assert budget.subtotal == 600000
    assert budget.total == 600000


def test_budget_pool_survives_put_and_fresh_get(isolated_api):
    """A pool added through the API remains after the next read transaction."""
    client, _ = isolated_api
    created = client.post(
        "/budgets",
        json={
            "client_id": 1,
            "materials_data": "[]",
            "pools_data": "[]",
            "fabrication_details": "[]",
            "additional_works_data": "[]",
        },
    )
    assert created.status_code == 201, created.text
    budget_id = created.json()["data"]["id"]
    pool = {
        "pool_id": 77,
        "brand": "JOHNSON",
        "model": "LUXOR",
        "price": 305000,
        "currency": "ARS",
        "quantity": 1,
    }

    updated = client.put(
        f"/budgets/{budget_id}",
        json={"pools_data": json.dumps([pool])},
    )
    assert updated.status_code == 200, updated.text

    reloaded = client.get(f"/budgets/{budget_id}")
    assert reloaded.status_code == 200, reloaded.text
    assert json.loads(reloaded.json()["data"]["pools_data"]) == [pool]


def test_historical_front_without_height_remains_compatible(isolated_api):
    client, db = isolated_api
    historical = {
        "additional_work_id": 99,
        "type": "frente",
        "name": "Frente historico",
        "linear_meters": 2,
        "quantity": 1,
        "currency": "USD",
    }

    saved = json.loads(_process_additional_works_snapshot(db, json.dumps([historical])))
    converted = _snapshot_additional_works([historical], 1000)[0]
    assert saved[0]["name"] == "Frente historico"
    assert converted["name"] == "Frente historico"
    assert "front_kind" not in saved[0]
    assert "front_height_cm" not in saved[0]

    response = client.put(
        "/budgets/1",
        json={"additional_works_data": json.dumps([historical])},
    )
    assert response.status_code == 200


def test_budget_to_work_order_conversion_preserves_front_heights():
    rows = [frente(1, 11.0, "Frente A"), frente(2, 22.0, "Frente B")]
    budget = SimpleNamespace(
        id=7, client_id=1, delivery_address_id=None, material="", material_price_m2=0,
        material_price_m2_usd=0, materials_data="[]", additional_works_data=json.dumps(rows),
        pieces_data=None, sketch_elements=[], fabrication_details="[]", color="", thickness="",
        finish="", bacha="", anafe="", currency="USD", transport_usd=0, transport=0,
        installation=0, discount=0, discount_percentage=0, discount_fixed_amount=0,
        discount_enabled=False, discount_target="total", payment_method=None,
        payment_method_id=None, installments=1, priority="NORMAL", delivery_date=None,
        notes="", pool_id=None, pool_price=0, pool_currency="ARS", pool_image=None,
        pools_data="[]", design_observations="", important_observations="",
        budget_terms_override="", warranty_override="", date=None,
    )
    repo = SimpleNamespace(get_last_number=lambda: None)

    payload = build_conversion_payload(budget, repo, usd_rate=1500)
    converted = json.loads(payload["additional_works_data"])

    assert [row["front_height_cm"] for row in converted] == [11.0, 22.0]
    assert [row["linear_meters"] for row in converted] == [2.5, 2.5]


def test_height_is_informational_and_does_not_change_pricing_fields(isolated_api):
    _, db = isolated_api
    base = frente(1, 10.0, "Frente A")
    base.update({"price": 42.5, "total": 106.25, "total_ars_budgeted": 106250.0})
    changed = {**base, "front_height_cm": 25.0}

    first = json.loads(_process_additional_works_snapshot(db, json.dumps([base]), usd_rate=1000))[0]
    second = json.loads(_process_additional_works_snapshot(db, json.dumps([changed]), usd_rate=1000))[0]

    assert second["front_height_cm"] == 25.0
    for key in ("price", "total", "linear_meters", "total_ars_budgeted", "total_usd_budgeted"):
        assert second.get(key) == first.get(key)


def test_legacy_ot_pdf_row_exposes_miter45_height():
    [row] = _build_piece_additional_pdf(json.dumps([
        frente(1, 17.5, "Frente Ingletado 45°"),
    ]))
    assert row["height_str"] == "17.5 cm"
    assert row["quantity"] == 2.5
