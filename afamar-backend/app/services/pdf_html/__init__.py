"""Legacy PDF service (xhtml2pdf + Jinja2) — package entry point.

The former monolithic ``app/services/pdf_html.py`` was split by
responsibility (ADR 0009 — modularización):

  * ``env.py``            — Jinja2 environment, template dir, custom
                            ``format`` filter.
  * ``formatting.py``     — date / money / area / unit formatters, the
                            term-list splitter and the concept label map.
  * ``rows.py``           — row builders for fabrication / materials / pools.
  * ``assets.py``         — company logo + croquis PNG rendering.
  * ``renderer.py``       — xhtml2pdf rendering + the two public generators.
  * ``catalogue.py``      — payment-method catalogue surcharge / discount.
  * ``measurement.py``    — COMPARATIVA DE MEDICIÓN rows.
  * ``payments.py``       — accumulated INCOME cash movements.
  * ``budget_builder.py`` — ``build_budget_pdf_data``.
  * ``work_order_builder.py`` — ``build_work_order_pdf_data``.

Every name that used to be importable from ``app.services.pdf_html`` is
re-exported here, so NO existing import breaks.
"""
from app.services.pdf_html.assets import _load_logo_base64, _sketch_to_png_base64_list
from app.services.pdf_html.budget_builder import build_budget_pdf_data
from app.services.pdf_html.catalogue import _payment_methods_catalogue, _resolve_catalogue_adjustment
from app.services.pdf_html.env import _BACKEND_ROOT, _TEMPLATE_DIR, _env, _jinja2_format
from app.services.pdf_html.formatting import (
    _CONCEPT_DISPLAY,
    _concept_to_display,
    _fmt_m2,
    _fmt_money,
    _fmt_num,
    _fmt_unit,
    _format_date,
    _format_date_optional,
    _split_terms,
)
from app.services.pdf_html.measurement import _build_measurement_comparison, _parse_raw_list
from app.services.pdf_html.payments import _sum_income_paid
from app.services.pdf_html.renderer import _render_pdf, generate_budget_pdf, generate_work_order_pdf
from app.services.pdf_html.rows import _build_materials_pdf, _build_pools_pdf, _parse_fabrication_details
from app.services.pdf_html.work_order_builder import build_work_order_pdf_data

__all__ = [
    # Public document builders / generators.
    "build_budget_pdf_data",
    "build_work_order_pdf_data",
    "generate_budget_pdf",
    "generate_work_order_pdf",
    # Environment.
    "_env",
    "_jinja2_format",
    "_TEMPLATE_DIR",
    "_BACKEND_ROOT",
    # Formatting helpers.
    "_split_terms",
    "_format_date",
    "_format_date_optional",
    "_CONCEPT_DISPLAY",
    "_concept_to_display",
    "_fmt_num",
    "_fmt_money",
    "_fmt_m2",
    "_fmt_unit",
    # Row builders.
    "_parse_fabrication_details",
    "_build_materials_pdf",
    "_build_pools_pdf",
    # Assets + renderer.
    "_load_logo_base64",
    "_sketch_to_png_base64_list",
    "_render_pdf",
    # Catalogue adjustments.
    "_resolve_catalogue_adjustment",
    "_payment_methods_catalogue",
    # Measurement comparison + payments.
    "_parse_raw_list",
    "_build_measurement_comparison",
    "_sum_income_paid",
]
