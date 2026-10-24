"""Render data for the legacy PRESUPUESTO document.

``build_budget_pdf_data`` assembles the flat dict the Jinja2 template
consumes: header, client, materials, pools, financials, terms and company.
"""
from app.core.settings import settings
from app.services.pdf_html.catalogue import _payment_methods_catalogue, _resolve_catalogue_adjustment
from app.services.pdf_html.formatting import _format_date, _format_date_optional, _split_terms
from app.services.pdf_html.rows import _build_materials_pdf, _build_pools_pdf, _parse_fabrication_details


def build_budget_pdf_data(budget_data: dict, client_dict: dict, company: dict, terms: dict, db=None) -> dict:
    from app.services.budget_calculator import filter_main_materials, parse_materials_data
    from app.services.budget_option_totals import winning_option_flat

    # MULTI-OPTION BUDGETS (2026-10-01): the document-level flat arrays
    # hold whichever option the form had OPEN when the budget was saved.
    # The client-facing download must describe the WINNING option (the one
    # a conversion turns into a work order), so the flat arrays are
    # re-derived from it. A legacy / single-option budget is untouched.
    option_flat = winning_option_flat(budget_data)
    if option_flat:
        budget_data = {
            **budget_data,
            "materials_data": option_flat["materials"],
            "fabrication_details": option_flat["fabrication"],
            "additional_works_data": option_flat["additional"],
            "pools_data": option_flat["pools"],
        }

    materiales_raw = parse_materials_data(budget_data.get("materials_data"))
    main_materials = filter_main_materials(materiales_raw)
    alternatives = [m for m in materiales_raw if m.get("is_alternative") or m.get("es_alternativa")]

    fabrication_details = _parse_fabrication_details(budget_data.get("fabrication_details"))
    materials = _build_materials_pdf(main_materials, alternatives)
    pools = _build_pools_pdf(parse_materials_data(budget_data.get("pools_data")) or [])

    subtotal_ars = float(budget_data.get("subtotal") or 0)
    transport = float(budget_data.get("transport") or 0)
    desc_pct = float(budget_data.get("discount_percentage") or 0)
    desc_fijo = float(budget_data.get("discount_fixed_amount") or 0)
    total_ars = float(budget_data.get("total") or 0)
    total_usd_val = float(budget_data.get("total_usd") or 0)
    sena = float(budget_data.get("deposit_received") or 0)
    deposit_usd = float(budget_data.get("deposit_usd") or 0)
    deposit_currency = (budget_data.get("deposit_currency") or "ARS").upper()
    # Mirror of `build_work_order_pdf_data`: the Seña row always shows the
    # native amount (USD when `deposit_currency == 'USD'`, ARS otherwise)
    # alongside its converted equivalent — and the saldo is DERIVED from
    # that same equivalent (`total − deposit_ars_equivalent`), never from
    # the stored `balance_due` snapshot, so Seña + Saldo = TOTAL exactly
    # (a stale snapshot computed under a different usd_rate used to leave
    # $1.00-ish drifts). The legacy xhtml2pdf template can't compute, so
    # all of it is pre-computed here.
    usd_rate_for_pdf = float(budget_data.get("usd_rate") or settings.DEFAULT_USD_RATE)
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
    saldo = max(0, round(total_ars - deposit_ars_equivalent, 2))

    important_obs = budget_data.get("important_observations") or ""

    return {
        # Header
        "title": "PRESUPUESTO",
        "number": budget_data.get("number", ""),
        # Status subtitle (e.g. "Pendiente") used to render a grey caption
        # under the document number. Removed (2026-09-25 mañana) — the
        # status already lives on the cash-board / list page, and the
        # PDF header was redundant + visually noisy. The legacy template
        # wraps the doc-sub div in `{% if doc_sub %}` defensively so the
        # field is still safe to populate in the future.
        "doc_sub": "",
        "date": _format_date(budget_data.get("date", "")),

        # Client
        "client_name": client_dict.get("name", ""),
        "client_phone": client_dict.get("phone", ""),
        "client_address": client_dict.get("address", ""),
        "client_email": client_dict.get("email", ""),

        # Material specs
        "material_color": budget_data.get("color", ""),
        "material_thickness": budget_data.get("thickness", ""),
        "material_finish": budget_data.get("finish", ""),
        "delivery_date": _format_date_optional(budget_data.get("delivery_date", "")),

        # Fabrication details (English field names)
        "fabrication_details": fabrication_details,

        # Materials (English field names with computed m2/subtotal)
        "materials": materials,

        # Pools (English field names with computed subtotal)
        "pools": pools,

        # Financial
        "subtotal": subtotal_ars,
        "transport": transport,
        "discount_percentage": desc_pct,
        "discount_fixed_amount": desc_fijo,
        "deposit_received": sena,
        "deposit_usd": deposit_usd,
        "deposit_currency": deposit_currency,
        "deposit_ars_equivalent": deposit_ars_equivalent,
        "deposit_usd_equivalent": deposit_usd_equivalent,
        "balance_due": saldo,
        "total": total_ars,
        "total_usd": total_usd_val,
        # Dólar del día (2026-09-25 tarde) — surfaced as a render key so the
        # legacy template can put it in the LEFT column of the totals block.
        "usd_rate": usd_rate_for_pdf,
        "payment_method": budget_data.get("payment_method", ""),
        "installments": budget_data.get("installments", 1),

        # Reference box: active payment methods (see
        # `_payment_methods_catalogue`). Mirrors the frontend preview.
        "payment_methods_catalogue": _payment_methods_catalogue(db),

        # Catalogue-driven surcharge / discount (see
        # `_resolve_catalogue_adjustment`). Without these the PDF only
        # shows the operator-typed manual discount; the surcharge or
        # discount that came from the `payment_methods` catalogue is
        # silently absorbed into the TOTAL line.
        **(
            _resolve_catalogue_adjustment(db, budget_data)
            if db is not None
            else {
                "catalogue_surcharge_percentage": 0,
                "catalogue_surcharge_amount": 0.0,
                "catalogue_discount_percentage": 0,
                "catalogue_discount_amount": 0.0,
                "catalogue_method_label": "",
                "catalogue_method_name": "",
                "installments": budget_data.get("installments", 1),
                "catalogue_installment_detail": [],
            }
        ),

        # Observations
        "notes": budget_data.get("notes") or "",
        "important_observations": important_obs,
        "important_observations_list": _split_terms(important_obs),

        # Terms
        "document_type": "budget",
        "budget_terms_list": _split_terms((terms or {}).get("budget_terms") or ""),
        "warranty_terms_list": _split_terms((terms or {}).get("warranty_text") or ""),

        # Validity
        "validity_days": budget_data.get("validity_days", 15),
        "estimated_date": _format_date(budget_data.get("estimated_date", "")),
        # Free-text "válido por X días" line (admin-editable). Budgets only:
        # the work-order builder deliberately omits this key so the legacy
        # template never renders the line for OTs.
        "budget_validity_text": company.get("budget_validity_text", ""),

        # Sketch (raw data, converted to PNG by generate_budget_pdf)
        "sketch_elements": budget_data.get("sketch_elements"),

        # Company
        "company_name": company.get("company_name", "AFAMAR"),
        "company_tagline": company.get("company_tagline", "MÁRMOLES & GRANITOS"),
        "company_address": company.get("company_address", ""),
        "company_phone": company.get("company_phone", ""),
        "company_email": company.get("company_email", ""),
        "pdf_footer": company.get("pdf_footer", ""),
    }
