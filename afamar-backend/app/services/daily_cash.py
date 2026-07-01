from datetime import date

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.repositories.daily_cash import CashMovementRepository, DailyCashRepository


class DailyCashService:
    def __init__(self, db: Session):
        self.db = db
        self.cash_repo = DailyCashRepository(db)
        self.movement_repo = CashMovementRepository(db)

    def get_or_create(self, query_date: date):
        cash = self.cash_repo.get_or_create(query_date)
        return cash

    def create_movement(self, movement_data: dict):
        movement_date = movement_data.pop("date", None)
        if movement_date is not None:
            cash = self.cash_repo.get_or_create(movement_date)
        else:
            raise HTTPException(status_code=400, detail="Date is required")
        movement = self.movement_repo.create_and_recalculate(cash.id, movement_data)
        self.db.commit()
        self.db.refresh(movement)
        return movement

    def delete_movement(self, movement_id: int):
        self.movement_repo.delete(movement_id)
        self.db.commit()

    def update_previous_balance(self, query_date: date, previous_balance: float):
        cash = self.cash_repo.get_or_create(query_date)
        cash.previous_balance = previous_balance
        self.db.commit()
        self.db.refresh(cash)
        return self.cash_repo.recalculate(cash.id)

    def close_cash(self, query_date: date, notes: str | None = None):
        cash = self.cash_repo.get_or_create(query_date)
        if cash.total_sum < cash.total_expenses:
            raise HTTPException(
                status_code=400,
                detail="Cannot close: expenses exceed sum of previous balance + income",
            )
        cash.is_closed = True
        if notes:
            cash.notes = notes
        self.db.commit()
        self.db.refresh(cash)
        return cash

    def get_closed(self):
        return self.cash_repo.get_closed()
