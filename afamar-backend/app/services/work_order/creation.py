"""Work-order creation (direct sale + budget conversion).

Extracted verbatim from ``app/services/work_order/mutations.py`` (ADR 0009
— modularización) so no file in the package exceeds ~300 lines.
"""
from app.core.exceptions import ConflictError, ValidationError
from app.models.budget import Budget
from app.models.work_order import WorkOrder
from app.services.budget_options import is_multi_option
from app.services.commercial_rounding import (
    apply_contractual_totals,
    copy_contractual_totals,
    has_contractual_totals,
)
from app.services.dolar import get_blue_mid_rate
from app.services.work_order.cash import create_cash_movement_on_deposit
from app.services.work_order.conversion import build_conversion_payload
from app.services.work_order.helpers import (
    deposit_native_amount,
    stash_sketch_into_budgeted_details,
    update_client_total_purchased,
)
from app.services.work_order.pool_requirements import (
    ensure_budget_stock_is_traceable,
    register_initial_pool_requirements,
)
from app.services.work_order.recalc import recalculate_totals_from_items
from app.utils.client_helpers import resolve_client_id
from app.utils.numbering import generate_work_order_number


def create_work_order(repo, data: dict) -> WorkOrder:
    """Create a work order from scratch (direct sale)."""
    last_number = repo.get_last_number()
    data["number"] = generate_work_order_number(last_number)
    data["client_id"] = resolve_client_id(
        repo.db, data,
        "Debe seleccionar o escribir un cliente antes de guardar la orden de trabajo.",
    )
    data.pop("client_address", None)
    # The frontend displays this same blue-mid quote, but the backend is the
    # authority for persisted commercial values. Never accept a stale or
    # client-supplied rate for a new work order.
    data["usd_rate"] = get_blue_mid_rate()
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
    recalculate_totals_from_items(repo.db, data)
    apply_contractual_totals(data)
    order = repo.create(data)
    if not order.stock_deducted and (order.pool_id or order.pools_data):
        order.stock_deducted = register_initial_pool_requirements(repo.db, order)
    repo.db.commit()
    repo.db.refresh(order)
    # A direct WO is a confirmed sale — record the seña in the open
    # cash box, same as create_from_budget() does on conversion. The
    # `sena_registered` idempotency flag guarantees it lands EXACTLY
    # once even if this create path is re-entered (duplicate POST).
    order.register_flag = "sena_registered"
    create_cash_movement_on_deposit(
        repo.db,
        order,
        deposit_native_amount(order),
        order.deposit_currency,
        order.payment_method,
    )
    repo.db.commit()
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
    repo.db.refresh(order)
    return order


def create_work_order_from_budget(repo, budget) -> WorkOrder:
    """Create a work order by converting an APPROVED budget."""
    if is_multi_option(budget):
        raise ValidationError(
            "Los presupuestos con múltiples opciones deben convertirse desde "
            "POST /budgets/{id}/convert indicando option_id"
        )
    if budget.status == "CONVERTED_TO_OT":
        raise ConflictError("Budget already converted to a work order")
    if budget.status != "APPROVED":
        raise ValidationError("Budget must be approved to convert")
    locked_budget = (
        repo.db.query(Budget)
        .filter(Budget.id == budget.id)
        .with_for_update()
        .first()
    )
    if locked_budget is None:
        raise ValidationError("El presupuesto no existe")
    budget = locked_budget
    if budget.status == "CONVERTED_TO_OT":
        raise ConflictError("Budget already converted to a work order")
    if repo.db.query(WorkOrder.id).filter(WorkOrder.budget_id == budget.id).first():
        raise ConflictError("Budget already has a work order")
    ensure_budget_stock_is_traceable(budget)

    # All snapshot baking, gate inheritance, zeroed-deposit and
    # term-override rules live in the conversion module so the
    # alternative-conversion path can reuse them.
    # A converted work order is a new commercial operation: use the current
    # blue-mid rate, never the official rate frozen on the source budget.
    source_rate = (
        float(budget.usd_rate)
        if has_contractual_totals(budget) and float(budget.usd_rate or 0) > 0
        else get_blue_mid_rate()
    )
    data = build_conversion_payload(budget, repo, source_rate)
    # Rebuild the definitive ARS/USD totals once, at conversion time. After
    # this point updates use the frozen order rate and do not reprice merely
    # because measurements change.
    recalculate_totals_from_items(repo.db, data)
    # The converted order is a new commercial document. Use the exact amount
    # produced for the selected budget/option, then freeze its contract value.
    if has_contractual_totals(budget):
        copy_contractual_totals(data, budget)
    else:
        apply_contractual_totals(data)

    budget.status = "CONVERTED_TO_OT"
    order = repo.create(data)

    # Register the OT's own requirements. A legacy stock flag was rejected
    # above because it cannot be reconciled safely with requirement history;
    # new conversions allocate only available units and keep the remainder open.
    if not budget.stock_deducted:
        budget.stock_deducted = register_initial_pool_requirements(repo.db, order)
    order.stock_deducted = budget.stock_deducted
    if budget.client_id:
        update_client_total_purchased(repo.db, budget.client_id)
    # Book the seña from the source budget. Since budgets are pure quote
    # documents the deposit_* fields above are ALL zero, so
    # `create_cash_movement_on_deposit` short-circuits (amount <= 0) and
    # `sena_registered` stays False — the operator charges the seña later
    # in MEDICIÓN via update(). This call is kept for belt-and-braces in
    # case a conversion path ever carries a nonzero deposit again.
    order.register_flag = "sena_registered"
    create_cash_movement_on_deposit(
        repo.db,
        order,
        deposit_native_amount(order),
        order.deposit_currency,
        order.payment_method,
    )
    repo.db.commit()
    # Drop the transient Python attribute (see create() for context).
    try:
        delattr(order, "register_flag")
    except AttributeError:
        pass
    repo.db.refresh(order)
    return order
