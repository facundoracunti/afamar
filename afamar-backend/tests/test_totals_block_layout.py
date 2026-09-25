"""
Tests for the two-column totals layout (2026-09-25 tarde):
  - LEFT column → "Dólar del día" (date/time + rate) for the legacy template
  - RIGHT column → strict Subtotal → Descuento → TOTAL → Saldo pendiente

The component renders the layout; here we lock the data contract so the
xhtml2pdf template can read the values it needs (notably `usd_rate` as a
top-level render key — both builders must emit it).
"""
from app.services.pdf_html import build_budget_pdf_data, build_work_order_pdf_data


_BASE_BUDGET = {
    "number": "P-000001",
    "status": "PENDING",
    "client_name": "Test",
    "currency": "USD",
    "usd_rate": 1000,
    "delivery_date": None,
    "materials_data": "[]",
    "pools_data": "[]",
    "fabrication_details": "[]",
    "additional_works_data": "[]",
    "sketch_elements": None,
}


_BASE_ORDER = {
    "number": "A-000001",
    "status": "MEASUREMENT",
    "client_name": "Test",
    "currency": "USD",
    "usd_rate": 1535,
    "delivery_date": None,
    "materials_data": "[]",
    "pools_data": "[]",
    "fabrication_details": "[]",
    "additional_works_data": "[]",
    "sketch_elements": None,
}


def test_budget_builder_exposes_usd_rate_for_left_column():
    """The legacy template renders "Dólar del día" in the LEFT column of
    the totals block. The builder must surface `usd_rate` as a top-level
    render key so the Jinja template can read it."""
    data = build_budget_pdf_data(_BASE_BUDGET, {}, {}, {})
    assert "usd_rate" in data
    assert data["usd_rate"] == 1000


def test_work_order_builder_exposes_usd_rate_for_left_column():
    data = build_work_order_pdf_data(_BASE_ORDER, {}, {}, {})
    assert "usd_rate" in data
    assert data["usd_rate"] == 1535


def test_budget_builder_uses_default_usd_rate_when_form_has_none():
    """If the form has no `usd_rate` (or it's 0), the builder falls back to
    `settings.DEFAULT_USD_RATE` so the legacy template still has a value
    to print in the LEFT column instead of rendering '—'."""
    form = dict(_BASE_BUDGET, usd_rate=0)
    data = build_budget_pdf_data(form, {}, {}, {})
    # DEFAULT_USD_RATE is "1000" (string from settings) but the builder
    # always coerces to a positive float. Just assert it's > 0.
    assert data["usd_rate"] > 0
