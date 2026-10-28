"""Convert a multi-option budget into a work order, scoped to ONE option.

2026-10-01, Fase 3 of the "Opciones / Escenarios Independientes"
migration. `convert_budget_to_work_order` is the counterpart of
`WorkOrderService.create_from_budget` for budgets that carry several
independent quote options: the operator picks the WINNING option and the
work order is built from THAT option's pieces, materials, piletas and
additional works — nothing else.

The contract:

* ``option_id`` is REQUIRED for a multi-option budget. When the budget has
  2+ options and no option resolves (missing, unknown, or two marked as
  winner), the conversion is refused with ``ValidationError`` instead of
  guessing. Converting the wrong option would bill the wrong price AND
  deduct the wrong sink from stock.
* For a LEGACY budget (no ``options_data``) or a single-option budget, the
  winning option resolves automatically (``SINGLE_OPTION_ID``) and the
  behaviour matches ``create_from_budget`` — this is what keeps the
  pre-migration flow compatible.
* The stock deduction runs against the option's OWN piletas, so a sink
  quoted only in a LOSING option is never decremented.
"""
from __future__ import annotations

from typing import Optional

from app.core.exceptions import NotFoundError, ValidationError
from app.models.budget import Budget
from app.models.work_order import WorkOrder
from app.repositories.work_order import WorkOrderRepository
from app.services.budget_calculator import flatten_pieces
from app.services.budget_option_totals import pick_winning_option
from app.services.budget_options import SINGLE_OPTION_ID
from app.services.stock_helpers import deduct_pool_stock
from app.services.dolar import get_blue_mid_rate


def _first_main_material(pieces: list[dict]) -> tuple[str, float]:
    """(name, price_m2) of the option's first main material."""
    for piece in pieces:
        main = piece.get("mainMaterial")
        if isinstance(main, dict):
            name = main.get("name") or main.get("nombre")
            price = main.get("price_m2")
            if name:
                return str(name), float(price or 0)
    return "", 0.0


def build_option_conversion_payload(
    budget: Budget,
    repo: WorkOrderRepository,
    option_id: Optional[str] = None,
    usd_rate: float | None = None,
) -> tuple[dict, dict, list]:
    """Build the ``data`` dict for the winning option's work order.

    Returns ``(data, option, pools)`` so the caller can report which option
    won and scope the stock deduction to the option's own piletas. Every
    line item comes from the OPTION's pieces; the budget's own commercial
    fields (discount gate, terms, sketch, client) are inherited verbatim,
    same as ``create_from_budget``.
    """
    import json

    from app.services.work_order.conversion import (
        _serialize_sketch,
        _snapshot_additional_works,
        _snapshot_fabrication_details,
        _snapshot_materials,
    )
    from app.utils.numbering import generate_work_order_number

    option = pick_winning_option(
        getattr(budget, "options_data", None),
        getattr(budget, "pieces_data", None),
        option_id,
    )
    if option is None:
        raise ValidationError(
            "El presupuesto tiene varias opciones: elegí cuál es la ganadora "
            "(option_id) antes de convertir."
        )

    pieces: list[dict] = option["pieces"]

    # Flatten the OPTION's pieces into the legacy flat arrays so the
    # recalc, the PDF and the WO form all see exactly this option.
    # `flatten_pieces` mutates the dict IN PLACE, so pass `scratch`
    # itself (spreading it into a fresh dict would lose the writes).
    scratch: dict = {
        "materials_data": None,
        "fabrication_details": None,
        "additional_works_data": None,
        "pools_data": None,
    }
    scratch["pieces_data"] = json.dumps(pieces, ensure_ascii=False)
    flatten_pieces(scratch)
    materials_raw = json.loads(scratch["materials_data"] or "[]")
    fabrication_details = scratch["fabrication_details"]
    additional_works_list = json.loads(scratch["additional_works_data"] or "[]")
    pools = json.loads(scratch["pools_data"] or "[]")

    conversion_rate = float(usd_rate if usd_rate is not None else get_blue_mid_rate())
    _, materiales_json = _snapshot_materials(materials_raw, 0.0)
    additional_works_list = _snapshot_additional_works(additional_works_list, conversion_rate)
    fabrication_details = _snapshot_fabrication_details(fabrication_details, conversion_rate)
    sketch_list, sketch_json = _serialize_sketch(budget)

    material_name, material_price = _first_main_material(pieces)
    is_legacy = option["id"] == SINGLE_OPTION_ID

    data = {
        "number": generate_work_order_number(repo.get_last_number()),
        "client_id": budget.client_id,
        "delivery_address_id": budget.delivery_address_id,
        "budget_id": budget.id,
        "status": "MEASUREMENT",
        # A legacy budget keeps the historical origin so existing
        # dashboards/reports don't change meaning.
        "origin": "Budget" if is_legacy else f"Opción: {option['name']}",
        "material": material_name or (budget.material or ""),
        "material_price_m2": material_price or float(budget.material_price_m2 or 0),
        "materials_data": materiales_json,
        "additional_works_data": (
            json.dumps(additional_works_list, ensure_ascii=False)
            if additional_works_list else None
        ),
        "pieces_data": json.dumps(pieces, ensure_ascii=False),
        "budgeted_details": json.dumps(sketch_list) if sketch_list else None,
        "sketch_elements": sketch_json,
        "color": budget.color,
        "thickness": budget.thickness,
        "finish": budget.finish,
        "bacha": budget.bacha,
        "anafe": budget.anafe,
        "currency": budget.currency,
        "usd_rate": conversion_rate,
        # Zeroed: `recalculate_totals_from_items` recomputes the OPTION's
        # own subtotal/total/balance before the row is created. Seeding
        # them with the BUDGET's totals would charge the customer for the
        # whole multi-option budget instead of the chosen scenario.
        "subtotal": 0.0,
        "subtotal_usd": 0.0,
        "total": 0.0,
        "total_usd": 0.0,
        "transport": round(float(budget.transport_usd or 0) * conversion_rate, 2)
        if budget.transport_usd
        else budget.transport or 0,
        "transport_usd": budget.transport_usd or 0,
        "installation": budget.installation or 0,
        "discount": budget.discount or 0,
        "discount_percentage": budget.discount_percentage or 0,
        "discount_fixed_amount": budget.discount_fixed_amount or 0,
        # Discount gate inherits verbatim (same rule as create_from_budget).
        "discount_enabled": budget.discount_enabled or False,
        "discount_target": budget.discount_target or "materials",
        # Budgets are pure quotes → the converted order starts unpaid.
        "deposit_received": 0,
        "deposit_currency": "ARS",
        "deposit_usd": 0,
        "balance_due": 0.0,
        "balance_due_usd": 0.0,
        "balance_paid": False,
        "payment_method": budget.payment_method,
        "payment_method_id": getattr(budget, "payment_method_id", None),
        "installments": budget.installments or 1,
        "priority": budget.priority or "NORMAL",
        "delivery_date": budget.delivery_date,
        "notes": budget.notes,
        "fabrication_details": fabrication_details,
        "pool_id": pools[0].get("pool_id") if pools else None,
        "pool_price": float(pools[0].get("price") or 0) if pools else 0.0,
        "pool_currency": (pools[0].get("currency") or "ARS") if pools else "ARS",
        "pool_image": pools[0].get("image") if pools else None,
        "pools_data": (
            json.dumps(pools, ensure_ascii=False) if pools else None
        ),
        # Explicit: the column's ORM default is False, but a leftover True
        # from a previous lifecycle would make the work order claim a
        # deduction that never happened.
        "stock_deducted": False,
        "design_observations": budget.design_observations or "",
        "important_observations": budget.important_observations or "",
        "delivery_terms_override": budget.budget_terms_override or "",
        "warranty_override": budget.warranty_override or "",
        "date": budget.date,
    }
    return data, option, pools


def convert_budget_to_work_order(
    db,
    budget_id: int,
    option_id: Optional[str] = None,
) -> tuple[WorkOrder, dict]:
    """Convert ``budget_id`` into a work order using the winning option.

    Raises ``NotFoundError`` when the budget does not exist and
    ``ValidationError`` when a multi-option budget has no unambiguous
    winner. The stock deduction is scoped to the OPTION's piletas, and the
    budget is flagged ``CONVERTED_TO_OT`` so it cannot be converted twice.
    """
    from app.services.work_order.recalc import recalculate_totals_from_items

    budget = db.get(Budget, budget_id)
    if budget is None:
        raise NotFoundError("Budget")
    if budget.status == "CONVERTED_TO_OT":
        raise ValidationError("El presupuesto ya fue convertido a una Orden de Trabajo")

    repo = WorkOrderRepository(db)
    data, option, pools = build_option_conversion_payload(
        budget,
        repo,
        option_id,
        usd_rate=get_blue_mid_rate(),
    )

    # Server-side recompute of the OPTION's totals (materials + fabrication +
    # additional works + pools of THIS option only) so the WO carries the
    # real price of the winning scenario — not the whole budget's total.
    recalculate_totals_from_items(db, data)

    order = repo.create(data)
    db.commit()
    db.refresh(order)

    # Stock deduction scoped to the OPTION's piletas: a sink quoted only in
    # a losing option is never decremented. `pools` (already flattened) is
    # the source of truth — checking the persisted `pools_data` instead
    # would misfire, because the recalc rewrites an absent column to the
    # empty-array JSON `'[]'`, which is a truthy string.
    if pools:
        deduct_pool_stock(db, order.pool_id, order.pools_data, order.number)
        order.stock_deducted = True
        db.commit()
        db.refresh(order)

    budget.status = "CONVERTED_TO_OT"
    budget.stock_deducted = bool(order.stock_deducted)
    db.commit()
    db.refresh(order)
    return order, option
