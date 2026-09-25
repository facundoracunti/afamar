"""
Tests for the admin-editable `budget_validity_text` setting ("Presupuesto
válido por X días" line in the PDF header).

Flow:
  setting row (DB)  →  build_company_and_terms  →  company dict
                    →  build_budget_pdf_data  →  data["budget_validity_text"]
                                                    (budget only — work-order
                                                    builder must NOT carry it)
"""
from app.services.pdf_helpers import (
    COMPANY_KEYS,
    build_company_and_terms,
    prepare_budget_payload,
    prepare_work_order_payload,
)


def _settings_with_validity(text: str) -> dict:
    """Build the minimal settings dict that build_company_and_terms reads."""
    return {
        "company_name": "AFAMAR",
        "company_tagline": "",
        "company_address": "",
        "company_phone": "",
        "company_email": "",
        "company_logo": "",
        "pdf_footer": "",
        "budget_validity_text": text,
        # terms keys aren't required for these tests
    }


def test_budget_validity_text_is_a_company_key():
    """The setting must be listed in COMPANY_KEYS so it flows through."""
    assert "budget_validity_text" in COMPANY_KEYS


def test_build_company_and_terms_propagates_budget_validity_text():
    company, _ = build_company_and_terms(
        _settings_with_validity("Presupuesto válido por 15 días."),
        budget_key="budget_terms_override",
        overrides=None,
    )
    assert company["budget_validity_text"] == "Presupuesto válido por 15 días."


def test_build_company_and_terms_defaults_to_empty_string():
    """Missing key → empty string (no spurious lines in the PDF header)."""
    settings = {
        "company_name": "AFAMAR", "company_tagline": "", "company_address": "",
        "company_phone": "", "company_email": "", "company_logo": "",
        "pdf_footer": "",
    }
    company, _ = build_company_and_terms(
        settings, budget_key="budget_terms_override", overrides=None,
    )
    assert company["budget_validity_text"] == ""
