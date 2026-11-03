import json
from datetime import date, datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401 - register every mapped table before create_all
from app.core.exceptions import ConflictError, ValidationError
from app.db.base import Base
from app.models.budget import Budget
from app.models.client import Client
from app.models.daily_cash import CashMovement, DailyCash
from app.models.pool_stock import PoolStock
from app.models.work_order import WorkOrder
from app.services.budget import BudgetService
from app.services.work_order.creation import create_work_order_from_budget
from app.services.work_order.pool_requirements import (
    assign_pending_pool_requirement,
    cancel_work_order_with_recovery,
    ensure_budget_stock_is_traceable,
    list_pending_pool_requirements,
    register_initial_pool_requirements,
)


@pytest.fixture
def isolated_db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)


def _order(pool_id: int, quantity: int = 1) -> WorkOrder:
    return WorkOrder(
        number="A-POOL-001",
        client_id=1,
        status="MEASUREMENT",
        pools_data=json.dumps([{"pool_id": pool_id, "quantity": quantity}]),
    )


def test_initial_allocation_is_partial_and_never_negative(isolated_db):
    pool = PoolStock(brand="Johnson", model="Luxor", quantity=1, currency_id=1)
    isolated_db.add(pool)
    isolated_db.flush()
    order = _order(pool.id, quantity=2)
    isolated_db.add(order)
    isolated_db.flush()

    complete = register_initial_pool_requirements(isolated_db, order)
    isolated_db.commit()

    requirement = order.pool_requirements[0]
    assert complete is False
    assert pool.quantity == 0
    assert requirement.required_quantity == 2
    assert requirement.allocated_quantity == 1
    assert requirement.pending_quantity == 1
    assert isolated_db.query(PoolStock).filter_by(id=pool.id).one().quantity >= 0


def test_cancel_requires_explicit_recovery_and_restores_only_recovered_units(isolated_db):
    pool = PoolStock(brand="Johnson", model="Luxor", quantity=2, currency_id=1)
    isolated_db.add(pool)
    isolated_db.flush()
    order = _order(pool.id, quantity=2)
    isolated_db.add(order)
    isolated_db.flush()
    register_initial_pool_requirements(isolated_db, order)
    isolated_db.commit()
    requirement = order.pool_requirements[0]

    cancel_work_order_with_recovery(
        isolated_db,
        order.id,
        [{"requirement_id": requirement.id, "recovered_quantity": 1}],
    )

    assert pool.quantity == 1
    assert requirement.allocated_quantity == 2
    assert requirement.recovered_quantity == 1
    assert requirement.unrecovered_quantity == 1
    assert order.status == "CANCELLED"
    assert isolated_db.query(WorkOrder).filter_by(id=order.id).one().status == "CANCELLED"

    with pytest.raises(ConflictError):
        cancel_work_order_with_recovery(
            isolated_db,
            order.id,
            [{"requirement_id": requirement.id, "recovered_quantity": 1}],
        )


def test_cancel_requires_zero_to_be_explicit_for_every_assigned_requirement(isolated_db):
    pool = PoolStock(brand="Johnson", model="Luxor", quantity=1, currency_id=1)
    isolated_db.add(pool)
    isolated_db.flush()
    order = _order(pool.id)
    isolated_db.add(order)
    isolated_db.flush()
    register_initial_pool_requirements(isolated_db, order)
    isolated_db.commit()
    requirement = order.pool_requirements[0]

    with pytest.raises(ValidationError):
        cancel_work_order_with_recovery(isolated_db, order.id, [])

    cancel_work_order_with_recovery(
        isolated_db,
        order.id,
        [{"requirement_id": requirement.id, "recovered_quantity": 0}],
    )
    assert pool.quantity == 0


def test_cancel_rejects_duplicate_recovery_ids_without_mutating_stock(isolated_db):
    pool = PoolStock(brand="Johnson", model="Luxor", quantity=1, currency_id=1)
    isolated_db.add(pool)
    isolated_db.flush()
    order = _order(pool.id)
    isolated_db.add(order)
    isolated_db.flush()
    register_initial_pool_requirements(isolated_db, order)
    isolated_db.commit()
    requirement = order.pool_requirements[0]

    with pytest.raises(ValidationError, match="no puede repetir"):
        cancel_work_order_with_recovery(
            isolated_db,
            order.id,
            [
                {"requirement_id": requirement.id, "recovered_quantity": 0},
                {"requirement_id": requirement.id, "recovered_quantity": 0},
            ],
        )

    isolated_db.rollback()
    assert isolated_db.query(PoolStock).filter_by(id=pool.id).one().quantity == 0
    assert isolated_db.query(WorkOrder).filter_by(id=order.id).one().status == "MEASUREMENT"


@pytest.mark.parametrize(
    "raw, message",
    [
        ("not-json", "JSON inválido"),
        (json.dumps([{"pool_id": 1, "quantity": -1}]), "entero positivo"),
        (json.dumps([{"pool_id": "x", "quantity": 1}]), "pool_id"),
        (json.dumps([{"quantity": 1}]), "marca y modelo"),
    ],
)
def test_invalid_pool_payload_is_rejected_without_stock_mutation(isolated_db, raw, message):
    pool = PoolStock(brand="Johnson", model="Luxor", quantity=2, currency_id=1)
    isolated_db.add(pool)
    isolated_db.flush()
    order = _order(pool.id)
    order.pools_data = raw
    isolated_db.add(order)
    isolated_db.flush()
    isolated_db.commit()

    with pytest.raises(ValidationError, match=message):
        register_initial_pool_requirements(isolated_db, order)

    isolated_db.rollback()
    assert isolated_db.query(PoolStock).filter_by(id=pool.id).one().quantity == 2


def test_legacy_stock_flag_blocks_conversion_before_inventory_mutation():
    class LegacyBudget:
        stock_deducted = True

    with pytest.raises(ConflictError, match="trazabilidad"):
        ensure_budget_stock_is_traceable(LegacyBudget())


def test_budget_delete_is_blocked_when_an_order_is_associated(isolated_db):
    budget = Budget(number="P-POOL-DELETE", client_id=1, status="APPROVED")
    isolated_db.add(budget)
    isolated_db.flush()
    order = WorkOrder(
        number="A-POOL-DELETE",
        client_id=1,
        budget_id=budget.id,
        status="MEASUREMENT",
    )
    isolated_db.add(order)
    isolated_db.commit()

    with pytest.raises(ConflictError, match="asociado"):
        BudgetService(isolated_db).delete(budget.id)

    isolated_db.rollback()
    assert isolated_db.get(Budget, budget.id) is not None
    assert isolated_db.get(WorkOrder, order.id) is not None


def test_legacy_full_conversion_rejects_multi_option_budget(isolated_db):
    budget = Budget(
        number="P-POOL-MULTI",
        client_id=1,
        status="APPROVED",
        options_data=json.dumps([
            {"id": "opt-1", "pieces": [{"id": "p1"}]},
            {"id": "opt-2", "pieces": [{"id": "p2"}]},
        ]),
    )
    isolated_db.add(budget)
    isolated_db.commit()

    with pytest.raises(ValidationError, match="múltiples opciones"):
        create_work_order_from_budget(
            type("Repo", (), {"db": isolated_db})(), budget
        )

    assert isolated_db.query(WorkOrder).count() == 0


def test_legacy_alternative_conversion_rejects_multi_option_budget(isolated_db):
    budget = Budget(
        number="P-POOL-ALT-MULTI",
        client_id=1,
        status="APPROVED",
        options_data=json.dumps([
            {"id": "opt-1", "pieces": [{"id": "p1"}]},
            {"id": "opt-2", "pieces": [{"id": "p2"}]},
        ]),
    )
    isolated_db.add(budget)
    isolated_db.commit()

    with pytest.raises(ConflictError, match="alternativas legacy"):
        BudgetService(isolated_db).convert_alternative_to_work_order(budget.id, 0)

    assert isolated_db.query(WorkOrder).count() == 0


def test_cancellation_requires_payment_confirmation_and_preserves_cash(isolated_db):
    client = Client(id=1, name="Cliente Pago", phone="123")
    cash = DailyCash(
        date=date.today(),
        number=1,
        opened_at=datetime.now(),
        is_closed=False,
    )
    isolated_db.add_all([client, cash])
    pool = PoolStock(brand="Johnson", model="Luxor", quantity=1, currency_id=1)
    isolated_db.add(pool)
    isolated_db.flush()
    order = _order(pool.id)
    isolated_db.add(order)
    isolated_db.flush()
    register_initial_pool_requirements(isolated_db, order)
    movement = CashMovement(
        daily_cash_id=cash.id,
        type="INCOME",
        amount=1000,
        order_id=order.id,
        description="Concepto: Seña",
    )
    isolated_db.add(movement)
    isolated_db.commit()
    requirement = order.pool_requirements[0]

    with pytest.raises(ConflictError, match="pagos registrados"):
        cancel_work_order_with_recovery(
            isolated_db,
            order.id,
            [{"requirement_id": requirement.id, "recovered_quantity": 0}],
        )
    isolated_db.rollback()
    assert isolated_db.get(WorkOrder, order.id).status == "MEASUREMENT"
    assert isolated_db.get(PoolStock, pool.id).quantity == 0
    assert isolated_db.get(CashMovement, movement.id) is not None

    cancel_work_order_with_recovery(
        isolated_db,
        order.id,
        [{"requirement_id": requirement.id, "recovered_quantity": 0}],
        payments_confirmed=True,
    )
    assert isolated_db.get(WorkOrder, order.id).status == "CANCELLED"
    assert isolated_db.get(CashMovement, movement.id) is not None
    assert isolated_db.get(PoolStock, pool.id).quantity == 0


def test_pending_listing_and_manual_assignment_are_partial_and_idempotent(isolated_db):
    isolated_db.add(Client(id=1, name="Cliente Piletas", phone="123"))
    pool = PoolStock(brand="Johnson", model="Luxor", quantity=1, currency_id=1)
    isolated_db.add(pool)
    isolated_db.flush()
    order = _order(pool.id, quantity=2)
    isolated_db.add(order)
    isolated_db.flush()
    register_initial_pool_requirements(isolated_db, order)
    isolated_db.commit()
    requirement = order.pool_requirements[0]

    rows = list_pending_pool_requirements(isolated_db)
    assert rows[0]["pending_quantity"] == 1
    assert rows[0]["available_quantity"] == 0

    with pytest.raises(ConflictError, match="No hay stock"):
        assign_pending_pool_requirement(isolated_db, requirement.id, 1)
    isolated_db.rollback()

    pool.quantity = 1
    isolated_db.commit()
    requirement, assigned, remaining = assign_pending_pool_requirement(
        isolated_db, requirement.id, 1
    )
    assert assigned == 1
    assert remaining == 0
    assert requirement.pending_quantity == 0
    assert requirement.status == "FULFILLED"
    assert isolated_db.query(PoolStock).filter_by(id=pool.id).one().quantity == 0
    assert isolated_db.query(WorkOrder).filter_by(id=order.id).one().status == "MEASUREMENT"

    with pytest.raises(ValidationError, match="cantidad pendiente"):
        assign_pending_pool_requirement(isolated_db, requirement.id, 1)
    isolated_db.rollback()
