"""Build the WO payload from a Budget source.

Extracted from ``WorkOrderService.create_from_budget`` to keep the service
orchestrator thin. ``build_conversion_payload`` returns the dict-shaped
data ready for ``WorkOrderRepository.create``; it also performs the
budget-side snapshot baking (materials / fabrication / additional /
pieces) and the snapshot baking inside the pieces tree.

Reusable by both ``WorkOrderService.create_from_budget`` (full-budget
conversion) and ``BudgetService.convert_alternative_to_work_order`` (per-
alternative conversion), so the discount-gate inheritance + zeroed-
deposit + terms-override rules live in a single place.
"""
import json
from typing import TYPE_CHECKING

from app.core.settings import settings
from app.services.work_order.snapshots import bake_snapshot_into_pieces

if TYPE_CHECKING:
    from app.models.budget import Budget
    from app.repositories.work_order import WorkOrderRepository


def _snapshot_materials(materials_raw: list, wo_usd_rate: float) -> tuple[list, str | None]:
    """Snapshot ``m2_budgeted`` per material row.

    Lengths in the DB are stored in METERS (see the form's "Largo (mts)"
    label + ``length * width * quantity`` m² formula), so the snapshot is
    just that product.
    """
    out: list = []
    for mat in materials_raw:
        if not isinstance(mat, dict):
            out.append(mat)
            continue
        length_m = float(mat.get("length") or mat.get("largo") or 0)
        width_m = float(mat.get("width") or mat.get("ancho") or 0)
        quantity = float(mat.get("quantity") or mat.get("cantidad") or 1)
        m2_snapshot = length_m * width_m * quantity
        out.append({**mat, "m2_budgeted": m2_snapshot})
    return out, (json.dumps(out) if out else None)


def _snapshot_additional_works(additional_works_list: list, wo_usd_rate: float) -> list:
    """Snapshot ``total_*_budgeted`` + ``linear_meters_budgeted`` (frentes) per additional row."""
    out: list = []
    for aw in additional_works_list:
        if not isinstance(aw, dict):
            out.append(aw)
            continue
        aw_currency = "USD" if str(aw.get("currency") or "").upper() == "USD" else "ARS"
        aw_total = float(
            aw.get("total")
            or (aw.get("price") or aw.get("unit_price") or 0)
            * (aw.get("quantity") or 1)
        )
        aw_ars = aw_total if aw_currency == "ARS" else (aw_total * wo_usd_rate if wo_usd_rate > 0 else 0)
        aw_usd = aw_total if aw_currency == "USD" else (aw_total / wo_usd_rate if wo_usd_rate > 0 else 0)
        aw_snapshot = {"total_ars_budgeted": aw_ars, "total_usd_budgeted": aw_usd}
        # Frentes are measured in ml — snapshot the budgeted linear meters
        # so the COMPARATIVA DE MEDICIÓN can show "Presupuestado vs Real"
        # on the frente detail row (flat works have no measure).
        if str(aw.get("type") or "").lower() == "frente" and "linear_meters" in aw:
            aw_snapshot["linear_meters_budgeted"] = float(aw.get("linear_meters") or 0)
        out.append({**aw, **aw_snapshot})
    return out


def _serialize_sketch(budget) -> tuple[list, str | None]:
    """Convert the Budget's ``BudgetSketchElement`` rows into the wire shape
    used by the WO form."""
    sketch_list = []
    if budget.sketch_elements:
        sketch_list = [
            {"type": el.type, "data": el.data, "order": el.order}
            for el in budget.sketch_elements
        ]
    sketch_json = json.dumps(sketch_list, ensure_ascii=False) if sketch_list else None
    return sketch_list, sketch_json


def _snapshot_fabrication_details(fabrication_details, wo_usd_rate: float):
    """Snapshot dimensional + monetary snapshot keys onto each fabrication row.

    Mirrors the material ``m2_budgeted`` snapshot: without this baking the
    original quoted value is lost the moment the operator edits
    ``length`` / ``width`` / ``quantity`` during MEASUREMENT.
    """
    if not fabrication_details:
        return fabrication_details
    try:
        fab_parsed = (
            json.loads(fabrication_details)
            if isinstance(fabrication_details, str)
            else fabrication_details
        )
    except (ValueError, TypeError):
        return fabrication_details
    if not isinstance(fab_parsed, list):
        return fabrication_details

    from app.services.work_order.helpers import FAB_LINEAR_CONCEPTS, FAB_M2_CONCEPTS

    out: list = []
    for fd in fab_parsed:
        if not isinstance(fd, dict):
            out.append(fd)
            continue
        fd_currency = "USD" if str(fd.get("currency") or "").upper() == "USD" else "ARS"
        fd_total = float((fd.get("price") or 0) * (fd.get("quantity") or 1))
        fd_ars = fd_total if fd_currency == "ARS" else (fd_total * wo_usd_rate if wo_usd_rate > 0 else 0)
        fd_usd = fd_total if fd_currency == "USD" else (fd_total / wo_usd_rate if wo_usd_rate > 0 else 0)
        fd_length = float(fd.get("length") or fd.get("largo") or 0)
        fd_width = float(fd.get("width") or fd.get("ancho") or 0)
        fd_qty = float(fd.get("quantity") or fd.get("cantidad") or 1)
        fd_concept = str(fd.get("concept") or fd.get("concepto") or "").strip().upper()
        fd_snapshot = {"total_ars_budgeted": fd_ars, "total_usd_budgeted": fd_usd}
        if fd_concept in FAB_M2_CONCEPTS:
            fd_snapshot["m2_budgeted"] = fd_length * fd_width * fd_qty
        elif fd_concept in FAB_LINEAR_CONCEPTS:
            fd_snapshot["linear_meters_budgeted"] = fd_length * fd_qty
        out.append({**fd, **fd_snapshot})
    return json.dumps(out, ensure_ascii=False)


def _resolve_additional_works(budget) -> list:
    """Prefer the JSON snapshot, fall back to the legacy ``BudgetAdicional`` 1-N rows."""
    out: list = []
    if budget.additional_works_data:
        try:
            parsed = json.loads(budget.additional_works_data)
            if isinstance(parsed, list):
                out = parsed
        except (ValueError, TypeError):
            out = []
    if not out and budget.additional_works:
        out = [
            {
                "concept": ad.concept,
                "detail": ad.detail,
                "quantity": ad.quantity,
                "unit_price": ad.unit_price,
                "total": ad.total,
            }
            for ad in budget.additional_works
        ]
    return out


def build_conversion_payload(budget, repo: "WorkOrderRepository") -> dict:
    """Assemble the ``data`` dict ready for ``WorkOrderRepository.create``.

    This is the single source of truth for the budget → WO conversion: the
    discount-gate inheritance, the zeroed-deposit rule (budgets are pure
    quote documents), the term overrides, the sketch + fabrication
    snapshots and the pieces-tree bake all happen here.
    """
    from app.services.budget_calculator import filter_main_materials, parse_materials_data
    from app.utils.numbering import generate_work_order_number

    # The budget already carries the canonical totals (subtotal, total,
    # balance_due, etc.) computed and submitted by the frontend when the
    # user approved it. Recomputing from materials_data here would lose
    # any fabrication_details / surcharge logic the frontend baked in,
    # so we trust the budget's numbers and only derive a few display
    # fields from materials_data (material name + price_m2 fallback).
    materials_raw = parse_materials_data(budget.materials_data)
    main_materials = filter_main_materials(materials_raw)

    if main_materials:
        material_nombre = main_materials[0].get("nombre") or main_materials[0].get("name") or budget.material or ""
        material_precio_m2 = main_materials[0].get("price_m2") or main_materials[0].get("precio_m2", 0) or 0
    else:
        material_nombre = budget.material or ""
        material_precio_m2 = budget.material_price_m2 or 0

    # `budget.total` / `budget.total_usd` already include the surcharge
    # that was applied budget-side (the budget's `total` is what the
    # customer signed). We mirror those figures 1:1 into the WO so the
    # conversion doesn't change what the customer owes. No need to
    # re-apply surcharge here — the budget is the source of truth.
    budget_total_ars = float(budget.total or 0)
    budget_total_usd = float(budget.total_usd or 0)

    last_number = repo.get_last_number()

    materials_with_snapshot, materiales_json = _snapshot_materials(materials_raw, 0.0)

    additional_works_list = _resolve_additional_works(budget)
    wo_usd_rate = float(budget.usd_rate or settings.DEFAULT_USD_RATE)
    additional_works_list = _snapshot_additional_works(additional_works_list, wo_usd_rate)

    sketch_list, sketch_json = _serialize_sketch(budget)
    fabrication_details = _snapshot_fabrication_details(budget.fabrication_details, wo_usd_rate)

    return {
        "number": generate_work_order_number(last_number),
        "client_id": budget.client_id,
        "delivery_address_id": budget.delivery_address_id,
        "budget_id": budget.id,
        "status": "MEASUREMENT",
        "origin": "Budget",
        "material": material_nombre,
        "material_price_m2": material_precio_m2,
        "materials_data": materiales_json,
        "additional_works_data": json.dumps(additional_works_list) if additional_works_list else None,
        # Bake the budgeted-measurement snapshots INTO the pieces too
        # (not just the flat arrays above): the frontend is
        # pieces-first and re-derives the flat arrays from the pieces
        # on every edit, so without this the COMPARATIVA DE MEDICIÓN's
        # "Presupuestado" column would die at the first measurement
        # change (see `bake_snapshot_into_pieces`).
        "pieces_data": bake_snapshot_into_pieces(budget.pieces_data, wo_usd_rate),
        "budgeted_details": json.dumps(sketch_list) if sketch_list else None,
        "sketch_elements": sketch_json,
        "color": budget.color,
        "thickness": budget.thickness,
        "finish": budget.finish,
        "bacha": budget.bacha,
        "anafe": budget.anafe,
        # Workshop sheet fields (OT-only; budgets have no columns yet, so
        # getattr carries over the value if/when they land on Budget).
        "workshop_corte": getattr(budget, "workshop_corte", None) or "",
        "workshop_faja": getattr(budget, "workshop_faja", None) or "",
        "workshop_perf": getattr(budget, "workshop_perf", None) or "",
        "workshop_tras_peg": getattr(budget, "workshop_tras_peg", None) or "",
        "workshop_term": getattr(budget, "workshop_term", None) or "",
        "workshop_sopapas": getattr(budget, "workshop_sopapas", None) or "",
        "currency": budget.currency,
        "usd_rate": budget.usd_rate or settings.DEFAULT_USD_RATE,
        "subtotal": float(budget.subtotal or 0),
        "transport": budget.transport or 0,
        "installation": budget.installation or 0,
        "discount": budget.discount or 0,
        "discount_percentage": budget.discount_percentage or 0,
        "discount_fixed_amount": budget.discount_fixed_amount or 0,
        # Carry the commercial-discount gate over verbatim so the quoted
        # discount keeps applying on the order. The target falls back to
        # the WorkOrder native default ('materials') only if the budget
        # row somehow lacks a value (the column is NOT NULL since the
        # j0k1l2m3n4o5 migration, default 'total').
        "discount_enabled": budget.discount_enabled or False,
        "discount_target": budget.discount_target or "materials",
        "total": budget_total_ars,
        "subtotal_usd": float(budget.subtotal_usd or 0),
        "transport_usd": budget.transport_usd or 0,
        "total_usd": budget_total_usd,
        # Budgets are pure quote documents — the seña is collected at the
        # WORK ORDER (in MEDICIÓN), never at budget time. The converted
        # order starts fully unpaid: no deposit carried over, `balance_due`
        # mirrors the quoted total (already includes discount + surcharge),
        # and no cash movement is booked (see the `deposit_native_amount`
        # guard below). The operator charges the seña when taking the real
        # measurements.
        "deposit_received": 0,
        "deposit_currency": "ARS",
        "deposit_usd": 0,
        "balance_due": budget_total_ars,
        "balance_due_usd": budget_total_usd,
        "balance_paid": False,
        "payment_method": budget.payment_method,
        "installments": budget.installments or 1,
        "priority": budget.priority or "NORMAL",
        "delivery_date": budget.delivery_date,
        "notes": budget.notes,
        "fabrication_details": fabrication_details,
        "pool_id": budget.pool_id,
        "pool_price": budget.pool_price or 0,
        "pool_currency": budget.pool_currency or "ARS",
        "pool_image": budget.pool_image,
        "pools_data": budget.pools_data,
        "design_observations": budget.design_observations or "",
        "important_observations": budget.important_observations or "",
        # Per-document term overrides carry over so the order PDF shows the
        # same payment / garantía terms the customer signed on the budget
        # (empty string = fall back to the global /admin/configuration).
        "delivery_terms_override": budget.budget_terms_override or "",
        "warranty_override": budget.warranty_override or "",
        "date": budget.date,
    }
