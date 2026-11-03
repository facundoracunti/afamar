import pytest
from io import BytesIO

from app.services.commercial_rounding import (
    apply_contractual_totals,
    copy_contractual_totals,
    contractual_snapshot_state,
    contractual_totals,
)
from app.core.exceptions import ValidationError
from app.models.budget import Budget
from app.models.client import Client
from app.schemas.budget import BudgetResponse
from app.services.pdf_html.budget_builder import build_budget_pdf_data
from app.services.pdf_html.renderer import generate_budget_pdf


def test_rounds_up_to_ars_5000_and_derives_usd_from_contractual_ars():
    values = contractual_totals(869_100, 1_500)
    assert values == {
        "exact_ars": 869_100.0,
        "exact_usd": 579.4,
        "adjustment_ars": 900.0,
        "adjustment_usd": 0.6,
        "contractual_ars": 870_000.0,
        "contractual_usd": 580.0,
    }


def test_exact_multiple_and_cent_values_are_idempotent():
    assert contractual_totals(870_000, 1_500)["adjustment_ars"] == 0
    first = contractual_totals(1_025_000, 1_500)
    second = contractual_totals(first["contractual_ars"], 1_500)
    assert first["contractual_ars"] == second["contractual_ars"]
    assert second["adjustment_ars"] == 0


def test_zero_or_negative_totals_are_zero():
    assert contractual_totals(0, 1_500)["contractual_ars"] == 0
    assert contractual_totals(-1, 1_500)["contractual_ars"] == 0


def test_contractual_snapshot_recomputes_balance_from_frozen_total():
    data = {"total": 869_100, "usd_rate": 1_500, "deposit_received": 100_000}
    apply_contractual_totals(data)
    assert data["total"] == 870_000
    assert data["balance_due"] == 770_000
    assert data["balance_due_usd"] == 513.33


def test_partial_snapshot_is_not_treated_as_a_valid_frozen_document():
    row = {"total_exact_ars": 100_000, "total_exact_usd": None}
    assert contractual_snapshot_state(row) == "partial"
    with pytest.raises(ValidationError):
        copy_contractual_totals({}, row)


def test_budget_response_and_get_endpoint_expose_contractual_snapshot(client):
    from tests.conftest import TestingSessionLocal

    db = TestingSessionLocal()
    try:
        db.add(Client(id=1, name="Cliente P-000012", phone="", address="", email=""))
        budget = Budget(
            number="P-000012",
            client_id=1,
            status="PENDING",
            subtotal=1_105_808.40,
            subtotal_usd=706.59,
            total=1_110_000,
            total_usd=709.27,
            balance_due=1_110_000,
            balance_due_usd=709.27,
            total_exact_ars=1_105_808.40,
            total_exact_usd=706.59,
            rounding_adjustment_ars=4_191.60,
            rounding_adjustment_usd=2.68,
            total_contractual_ars=1_110_000,
            total_contractual_usd=709.27,
        )
        db.add(budget)
        db.commit()
        db.refresh(budget)

        response_data = BudgetResponse.from_orm_with_client(budget).model_dump()
        snapshot = {key: response_data[key] for key in (
            "total_exact_ars", "total_exact_usd",
            "rounding_adjustment_ars", "rounding_adjustment_usd",
            "total_contractual_ars", "total_contractual_usd",
        )}
        assert snapshot == {
            "total_exact_ars": 1_105_808.40,
            "total_exact_usd": 706.59,
            "rounding_adjustment_ars": 4_191.60,
            "rounding_adjustment_usd": 2.68,
            "total_contractual_ars": 1_110_000,
            "total_contractual_usd": 709.27,
        }
        budget_id = budget.id
    finally:
        db.close()

    response = client.get(f"/api/v1/budgets/{budget_id}")
    assert response.status_code == 200, response.text
    api_data = response.json()["data"]
    assert {key: api_data[key] for key in snapshot} == snapshot


def test_budget_pdf_uses_p000012_contractual_total_and_usd():
    budget = {
        "number": "P-000012",
        "date": "2026-11-02",
        "usd_rate": 1565,
        "subtotal": 1_105_808.40,
        "subtotal_usd": 706.59,
        "total": 1_105_808.40,
        "total_usd": 706.59,
        "deposit_received": 0,
        "deposit_usd": 0,
        "deposit_currency": "ARS",
        "total_exact_ars": 1_105_808.40,
        "total_exact_usd": 706.59,
        "rounding_adjustment_ars": 4_191.60,
        "rounding_adjustment_usd": 2.68,
        "total_contractual_ars": 1_110_000,
        "total_contractual_usd": 709.27,
        "materials_data": "[]",
        "pools_data": "[]",
        "fabrication_details": "[]",
        "additional_works_data": "[]",
        "important_observations": "",
        "notes": "",
        "payment_method": "EFECTIVO",
        "installments": 1,
    }
    company = {
        "company_name": "AFAMAR",
        "company_tagline": "",
        "company_address": "",
        "company_phone": "",
        "company_email": "",
        "pdf_footer": "",
        "budget_validity_text": "",
    }
    data = build_budget_pdf_data(budget, {"name": "Cliente sintético"}, company, {})

    assert data["subtotal"] == 1_105_808.40
    assert data["total"] == 1_110_000
    assert data["total_usd"] == 709.27
    assert data["balance_due"] == 1_110_000

    pdf = generate_budget_pdf(data)
    assert isinstance(pdf, BytesIO)
    assert pdf.getvalue().startswith(b"%PDF")

    from pypdf import PdfReader

    text = "\n".join(page.extract_text() or "" for page in PdfReader(pdf).pages)
    assert "1,110,000.00" in text
    assert "709.27" in text
    assert "1,105,808.40" in text
    assert "4,191.60" not in text
