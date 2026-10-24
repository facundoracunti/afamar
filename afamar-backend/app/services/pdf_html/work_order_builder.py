"""Render data for the legacy ORDEN DE TRABAJO document.

``build_work_order_pdf_data`` assembles the flat dict the Jinja2 template
consumes: header, client, materials, the COMPARATIVA DE MEDICIÓN, pools,
financials, terms and company.
"""
from app.core.settings import settings
from app.services.pdf_html.catalogue import _payment_methods_catalogue, _resolve_catalogue_adjustment
from app.services.pdf_html.formatting import _format_date, _format_date_optional, _fmt_money, _split_terms
from app.services.pdf_html.measurement import _build_measurement_comparison
from app.services.pdf_html.payments import _sum_income_paid
from app.services.pdf_html.rows import (
    _build_materials_pdf,
    _build_pools_pdf,
    _build_work_order_pieces_pdf,
    _parse_fabrication_details,
)


def build_work_order_pdf_data(order_data: dict, client_dict: dict, company: dict, terms: dict, db=None) -> dict:
    from app.services.budget_calculator import filter_main_materials, parse_materials_data

    materiales_raw = parse_materials_data(order_data.get("materials_data"))
    main_materials = filter_main_materials(materiales_raw)

    fabrication_details = _parse_fabrication_details(order_data.get("fabrication_details"))
    materials = _build_materials_pdf(main_materials, [])
    pools = _build_pools_pdf(parse_materials_data(order_data.get("pools_data")) or [])

    total_ars = float(order_data.get("total") or 0)
    total_usd_val = float(order_data.get("total_usd") or 0)
    sena = float(order_data.get("deposit_received") or 0)
    deposit_usd = float(order_data.get("deposit_usd") or 0)
    deposit_currency = (order_data.get("deposit_currency") or "ARS").upper()
    # The Seña row mirrors the frontend preview: it always shows the
    # native amount (USD when `deposit_currency == 'USD'`, ARS otherwise)
    # alongside its converted equivalent so the customer has both on
    # paper. Derived server-side because the legacy xhtml2pdf template
    # can't compute.
    usd_rate_for_pdf = float(order_data.get("usd_rate") or settings.DEFAULT_USD_RATE)
    deposit_ars_equivalent = round(
        deposit_usd * usd_rate_for_pdf
        if deposit_currency == "USD" and usd_rate_for_pdf > 0
        else sena,
        2,
    )
    deposit_usd_equivalent = round(
        sena / usd_rate_for_pdf
        if deposit_currency != "USD" and usd_rate_for_pdf > 0
        else deposit_usd,
        2,
    )
    # Pagos acumulados (autoritativo): suma de los movimientos INCOME de la
    # OT (seña bookeada al crear + pagos del módulo de pagos). El PDF muestra
    # una fila unificada "Seña / Pagos Registrados" con este monto y el saldo
    # se deriva de él (Paid + Saldo = TOTAL exacto). Fallback al equivalente
    # de la seña cuando no hay movimientos (OTs legacy sin bookeo / db None).
    total_paid_ars = _sum_income_paid(db, order_data.get("id"))
    if total_paid_ars == 0:
        total_paid_ars = deposit_ars_equivalent
    total_paid_usd = round(total_paid_ars / usd_rate_for_pdf, 2) if usd_rate_for_pdf > 0 else 0.0
    # Paid + Saldo must always add up to TOTAL exactly. The stored
    # `balance_due` snapshot can diverge from the accumulated paid actually
    # displayed (round-trips computed under a different usd_rate leave
    # $1.00-ish drifts), so the saldo is DERIVED from the same amount shown
    # above.
    saldo = max(0, round(total_ars - total_paid_ars, 2))

    important_obs = order_data.get("important_observations") or ""

    # COMPARATIVA DE MEDICIÓN — included whenever the per-order flag is
    # true (toggled in the form; defaults to on). The flag is available for
    # both work orders converted from a budget and direct work orders:
    # direct orders simply have no "estimated" snapshot, so the
    # Presupuestado column renders "—". Rows are always
    # computed from `materials_data` so the template can render them
    # without further parsing. Only main materials participate
    # (alternatives are filtered out by `filter_main_materials`), matching
    # the form's table.
    include_comparison = bool(
        order_data.get("include_measurement_comparison_in_pdf", False)
    )
    usd_rate_value = float(order_data.get("usd_rate") or 0) or settings.DEFAULT_USD_RATE
    measurement_comparison = (
        _build_measurement_comparison(
            main_materials,
            usd_rate_value,
            order_data.get("fabrication_details"),
            order_data.get("additional_works_data"),
        )
        if include_comparison
        else []
    )
    work_order_pieces = _build_work_order_pieces_pdf(
        order_data.get("pieces_data"),
        usd_rate_value,
    )

    return {
        # Header
        "title": "ORDEN DE TRABAJO",
        "number": order_data.get("number", ""),
        # Status subtitle dropped (see comment in build_budget_pdf_data,
        # 2026-09-25 mañana). Kept as an empty string for template symmetry.
        "doc_sub": "",
        "date": _format_date(order_data.get("date", "")),

        # Client
        "client_name": client_dict.get("name", ""),
        "client_phone": client_dict.get("phone", ""),
        "client_address": client_dict.get("address", ""),
        "client_email": client_dict.get("email", ""),

        # Material specs
        "material_color": order_data.get("color", ""),
        "material_thickness": order_data.get("thickness", ""),
        "material_finish": order_data.get("finish", ""),
        "delivery_date": _format_date_optional(order_data.get("delivery_date", "")),

        # Fabrication details (English field names)
        "fabrication_details": fabrication_details,

        # Materials (English field names with computed m2/subtotal)
        "materials": materials,
        # Presentation-only per-piece layout. The persisted financial fields
        # below remain the sole source for totals and balances.
        "work_order_pieces": work_order_pieces,

        # COMPARATIVA DE MEDICIÓN (Concepto | M² Real | M² Presupuestado |
        # Diferencia). Empty when the per-order flag is off.
        "measurement_comparison": measurement_comparison,
        "measurement_comparison_total_ars": (
            f"{'+' if (t := sum(r['subtotal_ars'] for r in measurement_comparison)) > 0 else ''}{_fmt_money(t)}"
            if measurement_comparison else ""
        ),
        "measurement_comparison_total_usd": (
            f"{'+' if (t := sum(r['subtotal_usd'] for r in measurement_comparison)) > 0 else ''}{_fmt_money(t)}"
            if measurement_comparison else ""
        ),

        # Pools (English field names with computed subtotal)
        "pools": pools,

        # Financial
        "subtotal": float(order_data.get("subtotal") or 0),
        "transport": float(order_data.get("transport") or 0),
        "discount_percentage": float(order_data.get("discount_percentage") or 0),
        "discount_fixed_amount": float(order_data.get("discount_fixed_amount") or 0),
        "deposit_received": sena,
        "deposit_usd": deposit_usd,
        "deposit_currency": deposit_currency,
        "deposit_ars_equivalent": deposit_ars_equivalent,
        "deposit_usd_equivalent": deposit_usd_equivalent,
        "paid_label": "Seña / Pagos Registrados",
        "total_paid_ars": total_paid_ars,
        "total_paid_usd": total_paid_usd,
        "balance_due": saldo,
        "total": total_ars,
        "total_usd": total_usd_val,
        # Dólar del día (2026-09-25 tarde) — render key for the LEFT column.
        "usd_rate": usd_rate_for_pdf,
        "payment_method": order_data.get("payment_method", ""),
        "installments": order_data.get("installments", 1),

        # Reference box: active payment methods (see
        # `_payment_methods_catalogue`). Mirrors the frontend preview.
        "payment_methods_catalogue": _payment_methods_catalogue(db),

        # Catalogue-driven surcharge / discount (see
        # `_resolve_catalogue_adjustment`). When `db` is None (legacy
        # call site) the template gets 0s and behaves as before.
        **(
            _resolve_catalogue_adjustment(db, order_data)
            if db is not None
            else {
                "catalogue_surcharge_percentage": 0,
                "catalogue_surcharge_amount": 0.0,
                "catalogue_discount_percentage": 0,
                "catalogue_discount_amount": 0.0,
                "catalogue_method_label": "",
                "catalogue_method_name": "",
                "installments": order_data.get("installments", 1),
                "catalogue_installment_detail": [],
            }
        ),

        # Observations
        "notes": order_data.get("notes") or "",
        "important_observations": important_obs,
        "important_observations_list": _split_terms(important_obs),

        # Terms
        "document_type": "work_order",
        "delivery_terms_list": _split_terms((terms or {}).get("delivery_terms") or ""),
        "warranty_terms_list": _split_terms((terms or {}).get("warranty_text") or ""),

        # Validity (work orders don't have these, use defaults)
        "validity_days": order_data.get("validity_days", 15),
        "estimated_date": _format_date(order_data.get("estimated_date", "")),

        # Sketch (raw data, converted to PNG by generate_work_order_pdf).
        # Prefer the dedicated `sketch_elements` column (populated by
        # `WorkOrderService.create_from_budget`); fall back to the legacy
        # `budgeted_details` stash for WOs that pre-date the new column.
        "sketch_elements": order_data.get("sketch_elements") or order_data.get("budgeted_details"),

        # Company
        "company_name": company.get("company_name", "AFAMAR"),
        "company_tagline": company.get("company_tagline", "MÁRMOLES & GRANITOS"),
        "company_address": company.get("company_address", ""),
        "company_phone": company.get("company_phone", ""),
        "company_email": company.get("company_email", ""),
        "pdf_footer": company.get("pdf_footer", ""),
    }
