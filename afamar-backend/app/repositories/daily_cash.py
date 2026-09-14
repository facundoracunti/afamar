from datetime import date, datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.models.daily_cash import CashMovement, DailyCash


# Payment methods that are bank transfers (NOT physically in the drawer).
# These count as cash income/expense for the register totals (Suma/Saldo)
# but are excluded from `real_cash`, because the operator does not have
# that money physically. Cash = everything EXCEPT transfers, i.e. cash,
# cash-in-USD and debit/credit cards.
_TRANSFER_KEYWORDS = ("TRANSFER", "TRANSFERENCIA")


def _is_transfer(payment_method: str | None) -> bool:
    if not payment_method:
        return False
    pm = payment_method.strip().upper()
    return any(k in pm for k in _TRANSFER_KEYWORDS)


class DailyCashRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, cash_id: int) -> DailyCash | None:
        return self.db.query(DailyCash).filter(DailyCash.id == cash_id).first()

    def get_by_number(self, number: int) -> DailyCash | None:
        return self.db.query(DailyCash).filter(DailyCash.number == number).first()

    def get_current(self) -> DailyCash | None:
        return (
            self.db.query(DailyCash)
            .filter(DailyCash.is_closed == False)  # noqa: E712
            .first()
        )

    def _next_number(self) -> int:
        max_number = self.db.query(func.max(DailyCash.number)).scalar() or 0
        return int(max_number) + 1

    def get_or_create_current(self) -> DailyCash:
        """Return the exactly-one open register, creating it if none exists."""
        existing = self.get_current()
        if existing:
            return existing
        cash = DailyCash(
            number=self._next_number(),
            date=date.today(),
            previous_balance=0.0,
            opened_at=datetime.now(),
            is_closed=False,
        )
        self.db.add(cash)
        self.db.flush()
        self.db.refresh(cash)
        return cash

    def get_closed(self) -> list[DailyCash]:
        return (
            self.db.query(DailyCash)
            .filter(DailyCash.is_closed == True)  # noqa: E712
            .order_by(DailyCash.number.desc())
            .all()
        )

    def recalculate(self, cash_id: int) -> DailyCash:
        cash = self.get_by_id(cash_id)
        if not cash:
            raise NotFoundError("DailyCash")

        movements = cash.movements
        total_income = sum(m.amount for m in movements if m.type == "INCOME")
        total_expenses = sum(m.amount for m in movements if m.type == "EXPENSE")
        cash.total_income = total_income
        cash.total_expenses = total_expenses
        cash.total_sum = (cash.previous_balance or 0) + total_income
        cash.current_balance = cash.total_sum - total_expenses

        # Cash physically in the drawer = everything EXCEPT bank transfers.
        # Transfers (income via transfer + expense type BANK_TRANSFER) still
        # count in the register totals but not in `real_cash`.
        transfer_income = sum(
            m.amount for m in movements
            if m.type == "INCOME" and _is_transfer(m.payment_method)
        )
        transfer_expenses = sum(
            m.amount for m in movements
            if m.type == "EXPENSE" and m.expense_type == "BANK_TRANSFER"
        )
        cash.real_cash = (
            (cash.previous_balance or 0)
            + (total_income - transfer_income)
            - (total_expenses - transfer_expenses)
        )

        return cash


class CashMovementRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, movement_id: int) -> CashMovement | None:
        return self.db.query(CashMovement).filter(CashMovement.id == movement_id).first()

    def get_by_cash_register(self, cash_id: int) -> list[CashMovement]:
        return (
            self.db.query(CashMovement)
            .filter(CashMovement.daily_cash_id == cash_id)
            .order_by(CashMovement.created_at)
            .all()
        )

    def create(self, daily_cash_id: int, data: dict) -> CashMovement:
        data.pop("date", None)
        data["daily_cash_id"] = daily_cash_id
        movement = CashMovement(**data)
        self.db.add(movement)
        self.db.flush()
        self.db.refresh(movement)
        return movement

    def create_and_recalculate(self, cash_id: int, data: dict) -> CashMovement:
        movement = self.create(cash_id, data)
        DailyCashRepository(self.db).recalculate(cash_id)
        return movement

    def delete(self, movement_id: int) -> None:
        movement = self.get_by_id(movement_id)
        if movement:
            cash_id = movement.daily_cash_id
            self.db.delete(movement)
            DailyCashRepository(self.db).recalculate(cash_id)
