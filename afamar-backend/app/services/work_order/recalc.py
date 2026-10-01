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
"""
import json
from sqlalchemy.orm import Session

from app.core.settings import settings


def _collect_alt_material_names(materials_data) -> set[str]:
    """Return the set of material names flagged ``is_alternative=true``.

    Used by ``_is_alt_linked`` to skip pools / fabrication / additional
    rows assigned to an alternative material when computing the main
    Presupuesto subtotal (matches the frontend hook's ``isAltLinked``
    predicate).
    """
    names: set[str] = set()
    if not materials_data:
        return names
    try:
        parsed = materials_data if not isinstance(materials_data, str) else json.loads(materials_data)
    except (json.JSONDecodeError, TypeError):
        return names
    if isinstance(parsed, list):
        names = {m.get("name") for m in parsed if m.get("is_alternative")}
    return names


def _is_alt_linked(material_field, alt_names: set[str]) -> bool:
    """True when ``material_field`` points at an alternative material.

    Honours the magic prefixes the frontend uses:
      - ``"__GLOBAL__"`` → unassigned (count for everyone).
      - ``"__ALT__:Foo"`` → alternative material "Foo" (always linked).
      - plain string in ``alt_names`` → alternative material via name match.
    """
    if not material_field:
        return False
    if material_field == "__GLOBAL__":
        return False
    if isinstance(material_field, str) and material_field.startswith("__ALT__:"):
        return True
    return material_field in alt_names


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
    from app.services.budget_calculator import (
        compute_pool_totals,
        filter_main_materials,
        flatten_pieces,
        parse_materials_data,
    )

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

    alt_material_names = _collect_alt_material_names(data.get("materials_data"))

    # Fabrication details (Traforo de pileta, Zócalos, Terminación, …).
    # We compute these inline (rather than reusing budget_calculator.compute_detail_totals)
    # because the new schema uses English keys (`price`/`currency`) — the
    # budget helper still expects Spanish keys (`precio`/`moneda`) and silently
    # returns 0 for English-only rows.
    fab_raw = data.get("fabrication_details")
    fab_items: list = []
    if fab_raw:
        try:
            parsed = fab_raw if not isinstance(fab_raw, str) else json.loads(fab_raw)
            if isinstance(parsed, list):
                fab_items = parsed
        except (json.JSONDecodeError, TypeError):
            fab_items = []
    fab_ars = 0.0
    fab_usd = 0.0
    for d in fab_items:
        price = float(
            d.get("price") or d.get("precio", 0) or 0
        )
        qty = float(
            d.get("quantity") or d.get("cantidad", 1) or 1
        )
        currency = (
            (d.get("currency") or d.get("moneda") or "ARS").upper()
        )
        amount = price * qty
        if currency == "USD":
            fab_usd += amount
        else:
            fab_ars += amount

    # Materials (main items, exclude alternatives). Here we multiply length
    # × width × quantity × price_m2 *as-is* — values are already in metres.
    mats = parse_materials_data(data.get("materials_data"))
    main_mats = filter_main_materials(mats)
    mat_ars = 0.0
    mat_usd = 0.0
    for m in main_mats:
        length = float(m.get("length") or m.get("largo", 0) or 0)
        width = float(m.get("width") or m.get("ancho", 0) or 0)
        quantity = float(m.get("quantity") or m.get("cantidad", 1) or 1)
        area = length * width * quantity  # metres × metres × qty
        currency = m.get("currency") or m.get("moneda", "ARS")
        if currency == "USD":
            mat_usd += round(area * float(m.get("price_m2_usd") or m.get("precio_m2_usd", 0) or 0), 2)
        else:
            mat_ars += round(area * float(m.get("price_m2") or m.get("precio_m2", 0) or 0), 2)

    # Pools (exclude alt-linked — matches the hook's `poolsForMain`).
    pools_raw = parse_materials_data(data.get("pools_data")) or []
    pools_for_main = [pt for pt in pools_raw if not _is_alt_linked(pt.get("material"), alt_material_names)]
    pp_ars, pp_usd = compute_pool_totals(pools_for_main)

    # Additional works (exclude alt-linked — matches the hook's
    # `additionalForMain`).
    add_items: list = []
    add_raw = data.get("additional_works_data")
    if add_raw:
        try:
            parsed = add_raw if not isinstance(add_raw, str) else json.loads(add_raw)
            if isinstance(parsed, list):
                add_items = parsed
        except (json.JSONDecodeError, TypeError):
            add_items = []
    add_ars = 0.0
    add_usd = 0.0
    for a in add_items:
        if _is_alt_linked(a.get("materialName") or a.get("material_name"), alt_material_names):
            continue
        _cur = (a.get("currency") or "ARS").upper()
        a_total = a.get("total")
        # `frente` rows carry a frozen `total` set by the picker; `flat`
        # rows compute `price * quantity` and fall back to `total` if missing.
        if a.get("type") == "frente":
            _contrib = float(a_total or 0)
        else:
            _contrib = float(a_total) if a_total is not None else (
                float(a.get("price") or 0) * float(a.get("quantity") or 1)
            )
        if _cur == "USD":
            add_usd += _contrib
        else:
            add_ars += _contrib

    # Aggregate both currencies with THREE separate cross-currency
    # rounding passes (fab+mat together, pp, additional) — mirrors the
    # hook's `Math.round(x * dd * 100) / 100` per group. Without this, a
    # $0.005 rounding loss per line can shift the total by a couple of
    # pesos on a 5-line presupuesto.
    fabmat_to_ars = round((fab_usd + mat_usd) * dd) if dd > 0 else 0
    pp_to_ars = round(pp_usd * dd) if dd > 0 else 0
    add_to_ars = round(add_usd * dd) if dd > 0 else 0
    ars_to_usd = round((fab_ars + mat_ars + pp_ars + add_ars) / dd, 2) if dd > 0 else 0
    subtotal_ars = max(0.0, round(fab_ars + fabmat_to_ars + mat_ars + pp_ars + pp_to_ars + add_ars + add_to_ars))
    subtotal_usd = max(0.0, round(fab_usd + mat_usd + pp_usd + add_usd + ars_to_usd, 2))

    transport = float(data.get("transport") or 0)
    transport_usd = float(data.get("transport_usd") or 0)

    total_base_ars = max(0.0, subtotal_ars + transport)
    total_base_usd = max(0.0, subtotal_usd + transport_usd)

    # Discount + surcharge (matches the frontend hook's logic). The
    # gate (`discount_enabled`) decides whether the configured %
    # / fixed amount actually applies — matches the frontend
    # `useBudgetCalculations` semantics. Without the gate the user
    # could not turn the discount off without zeroing the percentages.
    discount_enabled = bool(data.get("discount_enabled"))
    discount_target = data.get("discount_target") or "materials"
    discount_pct = float(data.get("discount_percentage") or 0)
    discount_fijo = float(data.get("discount_fixed_amount") or 0)
    if discount_enabled and discount_pct > 0:
        total_ars = round(total_base_ars * (1 - discount_pct / 100))
        total_usd = round(total_base_usd * (1 - discount_pct / 100) * 100) / 100
    elif discount_enabled and discount_fijo > 0:
        total_ars = max(0.0, total_base_ars - discount_fijo)
        total_usd = max(0.0, round((total_base_usd - discount_fijo / usd_rate) * 100) / 100)
    else:
        total_ars = total_base_ars
        total_usd = total_base_usd

    # Apply the catalogue payment-method discount / surcharge (if any).
    # The frontend recomputes the same thing in `useBudgetCalculations` /
    # `buildPdfData` so the live form, the PDF and the persisted row all
    # agree. The DB lookup here is the safety net for code paths that
    # bypass the form hook (e.g. a budget → WO conversion where the
    # `payment_method_id` FK carries the configuration forward).
    #
    # Credit-card rule: *recargo lineal por cuota*. El interés
    # `value%` se aplica N veces al total, después se divide en N
    # cuotas iguales. Total = `base × (1 + N × value/100)`.
    from app.models.reference import PaymentMethod  # local import: avoid cycle on cold start
    payment_method_id = data.get("payment_method_id")
    payment_method_name = data.get("payment_method")
    installments = int(data.get("installments") or 1)
    pm: PaymentMethod | None = None
    if payment_method_id:
        pm = db.query(PaymentMethod).filter(PaymentMethod.id == payment_method_id).first()
    if pm is None and payment_method_name:
        pm = db.query(PaymentMethod).filter(PaymentMethod.name == payment_method_name).first()
    pre_pm_total_ars = total_ars
    pre_pm_total_usd = total_usd
    # DISCOUNT is opt-in via the per-order `apply_cash_discount` flag so
    # the operator decides client-by-client whether the promotional
    # discount applies. SURCHARGE (e.g. credit-card recargo) and the
    # credit-card installment multiplier always apply when selected.
    apply_discount = bool(data.get("apply_cash_discount"))
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

    # Alternative-material override (matches the hook's `hasAlternative`
    # branch). When the form has at least one `is_alternative=true`
    # material, the form's main "PRESUPUESTO" card displays the first
    # alternative's total instead of the main material's — and the
    # persisted row must match that. Without this branch, the
    # server-side recalc would always use the main material and the
    # WO would disagree with the live form by the delta between the
    # main and the alternative.
    mats_all = parse_materials_data(data.get("materials_data"))
    primera_alt = next((m for m in mats_all if m.get("is_alternative")), None)
    if primera_alt is not None:
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
            fab_ars
            + (fab_usd * dd2 if dd2 > 0 else 0)
            + pp_ars
            + (pp_usd * dd2 if dd2 > 0 else 0)
            + add_ars
            + (add_usd * dd2 if dd2 > 0 else 0)
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
            fab_usd
            + (fab_ars / dd2 if dd2 > 0 else 0)
            + pp_usd
            + (pp_ars / dd2 if dd2 > 0 else 0)
            + add_usd
            + (add_ars / dd2 if dd2 > 0 else 0)
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
    data["subtotal"] = subtotal_ars
    data["subtotal_usd"] = subtotal_usd
    data["total"] = total_ars
    data["total_usd"] = total_usd
    data["balance_due"] = balance_due
    data["balance_due_usd"] = balance_due_usd
    if deposit > 0:
        data["deposit_received"] = deposit
    if deposit_usd > 0:
        data["deposit_usd"] = deposit_usd


def _build_installment_detail(pm, installments: int, total_ars: float, total_usd: float):
    """Return the 3-column installment breakdown for the credit-card SURCHARGE.

    Empty lists when the catalogue method is not a percentage SURCHARGE with
    ``applies_to_installments=True`` (single-cuota / EFECTIVO / TRANSFER all
    short-circuit here so the PDF table renders no rows).
    """
    installment_detail_ars: list = []
    installment_detail_usd: list = []
    if (
        pm is None
        or pm.type != "SURCHARGE"
        or not pm.applies_to_installments
        or not pm.is_percentage
        or float(pm.value) <= 0
        or installments < 1
    ):
        return installment_detail_ars, installment_detail_usd
    value = float(pm.value)  # p.ej. 9
    n = max(1, installments)
    # Las N cuotas son uniformes: total / N (el recargo N × value%
    # ya está incluido en el total). `interes` por cuota muestra
    # el `value` del catálogo, no el acumulado.
    per_cuota_ars = round(total_ars / n, 2) if total_ars > 0 else 0.0
    per_cuota_usd = round(total_usd / n, 2) if total_usd > 0 else 0.0
    for i in range(1, int(n) + 1):
        installment_detail_ars.append(
            {
                "cuota": i,
                "interes": value,
                "monto": per_cuota_ars,
            }
        )
        installment_detail_usd.append(
            {
                "cuota": i,
                "interes": value,
                "monto": per_cuota_usd,
            }
        )
    return installment_detail_ars, installment_detail_usd
