"""API tests for the material colors catalogue + `color_id` FK.

Coverage:
  - colors CRUD: list, create, rename (PUT), delete unused.
  - delete of a color in use by materials → 409.
  - material create/update with `color_id` surfaces the resolved
    `color` name on the wire (PDF/budget compat).
  - explicit `color_id: null` clears the color on update.
"""
import pytest

from tests.conftest import TestingSessionLocal
from app.models.reference import Currency


@pytest.fixture
def currencies(setup_db):
    db = TestingSessionLocal()
    try:
        db.add_all([
            Currency(code="ARS", name="Peso argentino", symbol="$"),
            Currency(code="USD", name="Dólar", symbol="US$"),
        ])
        db.commit()
    finally:
        db.close()
    yield


@pytest.fixture
def auth_client(client, currencies):
    return client


def _material_payload(name="GRIS MARA", **overrides):
    payload = {
        "name": name,
        "category_id": 1,
        "color_id": 1,
        "available_thickness": "2 CM",
        "base_price": 180000.0,
        "price_usd": 180.0,
        "currency": "ARS",
        "supplier": "",
        "stock_available": 999,
    }
    payload.update(overrides)
    return payload


def test_list_colors(auth_client, seed_db):
    resp = auth_client.get("/api/v1/materials/colors")
    assert resp.status_code == 200
    names = [c["name"] for c in resp.json()["data"]]
    assert names == ["Blanco", "Negro"]


def test_create_color(auth_client, seed_db):
    resp = auth_client.post("/api/v1/materials/colors", json={"name": "  rOsA  "})
    assert resp.status_code == 201
    assert resp.json()["data"]["name"] == "Rosa"


def test_create_category_capitalizes_name(auth_client, seed_db):
    resp = auth_client.post("/api/v1/materials/categories", json={"name": "  pOrCeLaNaToS  "})
    assert resp.status_code == 201
    assert resp.json()["data"]["name"] == "Porcelanatos"


def test_create_material_capitalizes_name(auth_client, seed_db):
    resp = auth_client.post("/api/v1/materials", json=_material_payload(name="  gRiS mArA  "))
    assert resp.status_code == 201
    assert resp.json()["data"]["name"] == "Gris mara"


def test_rename_color(auth_client, seed_db):
    resp = auth_client.put("/api/v1/materials/colors/1", json={"name": "  bLaNcO pUrO  "})
    assert resp.status_code == 200
    assert resp.json()["data"]["name"] == "Blanco puro"


def test_delete_unused_color(auth_client, seed_db):
    resp = auth_client.delete("/api/v1/materials/colors/2")
    assert resp.status_code == 204
    names = [c["name"] for c in auth_client.get("/api/v1/materials/colors").json()["data"]]
    assert names == ["Blanco"]


def test_delete_color_in_use_conflicts(auth_client, seed_db):
    create = auth_client.post("/api/v1/materials", json=_material_payload(color_id=2))
    assert create.status_code == 201
    resp = auth_client.delete("/api/v1/materials/colors/2")
    assert resp.status_code == 409


def test_create_material_resolves_color(auth_client, seed_db):
    resp = auth_client.post("/api/v1/materials", json=_material_payload(color_id=2))
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["color_id"] == 2
    assert data["color"] == "Negro"


def test_update_material_changes_color(auth_client, seed_db):
    create = auth_client.post("/api/v1/materials", json=_material_payload()).json()["data"]
    resp = auth_client.put(
        f"/api/v1/materials/{create['id']}",
        json={"color_id": 2},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["color_id"] == 2
    assert data["color"] == "Negro"


def test_clear_material_color(auth_client, seed_db):
    create = auth_client.post("/api/v1/materials", json=_material_payload()).json()["data"]
    resp = auth_client.put(f"/api/v1/materials/{create['id']}", json={"color_id": None})
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["color_id"] is None
    assert data["color"] is None


def test_materials_list_returns_color(auth_client, seed_db):
    auth_client.post("/api/v1/materials", json=_material_payload(color_id=2))
    resp = auth_client.get("/api/v1/materials?limit=100")
    assert resp.status_code == 200
    material = resp.json()["data"][0]
    assert material["color_id"] == 2
    assert material["color"] == "Negro"


def test_materials_list_filters_by_color(auth_client, seed_db):
    auth_client.post("/api/v1/materials", json=_material_payload(color_id=1))
    auth_client.post("/api/v1/materials", json=_material_payload(name="NEGRO", color_id=2))
    resp = auth_client.get("/api/v1/materials?limit=100&color_id=2")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["name"] == "Negro"
    assert data[0]["color_id"] == 2
