"""Regression coverage for client reassignment on budgets and work orders."""
import json

import pytest

from app.core.exceptions import ValidationError
from app.models.budget import Budget
from app.models.client import Client
from app.models.client_address import ClientAddress
from app.models.work_order import WorkOrder
from app.services.budget import BudgetService
from app.services.pdf_helpers import prepare_budget_payload, prepare_work_order_payload
from app.services.work_order import WorkOrderService
from app.services.work_order.conversion import build_conversion_payload

from tests.conftest import TestingSessionLocal


@pytest.fixture
def client_assignment_db():
    db = TestingSessionLocal()
    try:
        db.add_all([
            Client(id=1, name="Cliente Original", phone="111", email="old@test.com", address="Domicilio viejo"),
            Client(id=2, name="Cliente Nuevo", phone="222", email="new@test.com", address="Domicilio nuevo"),
        ])
        db.flush()
        db.add(ClientAddress(id=1, client_id=1, address="Obra vieja", label="Obra"))
        db.add(ClientAddress(id=2, client_id=2, address="Obra nueva", label="Obra"))
        db.add(Budget(
            id=1,
            number="P-CLIENT-001",
            client_id=1,
            status="APPROVED",
            currency="ARS",
            usd_rate=1500,
            subtotal=100000,
            total=100000,
            subtotal_usd=66.67,
            total_usd=66.67,
            balance_due=100000,
            balance_due_usd=66.67,
            deposit_received=0,
            deposit_usd=0,
            materials_data=json.dumps([]),
        ))
        db.add(WorkOrder(
            id=1,
            number="A-CLIENT-001",
            client_id=1,
            status="MEASUREMENT",
            currency="ARS",
            usd_rate=1500,
            subtotal=100000,
            total=100000,
            subtotal_usd=66.67,
            total_usd=66.67,
            balance_due=100000,
            balance_due_usd=66.67,
            deposit_received=0,
            deposit_usd=0,
            materials_data=json.dumps([]),
        ))
        db.commit()
        yield db
    finally:
        db.close()


def test_budget_update_persists_new_client_and_clears_old_delivery_address(client_assignment_db):
    service = BudgetService(client_assignment_db)

    updated = service.update(1, {
        "client_id": 2,
        "client_name": "Cliente Original",  # stale display data must be ignored
    })

    assert updated.client_id == 2
    assert updated.delivery_address_id is None
    assert updated.total == 100000
    assert updated.usd_rate == 1500
    reloaded = service.repo.get_by_id(1)
    assert reloaded.client_id == 2


def test_work_order_update_persists_new_client_without_repricing(client_assignment_db):
    service = WorkOrderService(client_assignment_db)

    updated = service.update(1, {
        "client_id": 2,
        "client_name": "Cliente Original",  # stale display data must be ignored
    })

    assert updated.client_id == 2
    assert updated.delivery_address_id is None
    assert updated.total == 100000
    assert updated.usd_rate == 1500
    assert updated.deposit_received == 0
    assert updated.balance_due == 100000
    assert service.repo.get_by_id(1).client_id == 2


def test_client_id_null_is_rejected_instead_of_retaining_old_client(client_assignment_db):
    with pytest.raises(ValidationError):
        BudgetService(client_assignment_db).update(1, {"client_id": None})

    with pytest.raises(ValidationError):
        WorkOrderService(client_assignment_db).update(1, {"client_id": 9999})


def test_delivery_address_must_belong_to_selected_client(client_assignment_db):
    with pytest.raises(ValidationError):
        BudgetService(client_assignment_db).update(1, {
            "client_id": 1,
            "delivery_address_id": 2,
        })

    updated = BudgetService(client_assignment_db).update(1, {
        "client_id": 2,
        "delivery_address_id": 1,  # stale address from the previous client
    })
    assert updated.delivery_address_id is None


def test_conversion_and_pdf_payload_use_correct_client(client_assignment_db, monkeypatch):
    budget_service = BudgetService(client_assignment_db)
    budget_service.update(1, {"client_id": 2})
    budget = budget_service.repo.get_by_id(1)

    monkeypatch.setattr(
        "app.services.work_order.conversion.get_blue_mid_rate",
        lambda: 1500.0,
        raising=False,
    )
    conversion = build_conversion_payload(
        budget,
        WorkOrderService(client_assignment_db).repo,
        usd_rate=1500.0,
    )
    assert conversion["client_id"] == 2

    budget_data, budget_client, _, _ = prepare_budget_payload(budget, client_assignment_db)
    assert budget_data["client_id"] == 2
    assert budget_client["name"] == "Cliente Nuevo"

    order_service = WorkOrderService(client_assignment_db)
    order_service.update(1, {"client_id": 2})
    order = order_service.repo.get_by_id(1)
    order_data, order_client, _, _ = prepare_work_order_payload(order, client_assignment_db)
    assert order_data["client_id"] == 2
    assert order_client["name"] == "Cliente Nuevo"
