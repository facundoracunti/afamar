"""Server-side totals recompute for work orders.

The frontend's ``useBudgetCalculations`` hook computes these totals on the
client, but a few code paths reach ``WorkOrderService.create`` without that
hook ever running (legacy imports, third-party posts, or stale state).
Recomputing server-side guarantees the DB always holds a value consistent
with the items actually stored, and the PDF / list never show $0 for a row
that has fabrications + materials + pools populated.

NOTE: unlike ``budget_calculator.calculate_material_totals``, this helper
does NOT divide length × width by 10000 — the form's input units are
already in meters, so we keep that semantic. ``create_from_budget`` still
uses the original helper (different units, see its comment).

This module is the ORCHESTRATOR (ADR 0009 — modularización). The heavy
lifting lives in focused sibling modules:

  * ``recalc_links.py``       — alternative-material link predicates.
  * ``recalc_totals.py``      — per-family line-item aggregation.
  * ``recalc_discounts.py``   — manual discount + catalogue adjustment.
  * ``recalc_alternatives.py``— alternative-material price override.
  * ``recalc_installments.py``— per-cuota breakdown table.
"""
import json

from sqlalchemy.orm import Session

from app.core.settings import settings
from app.services.work_order.recalc_alternatives import apply_alternative_override
from app.services.work_order.recalc_discounts import (
    apply_catalogue_adjustment,
    apply_manual_discount,
    resolve_payment_method,
)
from app.services.work_order.recalc_installments import _build_installment_detail
from app.services.work_order.recalc_links import _collect_alt_material_names, _is_alt_linked
from app.services.work_order.recalc_totals import compute_line_totals

__all__ = [
    "recalculate_totals_from_items",
    "_build_installment_detail",
    "_collect_alt_material_names",
    "_is_alt_linked",
]


def recalculate_totals_from_items(db: Session, data: dict) -> None:
    """Recompute subtotal/total/etc. from the raw line-item arrays.

    Mutates ``data`` in place. Mirrors the frontend hook's math
    (length × width × quantity × price_m2) but in METERS, not cm².

    Also derives ``installment_detail_ars`` / ``installment_detail_usd``
    for the credit-card 3-column table when the catalogue method is a
    percentage SURCHARGE with ``applies_to_installments=True``. These
    rows are JSON-encoded back into the dict so the persist path (TEXT
    column) just writes them.
    """
    from app.services.budget_calculator import flatten_pieces

    # Multi-piece flow: fill any MISSING flat arrays from `pieces_data` first
    # so every read below (and the persisted row) sees the piece-derived
    # items. `only_if_missing=True` is deliberate: a work order's flat arrays
    # are editable in MEDICIÓN, so an explicit `materials_data` must win over
    # the (frozen) budget pieces snapshot; pieces only fill the gap for an
    # API-only payload that carries `pieces_data` alone.
    flatten_pieces(data, only_if_missing=True)

    usd_rate = float(data.get("usd_rate") or settings.DEFAULT_USD_RATE)
    if usd_rate <= 0:
        usd_rate = settings.DEFAULT_USD_RATE
    dd = usd_rate

    # Fabrication + materials + pools + additional works, aggregated per
    # currency family and cross-converted into the subtotal.
    lines = compute_line_totals(data, dd)

    transport = float(data.get("transport") or 0)
    transport_usd = float(data.get("transport_usd") or 0)

    total_base_ars = max(0.0, lines.subtotal_ars + transport)
    total_base_usd = max(0.0, lines.subtotal_usd + transport_usd)

    # Discount + surcharge (matches the frontend hook's logic). The
    # gate (`discount_enabled`) decides whether the configured %
    # / fixed amount actually applies — matches the frontend
    # `useBudgetCalculations` semantics. Without the gate the user
    # could not turn the discount off without zeroing the percentages.
    discount_enabled = bool(data.get("discount_enabled"))
    discount_pct = float(data.get("discount_percentage") or 0)
    discount_fijo = float(data.get("discount_fixed_amount") or 0)
    total_ars, total_usd = apply_manual_discount(
        total_base_ars,
        total_base_usd,
        discount_enabled,
        discount_pct,
        discount_fijo,
        usd_rate,
    )

    # Apply the catalogue payment-method discount / surcharge (if any).
    # The frontend recomputes the same thing in `useBudgetCalculations` /
    # `buildPdfData` so the live form, the PDF and the persisted row all
    # agree. The DB lookup here is the safety net for code paths that
    # bypass the form hook (e.g. a budget → WO conversion where the
    # `payment_method_id` FK carries the configuration forward).
    pm = resolve_payment_method(db, data)
    installments = int(data.get("installments") or 1)
    # DISCOUNT is opt-in via the per-order `apply_cash_discount` flag so
    # the operator decides client-by-client whether the promotional
    # discount applies. SURCHARGE (e.g. credit-card recargo) and the
    # credit-card installment multiplier always apply when selected.
    apply_discount = bool(data.get("apply_cash_discount"))
    total_ars, total_usd = apply_catalogue_adjustment(
        total_ars,
        total_usd,
        pm,
        installments,
        usd_rate,
        apply_discount,
    )

    # Alternative-material override (matches the hook's `hasAlternative`
    # branch).
    total_ars, total_usd = apply_alternative_override(
        total_ars,
        total_usd,
        data,
        lines,
        pm,
        installments,
        discount_pct,
        discount_fijo,
        transport,
        dd,
    )

    # Per-cuota breakdown (only meaningful for credit-card surcharges
    # with `applies_to_installments=True`). Returns a list of N rows
    # shaped `{"cuota": 1, "interes": 9, "monto": X}` so the PDF /
    # form can render a 3-column table. Same shape on the frontend
    # (`useBudgetCalculations` + `buildPdfData`).
    #
    # Interés incremental: cuota `n` carries `n × value%` and
    # `monto = base/N × (1 + n × value/100)`. For the USD side the
    # `monto` is computed from `total_usd / N` so the two columns line
    # up at the displayed scale.
    installment_detail_ars, installment_detail_usd = _build_installment_detail(
        pm, installments, total_ars, total_usd,
    )

    data["installment_detail_ars"] = installment_detail_ars
    data["installment_detail_usd"] = installment_detail_usd
    # JSON-encoded snapshot for persistence (the column is TEXT, not
    # JSON, so the list needs to be serialised before it lands in the
    # row). The list-page PDF preview reuses this snapshot so the
    # per-cuota table renders even when the form hook isn't running.
    data["installment_detail_ars"] = (
        json.dumps(installment_detail_ars, ensure_ascii=False) if installment_detail_ars else None
    )
    data["installment_detail_usd"] = (
        json.dumps(installment_detail_usd, ensure_ascii=False) if installment_detail_usd else None
    )
    # Keep the legacy `payment_method` string in sync with the FK so
    # downstream consumers (PDFs, list endpoint, exports) that still
    # read the legacy column show the catalogue label, not a stale
    # name from a previous selection. `pm` was resolved earlier from
    # either `payment_method_id` or `payment_method`.
    if pm is not None and (pm.name != data.get("payment_method") or not data.get("payment_method")):
        data["payment_method"] = pm.name

    # Deposit + balance due. The form keeps `deposit_received` (ARS) and
    # `deposit_usd` (USD) as parallel columns and toggles which one carries
    # the native value via `deposit_currency`. The `balance_due` math must
    # subtract the deposit in its NATIVE currency, converted to the
    # display currency — not just the ARS field, which is zero when the
    # seña was paid in USD (causing the saldo to stay frozen at total).
    deposit = float(data.get("deposit_received") or 0)
    deposit_usd = float(data.get("deposit_usd") or 0)
    deposit_currency = (data.get("deposit_currency") or "ARS").upper()
    if deposit_currency == "USD":
        # Native = USD. ARS equivalent is what we subtract from total_ars.
        deposit_ars = deposit_usd * usd_rate if usd_rate > 0 else 0
    else:
        deposit_ars = deposit
        # Derive USD when the operator typed the seña in ARS but the row
        # was saved without the USD field (so balance_due_usd can also
        # reflect the deposit).
        if deposit_usd == 0 and deposit > 0 and usd_rate > 0:
            deposit_usd = round((deposit / usd_rate) * 100) / 100

    balance_due = max(0.0, total_ars - deposit_ars)
    balance_due_usd = max(0.0, round((total_usd - deposit_usd) * 100) / 100)

    # Persist everything so the PDF / list endpoint never see $0 again.
    data["subtotal"] = lines.subtotal_ars
    data["subtotal_usd"] = lines.subtotal_usd
    data["total"] = total_ars
    data["total_usd"] = total_usd
    data["balance_due"] = balance_due
    data["balance_due_usd"] = balance_due_usd
    if deposit > 0:
        data["deposit_received"] = deposit
    if deposit_usd > 0:
        data["deposit_usd"] = deposit_usd
