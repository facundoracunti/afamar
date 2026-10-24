"""Discount rules for the server-side totals recalc.

Two independent discount layers live here:

  * the MANUAL discount the operator types in the form (gated by
    ``discount_enabled``), and
  * the CATALOGUE-driven discount / surcharge that comes from the
    ``payment_methods`` table.

Both are extracted verbatim from the former monolithic ``recalc.py``.
"""


def apply_manual_discount(
    total_base_ars: float,
    total_base_usd: float,
    discount_enabled: bool,
    discount_pct: float,
    discount_fijo: float,
    usd_rate: float,
) -> tuple[float, float]:
    """Apply the operator's manual discount to the base totals.

    Matches the frontend hook's logic. The gate (`discount_enabled`)
    decides whether the configured % / fixed amount actually applies —
    matches the frontend `useBudgetCalculations` semantics. Without the
    gate the user could not turn the discount off without zeroing the
    percentages.
    """
    if discount_enabled and discount_pct > 0:
        total_ars = round(total_base_ars * (1 - discount_pct / 100))
        total_usd = round(total_base_usd * (1 - discount_pct / 100) * 100) / 100
    elif discount_enabled and discount_fijo > 0:
        total_ars = max(0.0, total_base_ars - discount_fijo)
        total_usd = max(0.0, round((total_base_usd - discount_fijo / usd_rate) * 100) / 100)
    else:
        total_ars = total_base_ars
        total_usd = total_base_usd
    return total_ars, total_usd


def resolve_payment_method(db, data: dict):
    """Resolve the catalogue ``PaymentMethod`` row for the payload.

    Looks the row up by the ``payment_method_id`` FK first, then falls
    back to the legacy ``payment_method`` name. Returns ``None`` when
    neither resolves.
    """
    from app.models.reference import PaymentMethod  # local import: avoid cycle on cold start

    payment_method_id = data.get("payment_method_id")
    payment_method_name = data.get("payment_method")
    pm: PaymentMethod | None = None
    if payment_method_id:
        pm = db.query(PaymentMethod).filter(PaymentMethod.id == payment_method_id).first()
    if pm is None and payment_method_name:
        pm = db.query(PaymentMethod).filter(PaymentMethod.name == payment_method_name).first()
    return pm


def apply_catalogue_adjustment(
    total_ars: float,
    total_usd: float,
    pm,
    installments: int,
    usd_rate: float,
    apply_discount: bool,
) -> tuple[float, float]:
    """Apply the catalogue payment-method discount / surcharge (if any).

    The frontend recomputes the same thing in `useBudgetCalculations` /
    `buildPdfData` so the live form, the PDF and the persisted row all
    agree. The DB lookup here is the safety net for code paths that
    bypass the form hook (e.g. a budget → WO conversion where the
    `payment_method_id` FK carries the configuration forward).

    Credit-card rule: *recargo lineal por cuota*. El interés
    `value%` se aplica N veces al total, después se divide en N
    cuotas iguales. Total = `base × (1 + N × value/100)`.

    DISCOUNT is opt-in via the per-order `apply_cash_discount` flag so
    the operator decides client-by-client whether the promotional
    discount applies. SURCHARGE (e.g. credit-card recargo) and the
    credit-card installment multiplier always apply when selected.
    """
    if (
        pm is not None
        and pm.type == "DISCOUNT"
        and pm.value
        and apply_discount
    ):
        value = float(pm.value)
        # Percentage discount: `value%` of the total, possibly scaled by
        # the installment count when `applies_to_installments=True`.
        # Fixed-amount discount: subtract the raw value as ARS. These
        # two branches don't share the `ratio != 1` gate — the fixed
        # amount is applied whenever the flag is on, regardless of how
        # the percentage formula would evaluate.
        if pm.is_percentage:
            ratio = 1.0
            if pm.applies_to_installments:
                n = max(1, installments)
                ratio = 1 - n * (value / 100)
            else:
                ratio = 1 - value / 100
            total_ars = max(0.0, round(total_ars * ratio))
            total_usd = max(0.0, round((total_usd * ratio) * 100) / 100)
        else:
            # Fixed-amount DISCOUNT: `value` is treated as ARS. Convert
            # the USD side via `usd_rate` so the two currencies stay in
            # sync. When the operator configured EFECTIVO with
            # `is_percentage=false` this branch is the one that fires.
            total_ars = max(0.0, total_ars - value)
            total_usd = (
                max(0.0, round((total_usd - value / usd_rate) * 100) / 100)
                if usd_rate > 0
                else total_usd
            )
    elif pm is not None and pm.type == "SURCHARGE" and pm.value:
        value = float(pm.value)
        ratio = 1.0
        if pm.applies_to_installments:
            n = max(1, installments)
            ratio = 1 + n * (value / 100)
        elif pm.is_percentage:
            ratio = 1 + value / 100
        if not pm.is_percentage and not pm.applies_to_installments:
            # Fixed-amount surcharge: `value` is treated as ARS. Convert
            # the USD side via `usd_rate`. Same "no ratio gate" rule as
            # the DISCOUNT fixed branch above — a fixed amount leaves
            # `ratio` at 1 and must still apply.
            total_ars = round(total_ars + value)
            total_usd = (
                round((total_usd + value / usd_rate) * 100) / 100
                if usd_rate > 0
                else total_usd
            )
        elif ratio != 1:
            if pm.is_percentage:
                total_ars = round(total_ars * ratio)
                total_usd = round((total_usd * ratio) * 100) / 100
            else:
                total_ars = total_ars + value
                total_usd = total_usd + (value / usd_rate if usd_rate > 0 else 0)
    return total_ars, total_usd
