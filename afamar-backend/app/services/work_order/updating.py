"""Work-order update (PATCH) — totals recompute + status transitions.

Extracted verbatim from ``app/services/work_order/mutations.py`` (ADR 0009
— modularización) so no file in the package exceeds ~300 lines.
"""
from typing import Optional

from app.core.exceptions import ValidationError
from app.models.work_order import WorkOrder
from app.services.stock_helpers import restore_pool_stock
from app.services.work_order.cash import create_cash_movement_on_deposit
from app.services.work_order.helpers import (
    deposit_native_amount,
    stash_sketch_into_budgeted_details,
    update_client_total_purchased,
)
from app.services.work_order.recalc import recalculate_totals_from_items

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


def update_work_order(repo, order_id: int, data: dict) -> Optional[WorkOrder]:
    """Patch a work order: recompute totals, validate the status change."""
    order = repo.get_by_id(order_id)
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
        recalculate_totals_from_items(repo.db, merged)
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
        if new_status != "CANCELLED" and new_status not in VALID_TRANSITIONS.get(old_status, set()):
            raise ValidationError(f"Invalid status transition from {old_status} to {new_status}")
        if new_status == "CANCELLED" and order.stock_deducted:
            # Cancellation — distinguish from the legacy "Entrada por
            # producción" prefix (the latter is reserved for budget
            # deletion, where the movement is a paper correction; the
            # cancellation of a real OT needs a clear operator-facing
            # label so the Movimientos modal makes the trigger
            # obvious at a glance).
            restore_pool_stock(
                repo.db, order.pool_id, order.pools_data, order.number,
                notes_prefix="Entrada por cancelación",
            )
            order.stock_deducted = False
        if new_status == "FINISHED" and order.client_id:
            update_client_total_purchased(repo.db, order.client_id)

    result = repo.update(order, data)

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
            repo.db,
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
            repo.db,
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
        from app.models.daily_cash import CashMovement
        latest_mov = (
            repo.db.query(CashMovement)
            .filter(
                CashMovement.order_id == result.id,
                CashMovement.type == "INCOME",
            )
            .order_by(CashMovement.id.desc())
            .first()
        )
        if latest_mov is not None:
            latest_mov.remaining_balance = 0.0

    repo.db.commit()
    repo.db.refresh(result)
    return result
