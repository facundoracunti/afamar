"""Line-item aggregation for the server-side totals recalc.

Groups the raw work-order line items (fabrication details, main
materials, pools, additional works) into per-family ARS / USD amounts
and derives the cross-currency ``subtotal`` from them. Extracted
verbatim from the former monolithic ``recalc.py``.
"""
import json
from dataclasses import dataclass

from app.services.work_order.recalc_links import _collect_alt_material_names, _is_alt_linked


@dataclass
class LineTotals:
    """Aggregated ARS/USD amounts, per line-item family + the subtotal."""

    fab_ars: float = 0.0
    fab_usd: float = 0.0
    mat_ars: float = 0.0
    mat_usd: float = 0.0
    pp_ars: float = 0.0
    pp_usd: float = 0.0
    add_ars: float = 0.0
    add_usd: float = 0.0
    subtotal_ars: float = 0.0
    subtotal_usd: float = 0.0


def compute_line_totals(data: dict, dd: float) -> LineTotals:
    """Aggregate every line item of ``data`` into a :class:`LineTotals`.

    ``dd`` is the USD rate used for the cross-currency rounding passes.
    """
    from app.services.budget_calculator import (
        compute_pool_totals,
        filter_main_materials,
        parse_materials_data,
    )

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

    return LineTotals(
        fab_ars=fab_ars,
        fab_usd=fab_usd,
        mat_ars=mat_ars,
        mat_usd=mat_usd,
        pp_ars=pp_ars,
        pp_usd=pp_usd,
        add_ars=add_ars,
        add_usd=add_usd,
        subtotal_ars=subtotal_ars,
        subtotal_usd=subtotal_usd,
    )
