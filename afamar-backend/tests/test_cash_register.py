"""Tests for the on-demand session-based cash register backend.

Covers the redesign from daily-cash (one register per `date`) to numbered
session boxes (`#1, #2, #3...`): exactly-one-open invariant, continuous
numbering, close→auto-open-next, no-`date` movements, the close summary,
and the `real_cash` rule (cash physically in drawer = everything EXCEPT
bank transfers).
"""
import pytest

from app.services.daily_cash import DailyCashService
from app.core.exceptions import ValidationError
from app.models.daily_cash import DailyCash, CashMovement


@pytest.fixture
def cash_db(setup_db):
    """A bare session (no explicit schema seed) for cash tests."""
    from tests.conftest import TestingSessionLocal

    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def _count_open(db) -> int:
    return db.query(DailyCash).filter(DailyCash.is_closed == False).count()  # noqa: E712


def test_get_current_creates_first_box_number_1(cash_db):
    svc = DailyCashService(cash_db)
    box = svc.get_current()
    assert box.number == 1
    assert box.is_closed is False
    assert box.previous_balance == 0
    assert box.opened_at is not None
    # Only one open box is ever created.
    assert _count_open(cash_db) == 1
    # Idempotent: calling again returns the same box, not a second one.
    box2 = svc.get_current()
    assert box2.id == box.id
    assert _count_open(cash_db) == 1


def test_continuous_numbering_across_close(cash_db):
    svc = DailyCashService(cash_db)
    first = svc.get_current()          # #1
    assert first.number == 1

    result = svc.close_cash()
    assert result["closed_cash"].id == first.id
    assert result["closed_cash"].is_closed is True
    assert result["closed_cash"].closed_at is not None
    # The next box is automatically opened with the consecutive number.
    assert result["next_cash"].number == 2
    assert result["next_cash"].is_closed is False

    # Still exactly one open box after the close.
    assert _count_open(cash_db) == 1

    # Close #2 → next is #3.
    result2 = svc.close_cash()
    assert result2["next_cash"].number == 3


def test_movement_lands_on_current_box_without_date(cash_db):
    svc = DailyCashService(cash_db)
    box = svc.get_current()
    mov = svc.create_movement({
        "type": "INCOME",
        "amount": 10000,
        "payment_method": "EFECTIVO",
    })
    assert mov.daily_cash_id == box.id
    cash_db.refresh(box)
    assert box.total_income == 10000
    assert box.current_balance == 10000


def test_movement_creates_box_when_none_open(cash_db):
    svc = DailyCashService(cash_db)
    # No box pre-exists in this DB; the movement auto-creates one.
    mov = svc.create_movement({
        "type": "EXPENSE",
        "amount": 500,
        "description": "Cafe",
    })
    box = cash_db.get(DailyCash, mov.daily_cash_id)
    assert box.number == 1
    assert box.total_expenses == 500


def test_real_cash_excludes_transfers(cash_db):
    svc = DailyCashService(cash_db)
    box = svc.get_current()
    svc.set_previous_balance(1000)
    svc.create_movement({"type": "INCOME", "amount": 3000, "payment_method": "EFECTIVO"})
    svc.create_movement({"type": "INCOME", "amount": 2000, "payment_method": "TARJETA DE CRÉDITO"})
    svc.create_movement({"type": "INCOME", "amount": 1500, "payment_method": "TRANSFERENCIA BANCARIA"})
    svc.create_movement({
        "type": "EXPENSE", "amount": 500, "expense_type": "GENERAL", "description": "compra",
    })
    svc.create_movement({
        "type": "EXPENSE", "amount": 800, "expense_type": "BANK_TRANSFER", "description": "pago prov",
    })
    cash_db.refresh(box)

    # Totals: income 6500, expenses 1300.
    assert box.total_income == 6500
    assert box.total_expenses == 1300
    assert box.current_balance == 1000 + 6500 - 1300
    # real_cash: prev + (income - transfers) - (expenses - bank transfers)
    # = 1000 + (6500 - 1500) - (1300 - 800) = 1000 + 5000 - 500 = 5500
    assert box.real_cash == 5500


def test_close_summary_grouped_by_payment(cash_db):
    svc = DailyCashService(cash_db)
    box = svc.get_current()
    svc.set_previous_balance(2000)
    svc.create_movement({"type": "INCOME", "amount": 1000, "payment_method": "EFECTIVO"})
    svc.create_movement({"type": "INCOME", "amount": 2500, "payment_method": "TARJETA DE CRÉDITO"})
    svc.create_movement({"type": "INCOME", "amount": 700, "payment_method": "TRANSFERENCIA BANCARIA"})
    svc.create_movement({"type": "EXPENSE", "amount": 300, "expense_type": "GENERAL"})

    result = svc.close_cash("cerrada porque juntamos ordenes")
    summary = result["summary"]
    assert summary["number"] == box.number
    assert summary["ingreso_count"] == 3
    assert summary["egreso_count"] == 1
    assert summary["total_by_payment"]["EFECTIVO"] == 1000
    assert summary["total_by_payment"]["TARJETA DE CRÉDITO"] == 2500
    assert summary["total_by_payment"]["TRANSFERENCIA BANCARIA"] == 700
    assert summary["previous_balance"] == 2000
    assert summary["total_income"] == 4200
    assert summary["total_expenses"] == 300
    assert summary["current_balance"] == 2000 + 4200 - 300
    # real_cash excludes the transfer: 2000 + (4200 - 700) - (300 - 0)
    assert summary["real_cash"] == 2000 + 3500 - 300
    assert summary["duration_seconds"] >= 0
    # Notes persisted on the closed box.
    assert result["closed_cash"].notes == "cerrada porque juntamos ordenes"


def test_close_validation_expenses_exceed_sum(cash_db):
    svc = DailyCashService(cash_db)
    svc.get_current()
    svc.set_previous_balance(100)
    svc.create_movement({"type": "EXPENSE", "amount": 500, "expense_type": "GENERAL"})
    with pytest.raises(ValidationError):
        svc.close_cash()


def test_open_cash_is_idempotent_and_sets_balance(cash_db):
    svc = DailyCashService(cash_db)
    first = svc.get_current()                 # #1, balance 0
    opened = svc.open_cash(previous_balance=5000)
    assert opened.id == first.id               # same box, not duplicated
    assert opened.previous_balance == 5000
    assert _count_open(cash_db) == 1


def test_get_closed_ordered_by_number(cash_db):
    svc = DailyCashService(cash_db)
    svc.get_current()          # #1
    svc.close_cash()
    svc.close_cash()           # now #3 open, #1 and #2 closed
    closed = svc.get_closed()
    assert [c.number for c in closed] == [2, 1]
