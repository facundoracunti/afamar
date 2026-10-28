"""Budget → work-order conversion for a single ALTERNATIVE material.

Extracted verbatim from ``BudgetService.convert_alternative_to_work_order``
(ADR 0009 — modularización) so the budget service keeps only the query +
CRUD surface. The multi-option conversion lives in its own module
(``app/services/budget_option_conversion.py``) and is unrelated.
"""
import json

from app.core.exceptions import ValidationError
from app.models.work_order import WorkOrder
from app.repositories.budget import BudgetRepository
from app.repositories.work_order import WorkOrderRepository
from app.services.budget_calculator import (
    compute_alternative_totals,
    compute_detail_totals,
    compute_pool_totals,
    parse_additional_works_snapshot,
    parse_materials_data,
)
from app.services.stock_helpers import deduct_pool_stock
from app.services.dolar import get_blue_mid_rate
from app.utils.numbering import generate_work_order_number


def create_alternative_work_order(
    budget,
    repo: BudgetRepository,
    idx: int,
    usd_rate: float | None = None,
) -> WorkOrder:
    """Create the work order converted from the alternative material ``idx``.

    Raises ``ValidationError`` when the index is out of range or the row is
    not flagged as an alternative.
    """
    materials = parse_materials_data(budget.materials_data)
    if idx < 0 or idx >= len(materials):
        raise ValidationError(f"Alternative index {idx} out of range")

    alt = materials[idx]
    if not (alt.get("is_alternative") or alt.get("es_alternativa")):
        raise ValidationError("Material at index is not marked as alternative")

    usd_rate_value = float(usd_rate if usd_rate is not None else get_blue_mid_rate())
    mat_cost_ars, mat_cost_usd, alt_currency, _, _ = compute_alternative_totals(
        alt,
        budget,
        usd_rate=usd_rate_value,
    )

    detalles = []
    if budget.fabrication_details:
        try:
            detalles = json.loads(budget.fabrication_details) if isinstance(budget.fabrication_details, str) else budget.fabrication_details
        except (json.JSONDecodeError, TypeError):
            pass
    total_detalles_ars, total_detalles_usd = compute_detail_totals(detalles)

    pools = parse_materials_data(budget.pools_data)
    # The alternative inherits the piece's piletas ("piletas travel with
    # the piece"). The per-variant sink override was removed
    # (2026-10-23): the top-level OPCIONES are the only place where a
    # variant is defined, and each option carries its own piletas.
    total_piletas_ars, total_piletas_usd = compute_pool_totals(pools)
    budget_additional = parse_additional_works_snapshot(budget.additional_works_data)
    additional_for_wo = list(budget_additional)

    traslado = float(budget.transport or 0)

    if alt_currency == "USD":
        subtotal_ars = total_detalles_ars + total_piletas_ars
        subtotal_usd = mat_cost_usd + total_detalles_usd + total_piletas_usd
    else:
        subtotal_ars = mat_cost_ars + total_detalles_ars + total_piletas_ars
        subtotal_usd = total_detalles_usd + total_piletas_usd

    total_ars = round(subtotal_ars + round(subtotal_usd * usd_rate_value, 2) + traslado)
    total_usd_val = round(subtotal_usd + round(subtotal_ars / usd_rate_value, 2) + round(traslado / usd_rate_value, 2), 2) if usd_rate_value > 0 else 0

    common = [m for m in materials if not (m.get("is_alternative") or m.get("es_alternativa"))]
    budgeted_details_list = [alt] + common

    last_number = repo.db.query(WorkOrder).order_by(WorkOrder.id.desc()).first()
    number = generate_work_order_number(last_number.number if last_number else None)

    alt_nombre = alt.get("nombre") or alt.get("name") or alt.get("description") or ""
    alt_precio_m2 = alt.get("price_m2") or alt.get("precio_m2", 0) or 0
    alt_color = alt.get("color") or ""
    alt_espesor = alt.get("espesor") or alt.get("thickness") or ""

    data = {
        "number": number,
        "client_id": budget.client_id,
        "delivery_address_id": budget.delivery_address_id,
        "budget_id": budget.id,
        "status": "MEASUREMENT",
        "origin": "Desde alternativa",
        "material": alt_nombre,
        "material_price_m2": alt_precio_m2,
        "materials_data": json.dumps(materials),
        # Cutout/traforo of the alternative's own sink joins the document
        # additional works so the recalc and the PDF price it with the rest.
        "additional_works_data": (
            json.dumps(additional_for_wo, ensure_ascii=False)
            if additional_for_wo
            else None
        ),
        "pools_data": json.dumps(pools, ensure_ascii=False) if pools else None,
        "pieces_data": budget.pieces_data,
        "color": alt_color or budget.color,
        "thickness": alt_espesor or budget.thickness,
        "finish": alt.get("finish") or budget.finish,
        "bacha": budget.bacha,
        "anafe": budget.anafe,
        "currency": alt_currency,
        "usd_rate": usd_rate_value,
        "subtotal": round(subtotal_ars),
        "transport": traslado,
        "installation": budget.installation or 0,
        "discount": budget.discount or 0,
        "discount_percentage": budget.discount_percentage or 0,
        "discount_fixed_amount": budget.discount_fixed_amount or 0,
        # Carry the commercial-discount gate over verbatim (see
        # `create_from_budget`). `or "materials"` only fires if the budget
        # row somehow lacks the target — the column is NOT NULL, default
        # 'total', since the j0k1l2m3n4o5 migration.
        "discount_enabled": budget.discount_enabled or False,
        "discount_target": budget.discount_target or "materials",
        "total": total_ars,
        "subtotal_usd": round(subtotal_usd, 2),
        "transport_usd": round(traslado / usd_rate_value, 2) if usd_rate_value > 0 else 0,
        "total_usd": total_usd_val,
        # Budgets are pure quote documents — no seña is carried over. The
        # converted order starts fully unpaid (`balance_due` mirrors the
        # alternate-total) and the cash box is touched only when the
        # operator registers the seña in MEDICIÓN.
        "deposit_received": 0,
        "deposit_currency": "ARS",
        "deposit_usd": 0,
        "balance_due": total_ars,
        "balance_due_usd": total_usd_val,
        "balance_paid": False,
        "payment_method": budget.payment_method,
        "installments": budget.installments or 1,
        "priority": budget.priority or "NORMAL",
        "delivery_date": budget.delivery_date,
        "notes": budget.notes,
        "fabrication_details": budget.fabrication_details,
        "budgeted_details": json.dumps(budgeted_details_list),
        # Carry the croquis over too — same logic as `create_from_budget`
        # in work_order.py. The source is the `BudgetSketchElement` rows
        # on the budget; we serialise them into the new
        # `WorkOrder.sketch_elements` TEXT column so the WO form + PDF
        # show the same drawing the customer signed on the budget.
        "sketch_elements": (
            json.dumps(
                [
                    {"type": el.type, "data": el.data, "order": el.order}
                    for el in budget.sketch_elements
                ],
                ensure_ascii=False,
            )
            if budget.sketch_elements
            else None
        ),
        "design_observations": budget.design_observations or "",
        "important_observations": budget.important_observations or "",
        # Per-document term overrides carry over so the order PDF shows the
        # same payment / garantía terms the customer signed on the budget
        # (empty string = fall back to the global /admin/configuration).
        "delivery_terms_override": budget.budget_terms_override or "",
        "warranty_override": budget.warranty_override or "",
        "date": budget.date,
    }

    wo_repo = WorkOrderRepository(repo.db)
    work_order = wo_repo.create(data)
    repo.db.commit()
    repo.db.refresh(work_order)
    # Deduct the pileta the OT actually carries — the piece's own
    # piletas (the per-variant sink override was removed on
    # 2026-10-23), so the stock movement references the model the
    # customer chose.
    deduct_pool_stock(
        repo.db,
        budget.pool_id,
        json.dumps(pools, ensure_ascii=False) if pools else None,
        work_order.number,
    )
    work_order.stock_deducted = True
    repo.db.commit()
    repo.db.refresh(work_order)
    return work_order
