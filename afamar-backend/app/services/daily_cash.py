from datetime import datetime

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError, ValidationError

from app.repositories.daily_cash import DailyCashRepository, CashMovementRepository


class DailyCashService:
    """On-demand session boxes.

    Unlike the previous daily-cash model (one register per `date`), there is
    now always exactly ONE open register ("box"). The operator opens a box
    when they want, lets it span several days if needed, and closes it
    whenever it suits them. Closing a box automatically opens the next one
    (continuous #1, #2, #3... numbering). Saldo/anterior is written manually
    when opening.
    """

    def __init__(self, db: Session):
        self.db = db
        self.cash_repo = DailyCashRepository(db)
        self.movement_repo = CashMovementRepository(db)

    def get_current(self):
        """Return the single open register, creating it if none exists."""
        cash = self.cash_repo.get_or_create_current()
        self.db.commit()
        self.db.refresh(cash)
        return cash

    def open_cash(self, previous_balance: float = 0.0):
        """Ensure an open register exists and (re)set its opening balance.

        Idempotent: if a register is already open it is returned (and its
        `previous_balance` updated) rather than creating a second one.
        """
        cash = self.cash_repo.get_or_create_current()
        if previous_balance is not None:
            cash.previous_balance = float(previous_balance or 0)
            self.cash_repo.recalculate(cash.id)
        self.db.commit()
        self.db.refresh(cash)
        return cash

    def set_previous_balance(self, previous_balance: float):
        cash = self.cash_repo.get_or_create_current()
        cash.previous_balance = float(previous_balance or 0)
        self.cash_repo.recalculate(cash.id)
        self.db.commit()
        self.db.refresh(cash)
        return cash

    def create_movement(self, movement_data: dict):
        """Attach a movement to the single open register.

        `date` is no longer required (and is ignored if present): the
        movement always lands on the currently-open box. If there is no open
        box one is created automatically, so a work-order deposit can never
        find itself "without a box".
        """
        movement_data.pop("date", None)
        cash = self.cash_repo.get_or_create_current()
        movement = self.movement_repo.create_and_recalculate(cash.id, movement_data)
        self.db.commit()
        self.db.refresh(movement)
        return movement

    def delete_movement(self, movement_id: int):
        self.movement_repo.delete(movement_id)
        self.db.commit()

    def close_cash(self, notes: str | None = None) -> dict:
        """Close the open register and automatically open the next one.

        Returns `{ closed_cash, summary, next_cash }`.
        """
        cash = self.cash_repo.get_or_create_current()
        if cash.total_sum < cash.total_expenses:
            raise ValidationError("Cannot close: expenses exceed sum of previous balance + income")

        summary = self._build_summary(cash)
        cash.is_closed = True
        cash.closed_at = datetime.now()
        if notes:
            cash.notes = notes
        self.db.flush()

        next_cash = self.cash_repo.get_or_create_current()
        self.db.commit()
        self.db.refresh(cash)
        self.db.refresh(next_cash)
        return {"closed_cash": cash, "summary": summary, "next_cash": next_cash}

    def _build_summary(self, cash) -> dict:
        movements = cash.movements
        incomes = [m for m in movements if m.type == "INCOME"]
        expenses = [m for m in movements if m.type == "EXPENSE"]

        total_by_payment: dict[str, float] = {}
        for m in incomes:
            key = (m.payment_method or "SIN METODO").strip() or "SIN METODO"
            total_by_payment[key] = total_by_payment.get(key, 0.0) + m.amount

        duration_seconds = 0
        if cash.opened_at:
            closed = cash.closed_at or datetime.now()
            duration_seconds = max(0, int((closed - cash.opened_at).total_seconds()))

        return {
            "number": cash.number,
            "opened_at": cash.opened_at.isoformat() if cash.opened_at else None,
            "closed_at": cash.closed_at.isoformat() if cash.closed_at else None,
            "duration_seconds": duration_seconds,
            "total_by_payment": total_by_payment,
            "ingreso_count": len(incomes),
            "egreso_count": len(expenses),
            "previous_balance": cash.previous_balance or 0.0,
            "total_income": cash.total_income or 0.0,
            "total_expenses": cash.total_expenses or 0.0,
            "current_balance": cash.current_balance or 0.0,
            "real_cash": cash.real_cash or 0.0,
        }

    def get_closed(self):
        return self.cash_repo.get_closed()

    def get_by_id(self, cash_id: int):
        cash = self.cash_repo.get_by_id(cash_id)
        if not cash:
            raise NotFoundError("DailyCash")
        return cash
