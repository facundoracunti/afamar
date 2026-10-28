from datetime import datetime

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError, ValidationError

from app.repositories.daily_cash import DailyCashRepository, CashMovementRepository, movement_ars


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
        # Normalize the native currency so 'usd'/'ARS' from the wire both
        # land as 'USD'/'ARS' regardless of casing.
        movement_data["currency"] = (movement_data.get("currency") or "ARS").upper()
        cash = self.cash_repo.get_or_create_current()
        movement = self.movement_repo.create_and_recalculate(cash.id, movement_data)
        if movement.type == "INCOME" and movement.order_id:
            self._refresh_work_order_balance(movement.order_id, movement)
        self.db.commit()
        self.db.refresh(movement)
        return movement

    def _refresh_work_order_balance(self, order_id: int, movement=None) -> None:
        """Apply registered payments to the frozen commercial total.

        Cash movements keep their own historical USD conversion. The order's
        price is never recomputed here; only its saldo is reduced by the
        surviving income movements.
        """
        from app.core.settings import settings
        from app.models.daily_cash import CashMovement
        from app.models.work_order import WorkOrder

        order = self.db.query(WorkOrder).filter(WorkOrder.id == order_id).first()
        if not order:
            return
        movements = (
            self.db.query(CashMovement)
            .filter(CashMovement.order_id == order_id, CashMovement.type == "INCOME")
            .all()
        )
        rate = float(order.usd_rate or settings.DEFAULT_USD_RATE)
        if rate <= 0:
            rate = settings.DEFAULT_USD_RATE
        paid_ars = sum(movement_ars(m) for m in movements)
        paid_usd = sum(
            float(m.amount or 0)
            if (m.currency or "ARS").upper() == "USD"
            else (movement_ars(m) / rate if rate > 0 else 0)
            for m in movements
        )
        order.balance_due = max(0.0, round(float(order.total or 0) - paid_ars, 2))
        order.balance_due_usd = max(0.0, round(float(order.total_usd or 0) - paid_usd, 2))
        order.balance_paid = order.balance_due <= 0.001
        if movement is not None:
            movement.remaining_balance = order.balance_due

    def delete_movement(self, movement_id: int):
        movement = self.movement_repo.get_by_id(movement_id)
        order_id = movement.order_id if movement else None
        self.movement_repo.delete(movement_id)
        if order_id:
            self._refresh_work_order_balance(order_id)
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
            # Sum the ARS equivalent so the by-method breakdown stays
            # consistent with the (ARS) box totals when a movement was
            # registered in USD (dólar billete).
            total_by_payment[key] = total_by_payment.get(key, 0.0) + movement_ars(m)

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
