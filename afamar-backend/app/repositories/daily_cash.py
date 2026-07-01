from datetime import date

from sqlalchemy.orm import Session

from app.models.daily_cash import CashMovement, DailyCash


class DailyCashRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, cash_id: int) -> DailyCash | None:
        return self.db.query(DailyCash).filter(DailyCash.id == cash_id).first()

    def get_by_date(self, query_date: date) -> DailyCash | None:
        return self.db.query(DailyCash).filter(DailyCash.date == query_date).first()

    def get_or_create(self, query_date: date) -> DailyCash:
        existing = self.get_by_date(query_date)
        if existing:
            return existing
        cash = DailyCash(date=query_date)
        self.db.add(cash)
        self.db.flush()
        self.db.refresh(cash)
        return cash

    def get_closed(self) -> list[DailyCash]:
        return (
            self.db.query(DailyCash)
            .filter(DailyCash.is_closed)
            .order_by(DailyCash.date.desc())
            .all()
        )

    def recalculate(self, cash_id: int) -> DailyCash:
        cash = self.get_by_id(cash_id)
        if not cash:
            raise ValueError("DailyCash not found")

        movements = cash.movements
        total_income = sum(m.amount for m in movements if m.type == "INCOME")
        total_expenses = sum(m.amount for m in movements if m.type == "EXPENSE")
        cash.total_income = total_income
        cash.total_expenses = total_expenses
        cash.total_sum = (cash.previous_balance or 0) + total_income
        cash.current_balance = cash.total_sum - total_expenses

        cash_income = sum(
            m.amount for m in movements
            if m.type == "INCOME" and (m.payment_method or "").upper() == "CASH"
        )
        tb_expenses = sum(
            m.amount for m in movements
            if m.type == "EXPENSE" and m.expense_type == "BANK_TRANSFER"
        )
        cash.real_cash = (cash.previous_balance or 0) + cash_income - (total_expenses - tb_expenses)

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
