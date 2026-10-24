"""Alternative-material override for the server-side totals recalc.

Extracted verbatim from the former monolithic ``recalc.py``.
"""


def apply_alternative_override(
    total_ars: float,
    total_usd: float,
    data: dict,
    lines,
    pm,
    installments: int,
    discount_pct: float,
    discount_fijo: float,
    transport: float,
    dd: float,
) -> tuple[float, float]:
    """Re-price the order with the FIRST alternative material (if any).

    Matches the hook's `hasAlternative` branch. When the form has at
    least one `is_alternative=true` material, the form's main
    "PRESUPUESTO" card displays the first alternative's total instead of
    the main material's — and the persisted row must match that. Without
    this branch, the server-side recalc would always use the main material
    and the WO would disagree with the live form by the delta between the
    main and the alternative.
    """
    from app.services.budget_calculator import parse_materials_data

    mats_all = parse_materials_data(data.get("materials_data"))
    primera_alt = next((m for m in mats_all if m.get("is_alternative")), None)
    if primera_alt is None:
        return total_ars, total_usd

    dd2 = dd or 1
    m2_alt = (
        float(primera_alt.get("length") or primera_alt.get("largo") or 0)
        * float(primera_alt.get("width") or primera_alt.get("ancho") or 0)
        * float(primera_alt.get("quantity") or primera_alt.get("cantidad") or 1)
    )
    alt_currency = (primera_alt.get("currency") or primera_alt.get("moneda") or "ARS").upper()
    if alt_currency == "USD":
        alt_price = float(primera_alt.get("price_m2_usd") or primera_alt.get("precio_m2_usd", 0) or 0)
    else:
        alt_price = float(primera_alt.get("price_m2") or primera_alt.get("precio_m2", 0) or 0)
    if alt_currency == "USD":
        alt_costo_ars = m2_alt * alt_price * dd2
        alt_costo_usd = m2_alt * alt_price
    else:
        alt_costo_ars = m2_alt * alt_price
        alt_costo_usd = m2_alt * alt_price / dd2 if dd2 > 0 else 0

    # Fixed items (fab + pools + additional) in their respective
    # currencies, then convert to the alternative's currency.
    alt_fijos_ars = (
        lines.fab_ars
        + (lines.fab_usd * dd2 if dd2 > 0 else 0)
        + lines.pp_ars
        + (lines.pp_usd * dd2 if dd2 > 0 else 0)
        + lines.add_ars
        + (lines.add_usd * dd2 if dd2 > 0 else 0)
        + transport
    )
    alt_total_ars = max(0.0, round(alt_costo_ars + alt_fijos_ars))
    # Apply manual discount
    if discount_pct > 0:
        alt_total_ars = max(0.0, round(alt_total_ars * (1 - discount_pct / 100)))
    elif discount_fijo > 0:
        alt_total_ars = max(0.0, alt_total_ars - discount_fijo)
    # Apply catalogue method (surcharge / discount)
    if pm is not None and pm.type in ("DISCOUNT", "SURCHARGE") and pm.value:
        value = float(pm.value)
        ratio = 1.0
        if pm.applies_to_installments:
            n = max(1, installments)
            ratio = 1 + n * (value / 100)
        elif pm.is_percentage:
            ratio = 1 - value / 100 if pm.type == "DISCOUNT" else 1 + value / 100
        if ratio != 1:
            if pm.type == "DISCOUNT":
                if pm.is_percentage:
                    alt_total_ars = max(0.0, round(alt_total_ars * ratio))
                else:
                    alt_total_ars = max(0.0, alt_total_ars - value)
            else:  # SURCHARGE
                if pm.is_percentage:
                    alt_total_ars = max(0.0, round(alt_total_ars * ratio))
                else:
                    alt_total_ars = alt_total_ars + value
    total_ars = alt_total_ars

    alt_fijos_usd = (
        lines.fab_usd
        + (lines.fab_ars / dd2 if dd2 > 0 else 0)
        + lines.pp_usd
        + (lines.pp_ars / dd2 if dd2 > 0 else 0)
        + lines.add_usd
        + (lines.add_ars / dd2 if dd2 > 0 else 0)
        + (transport / dd2 if dd2 > 0 else 0)
    )
    alt_total_usd = max(0.0, round(alt_costo_usd + alt_fijos_usd, 2))
    if discount_pct > 0:
        alt_total_usd = max(0.0, round(alt_total_usd * (1 - discount_pct / 100), 2))
    elif discount_fijo > 0 and dd2 > 0:
        alt_total_usd = max(0.0, alt_total_usd - discount_fijo / dd2)
    if pm is not None and pm.type in ("DISCOUNT", "SURCHARGE") and pm.value:
        value = float(pm.value)
        ratio = 1.0
        if pm.applies_to_installments:
            n = max(1, installments)
            ratio = 1 + n * (value / 100)
        elif pm.is_percentage:
            ratio = 1 - value / 100 if pm.type == "DISCOUNT" else 1 + value / 100
        if ratio != 1:
            if pm.type == "DISCOUNT":
                if pm.is_percentage:
                    alt_total_usd = max(0.0, round(alt_total_usd * ratio, 2))
                else:
                    alt_total_usd = max(0.0, alt_total_usd - (value / dd2 if dd2 > 0 else 0))
            else:  # SURCHARGE
                if pm.is_percentage:
                    alt_total_usd = max(0.0, round(alt_total_usd * ratio, 2))
                else:
                    alt_total_usd = alt_total_usd + (value / dd2 if dd2 > 0 else 0)
    total_usd = alt_total_usd
    return total_ars, total_usd
