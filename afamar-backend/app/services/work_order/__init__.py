"""Work-order service (package).

Public surface — re-exports ``WorkOrderService`` so the routers
(``work_orders``, ``public``, ``search``, ``whatsapp``) keep using
``from app.services.work_order import WorkOrderService``.

The orchestrator delegates the heavy work to focused modules in the same
package:

  * ``helpers.py``   — small utilities (sketch mirror, native deposit,
                       client total, fabrication concept name sets).
  * ``cash.py``      — idempotent cash-movement booking.
  * ``recalc.py``    — server-side totals recompute + per-cuota detail.
  * ``snapshots.py`` — bake measurement snapshots into ``pieces_data``.
  * ``conversion.py``— budget → WO payload assembly (shared with the
                       BudgetService convert_alternative_to_work_order
                       path).
"""
from datetime import date
from typing import List, Optional

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.core.settings import settings
from app.models.work_order import WorkOrder
from app.repositories.work_order import WorkOrderRepository
from app.services.stock_helpers import deduct_pool_stock, restore_pool_stock
from app.services.work_order.cash import create_cash_movement_on_deposit
from app.services.work_order.conversion import build_conversion_payload
from app.services.work_order.helpers import (
    deposit_native_amount,
    stash_sketch_into_budgeted_details,
    update_client_total_purchased,
)
from app.services.work_order.recalc import recalculate_totals_from_items
from app.services.work_order.snapshots import bake_snapshot_into_pieces
from app.utils.client_helpers import resolve_client_id
from app.utils.numbering import generate_work_order_number

# Backward-compat aliases for the legacy module-level function names
# (with leading underscore). Older test modules and routers imported these
# directly from ``app.services.work_order`` before the file became a
# package; re-exporting them keeps the public surface stable while the
# implementation now lives in focused submodules.
_create_cash_movement_on_deposit = create_cash_movement_on_deposit
_deposit_native_amount = deposit_native_amount
_stash_sketch_into_budgeted_details = stash_sketch_into_budgeted_details
_update_client_total_purchased = update_client_total_purchased
_recalculate_totals_from_items = recalculate_totals_from_items
_bake_snapshot_into_pieces = bake_snapshot_into_pieces


class WorkOrderService:
    def __init__(self, db: Session):
        self.repo = WorkOrderRepository(db)

    # ---- queries --------------------------------------------------------

    def get_all(self, skip: int = 0, limit: int = 100) -> List[WorkOrder]:
        return self.repo.get_all(skip, limit)

    def get_by_id(self, order_id: int) -> Optional[WorkOrder]:
        return self.repo.get_by_id(order_id)

    def get_by_status(self, status: str) -> List[WorkOrder]:
        return self.repo.get_by_status(status)

    def get_by_client(self, client_id: int) -> List[WorkOrder]:
        return self.repo.get_by_client(client_id)

    def search(self, term: str) -> List[WorkOrder]:
        return self.repo.search(term)

    def list_filtered(
        self,
        status: str | None = None,
        client_id: int | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        search: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[List[WorkOrder], int]:
        items = self.repo.list_filtered(status, client_id, date_from, date_to, search, skip, limit)
        total = self.repo.list_filtered_count(status, client_id, date_from, date_to, search)
        return items, total

    # ---- mutations ------------------------------------------------------

    def create(self, data: dict) -> WorkOrder:
        last_number = self.repo.get_last_number()
        data["number"] = generate_work_order_number(last_number)
        data["client_id"] = resolve_client_id(
            self.repo.db, data,
            "Debe seleccionar o escribir un cliente antes de guardar la orden de trabajo.",
        )
        data.pop("client_address", None)
        # The frontend sends the sketch as `sketch_elements` (an array of
        # pages). The WorkOrder model doesn't have a sketch_elements column
        # (the sketch lives on the Budget), so we serialise it into the
        # existing `budgeted_details` TEXT column — the same field used when
        # a WorkOrder is created from a Budget.
        stash_sketch_into_budgeted_details(data)
        # Always recompute totals from the raw line items (fabrication details,
        # materials, pools) — never trust the totals the frontend sends. The
        # WorkOrder PDF + list rows both read `total`, `total_usd`, `subtotal`,
        # `subtotal_usd` directly from the DB, so a wrong value here means the
        # PDF shows $0 even though the line items are populated.
        recalculate_totals_from_items(self.repo.db, data)
        order = self.repo.create(data)
        self.repo.db.commit()
        self.repo.db.refresh(order)
        if not order.stock_deducted and (order.pool_id or order.pools_data):
            deduct_pool_stock(self.repo.db, order.pool_id, order.pools_data, order.number)
            order.stock_deducted = True
            self.repo.db.commit()
            self.repo.db.refresh(order)
        # A direct WO is a confirmed sale — record the seña in the open
        # cash box, same as create_from_budget() does on conversion. The
        # `sena_registered` idempotency flag guarantees it lands EXACTLY
        # once even if this create path is re-entered (duplicate POST).
        order.register_flag = "sena_registered"
        create_cash_movement_on_deposit(
            self.repo.db,
            order,
            deposit_native_amount(order),
            order.deposit_currency,
            order.payment_method,
        )
        self.repo.db.commit()
        # Drop the transient Python attribute we used to signal which
        # idempotency flag to set inside the helper — it's not a real
        # SQLAlchemy column and would otherwise leak into the JSON
        # response (replacing the whole WorkOrder payload with just the
        # flag name). Then refresh so the response carries the post-commit
        # column values (SQLAlchemy expires instance state on commit).
        try:
            delattr(order, "register_flag")
        except AttributeError:
            pass
        self.repo.db.refresh(order)
        return order

    def create_from_budget(self, budget) -> WorkOrder:
        if budget.status == "CONVERTED_TO_OT":
            raise ConflictError("Budget already converted to a work order")
        if budget.status != "APPROVED":
            raise ValidationError("Budget must be approved to convert")

        # All snapshot baking, gate inheritance, zeroed-deposit and
        # term-override rules live in the conversion module so the
        # alternative-conversion path can reuse them.
        data = build_conversion_payload(budget, self.repo)

        budget.status = "CONVERTED_TO_OT"
        order = self.repo.create(data)

        # Stock deduction: if the budget hadn't yet debited pool stock
        # (the usual case — stock is debited at conversion time, not at
        # approval), do it now and mark the budget. Then carry the final
        # flag over to the order so subsequent re-renders / cancellations
        # see the truth.
        if not budget.stock_deducted:
            deduct_pool_stock(self.repo.db, budget.pool_id, budget.pools_data, order.number)
            budget.stock_deducted = True
        order.stock_deducted = budget.stock_deducted
        self.repo.db.commit()
        self.repo.db.refresh(order)

        if budget.client_id:
            update_client_total_purchased(self.repo.db, budget.client_id)
        # Book the seña from the source budget. Since budgets are pure quote
        # documents the deposit_* fields above are ALL zero, so
        # `create_cash_movement_on_deposit` short-circuits (amount <= 0) and
        # `sena_registered` stays False — the operator charges the seña later
        # in MEDICIÓN via update(). This call is kept for belt-and-braces in
        # case a conversion path ever carries a nonzero deposit again.
        order.register_flag = "sena_registered"
        create_cash_movement_on_deposit(
            self.repo.db,
            order,
            deposit_native_amount(order),
            order.deposit_currency,
            order.payment_method,
        )
        self.repo.db.commit()
        # Drop the transient Python attribute (see create() for context).
        try:
            delattr(order, "register_flag")
        except AttributeError:
            pass
        self.repo.db.refresh(order)
        return order

    # Status transitions between the 4 main states are bidirectional so the
    # list page's "Retroceder estado" button can undo a premature advance
    # (e.g. accidentally moving a MEASUREMENT order to WORKSHOP). CANCELLED
    # is a special one-way transition handled separately (any state ->
    # CANCELLED, with pool stock restoration if it was deducted).
    VALID_TRANSITIONS = {
        "MEASUREMENT": {"WORKSHOP"},
        "WORKSHOP": {"MEASUREMENT", "FINISHED"},
        "FINISHED": {"WORKSHOP", "DELIVERED"},
        "DELIVERED": {"FINISHED"},
    }

    def update(self, order_id: int, data: dict) -> Optional[WorkOrder]:
        order = self.repo.get_by_id(order_id)
        if not order:
            return None
        stash_sketch_into_budgeted_details(data)
        # If the update carries line-item arrays (or totals) we recompute
        # totals server-side. This keeps `total` consistent with the rows
        # even when the client only sent partial data and patched in stale
        # `total` / `total_usd` values.
        if any(
            key in data
            for key in (
                "fabrication_details", "materials_data", "pieces_data", "pools_data",
                "usd_rate", "transport", "transport_usd", "discount_percentage",
                "discount_fixed_amount", "payment_method", "installments",
                "apply_cash_discount",
                "deposit_received", "deposit_usd", "deposit_currency",
            )
        ):
            # Derive missing flat arrays from an incoming `pieces_data` BEFORE
            # seeding `merged` from the persisted row — otherwise the
            # persisted arrays would mask the pieces and the derivation would
            # never run. Explicit arrays in the patch still win.
            from app.services.budget_calculator import flatten_pieces
            flatten_pieces(data, only_if_missing=True)
            # Merge persisted values with the incoming patch so the helper
            # can recalculate from a complete picture.
            merged = {
                "usd_rate": order.usd_rate,
                "transport": order.transport,
                "transport_usd": order.transport_usd,
                "discount_enabled": order.discount_enabled,
                "discount_target": order.discount_target,
                "discount_percentage": order.discount_percentage,
                "discount_fixed_amount": order.discount_fixed_amount,
                "payment_method": order.payment_method,
                "installments": order.installments,
                "apply_cash_discount": order.apply_cash_discount,
                "deposit_received": order.deposit_received,
                "deposit_usd": order.deposit_usd,
                "deposit_currency": order.deposit_currency,
                "fabrication_details": order.fabrication_details,
                "materials_data": order.materials_data,
                "pools_data": order.pools_data,
            }
            for key, value in data.items():
                if value is not None:
                    merged[key] = value
            recalculate_totals_from_items(self.repo.db, merged)
            # Mirror the recomputed totals into the outgoing payload so the
            # repo.update() call below writes them back. The list-page
            # PDF preview reads `installment_detail_*` directly from the
            # row, so we must persist it whenever the helper recomputed
            # it (PATCH with `materials_data` only, status flips, etc.).
            for key in (
                "subtotal", "subtotal_usd", "total", "total_usd",
                "balance_due", "balance_due_usd", "deposit_received", "deposit_usd",
                "installment_detail_ars", "installment_detail_usd",
                # Derived from `pieces_data` by the recalc — persist them so
                # an API-only PATCH (pieces, no flat arrays) stays consistent.
                "materials_data", "fabrication_details", "additional_works_data",
                # The recalc may rewrite this when `payment_method_id`
                # resolves to a catalogue row whose name differs from the
                # stale legacy string — propagate it so the repo writes it.
                "payment_method",
            ):
                if key in merged:
                    data[key] = merged[key]
        old_status = order.status
        new_status = data.get("status", old_status)

        if new_status != old_status:
            if new_status != "CANCELLED" and new_status not in self.VALID_TRANSITIONS.get(old_status, set()):
                raise ValidationError(f"Invalid status transition from {old_status} to {new_status}")
            if new_status == "CANCELLED" and order.stock_deducted:
                restore_pool_stock(self.repo.db, order.pool_id, order.pools_data, order.number)
                order.stock_deducted = False
            if new_status == "FINISHED" and order.client_id:
                update_client_total_purchased(self.repo.db, order.client_id)

        result = self.repo.update(order, data)

        # Late seña booking: the operator often converts a budget to a WO
        # without a seña (the client gave estimated measures), then opens
        # the WO during MEASUREMENT, edits the real measures, and finally
        # sets the seña (deposit_received) the client paid on confirmation.
        # At that point `create_from_budget()` already ran without booking
        # anything (amount was 0). We book it now on the first UPDATE that
        # carries a positive deposit_received while `sena_registered` is
        # still false. Idempotent via the flag, so re-saves are no-ops.
        # Skipped for fully-paid orders (tarjeta débito / crédito autofill)
        # — the full amount was booked at create() time.
        if (
            "deposit_received" in data
            and not order.sena_registered
            and not order.balance_paid
            and (data.get("deposit_received") or 0) > 0
        ):
            result.register_flag = "sena_registered"
            create_cash_movement_on_deposit(
                self.repo.db,
                result,
                deposit_native_amount(result),
                result.deposit_currency,
                result.payment_method,
            )

        # Automatic collection of the remaining balance when the WO reaches
        # DELIVERED. Deliveries are the "money done" point: the client owes
        # nothing more (the seña was booked at create/conversion; here we book
        # the rest). Idempotent via `saldo_registered` so re-saves / re-sends
        # of status DELIVERED never book the saldo twice.
        transitioned_to_delivered = (
            old_status != "DELIVERED"
            and new_status == "DELIVERED"
        )
        if transitioned_to_delivered:
            result.register_flag = "saldo_registered"
            create_cash_movement_on_deposit(
                self.repo.db,
                result,
                result.balance_due,
                result.deposit_currency,
                result.payment_method,
                # The saldo at DELIVERED is the ARS `balance_due` column —
                # always booked as ARS regardless of the deposit currency.
                currency="ARS",
            )
            # After booking the saldo on delivery, no money is left to
            # collect. The helper computes `remaining_balance` from the
            # order's current `balance_due`, but for a DELIVERED collection
            # the row MUST read `remaining_balance=0` on the cash grid —
            # the saldo IS the last payment and nothing else is owed.
            from app.models.daily_cash import DailyCash, CashMovement
            latest_mov = (
                self.repo.db.query(CashMovement)
                .filter(
                    CashMovement.order_id == result.id,
                    CashMovement.type == "INCOME",
                )
                .order_by(CashMovement.id.desc())
                .first()
            )
            if latest_mov is not None:
                latest_mov.remaining_balance = 0.0

        self.repo.db.commit()
        self.repo.db.refresh(result)
        return result

    def delete(self, order_id: int) -> bool:
        order = self.repo.get_by_id(order_id)
        if not order:
            return False
        if order.stock_deducted:
            restore_pool_stock(self.repo.db, order.pool_id, order.pools_data, order.number)
        self.repo.delete(order)
        self.repo.db.commit()
        return True

    def reverse_payment(self, order_id: int, movement_id: int):
        """Reverse an INCOME cash movement booked against a work order.

        The movement is HARD-deleted (no soft flag / migration), the open cash
        register totals are recomputed from the surviving rows, and the WO
        financial columns (``balance_due`` / ``balance_due_usd`` / ``balance_paid``)
        are re-derived from the remaining INCOME movements of the order so the
        PDF / module always show an up-to-date saldo.

        Financial correction only: the operational status (MEASUREMENT /
        WORKSHOP / FINISHED / DELIVERED) is NEVER touched, and neither are
        ``deposit_received`` / ``deposit_usd`` / ``deposit_currency`` — those drive
        the form's seña field, a different bookkeeping path from the cash
        movements. ``sena_registered`` / ``saldo_registered`` are also left as-is:
        they gate the form-deposit flow, and module payments never flip them,
        so overturning them here could double-book on a later edit.
        """
        from app.models.daily_cash import CashMovement
        from app.repositories.daily_cash import (
            CashMovementRepository,
            DailyCashRepository,
            movement_ars,
        )

        order = self.repo.get_by_id(order_id)
        if not order:
            raise NotFoundError("Work order")

        movement = (
            self.repo.db.query(CashMovement)
            .filter(
                CashMovement.id == movement_id,
                CashMovement.order_id == order_id,
                CashMovement.type == "INCOME",
            )
            .first()
        )
        if movement is None:
            raise NotFoundError("Payment")

        # Hard-delete + recompute the open-box totals within the same
        # transaction as the balance re-derivation (no intermediate commit).
        cash_id = movement.daily_cash_id
        CashMovementRepository(self.repo.db).delete(movement_id)
        if cash_id is not None:
            DailyCashRepository(self.repo.db).recalculate(cash_id)

        remaining = (
            self.repo.db.query(CashMovement)
            .filter(CashMovement.order_id == order_id, CashMovement.type == "INCOME")
            .all()
        )
        usd_rate = float(order.usd_rate or settings.DEFAULT_USD_RATE)
        if usd_rate <= 0:
            usd_rate = settings.DEFAULT_USD_RATE
        paid_ars = 0.0
        paid_usd = 0.0
        for mov in remaining:
            m_ars = movement_ars(mov)
            paid_ars += m_ars
            if (mov.currency or "ARS").upper() == "USD":
                paid_usd += float(mov.amount or 0)
            else:
                paid_usd += round(m_ars / usd_rate, 2)

        order.balance_due = max(0.0, round(float(order.total or 0) - paid_ars, 2))
        order.balance_due_usd = max(0.0, round(float(order.total_usd or 0) - paid_usd, 2))
        order.balance_paid = order.balance_due <= 0.001
        self.repo.db.commit()
        self.repo.db.refresh(order)
        return order
