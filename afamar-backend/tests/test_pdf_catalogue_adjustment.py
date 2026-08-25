"""Tests for the PDF template's catalogue-driven breakdown.

`_resolve_catalogue_adjustment` mirrors the same surcharge/discount
rule that the form (`useBudgetCalculations`), the PDF preview
(`buildPdfData`) and the server recalc (`_recalculate_totals_from_items`)
all apply. The PDF template (`document_pdf.html`) only renders the
breakdown as discrete lines when the helpers surface the right numbers,
so a regression in any of the four places will land in the customer's
PDF as a missing or wrong breakdown line.
"""
import pytest
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.models.reference import PaymentMethod
from app.services.pdf_html import _resolve_catalogue_adjustment

from tests.conftest import TestingSessionLocal, engine


@pytest.fixture
def pm_session():
    db = TestingSessionLocal()
    try:
        db.add(PaymentMethod(
            id=1, name="EFECTIVO", label="Efectivo",
            is_active=True, sort_order=10,
            type="NONE", value=0.0, is_percentage=False, applies_to_installments=False,
        ))
        db.add(PaymentMethod(
            id=2, name="TARJETA DE CRÉDITO", label="Tarjeta de crédito",
            is_active=True, sort_order=40,
            type="SURCHARGE", value=9.0, is_percentage=True, applies_to_installments=True,
        ))
        db.add(PaymentMethod(
            id=3, name="TRANSFER", label="Transferencia 5% desc",
            is_active=True, sort_order=20,
            type="DISCOUNT", value=5.0, is_percentage=True, applies_to_installments=False,
        ))
        db.add(PaymentMethod(
            id=4, name="EFECTIVO_5_OFF", label="Efectivo $5 off",
            is_active=True, sort_order=5,
            type="DISCOUNT", value=5.0, is_percentage=False, applies_to_installments=False,
        ))
        db.commit()
        yield db
    finally:
        db.close()


def test_none_method_returns_zero_breakdown(pm_session):
    """A form with EFECTIVO (type=NONE) shouldn't add any line to the PDF."""
    data = {"payment_method": "EFECTIVO", "payment_method_id": 1,
            "subtotal": 1000, "transport": 0, "discount_percentage": 0,
            "discount_fixed_amount": 0, "installments": 1}
    res = _resolve_catalogue_adjustment(pm_session, data)
    assert res["catalogue_surcharge_percentage"] == 0
    assert res["catalogue_surcharge_amount"] == 0.0
    assert res["catalogue_discount_percentage"] == 0
    assert res["catalogue_discount_amount"] == 0.0
    assert res["catalogue_method_label"] == ""
    assert res["installments"] == 1


def test_credit_card_3_cuotas_surcharge_breakdown(pm_session):
    """Credit-card rule (recargo lineal por cuota): `value%` se aplica
    N veces al total, después se divide en N cuotas iguales. Con
    `value=9, N=3`: ratio = 1.27 → 10000 × 1.27 = 12700 (cuota =
    4233.33).

    PDF breakdown should show:
      - catalogue_surcharge_percentage: 27 (3 × 9%)
      - catalogue_surcharge_amount: 2700 (27% of 10000)
      - method_label: "Tarjeta de crédito"
      - catalogue_installment_detail: 3 rows, all with the same
        `interes` (9) and the same `monto` (4233.33 = 12700/3).
    """
    data = {"payment_method": "TARJETA DE CRÉDITO", "payment_method_id": 2,
            "subtotal": 10000, "transport": 0, "discount_percentage": 0,
            "discount_fixed_amount": 0, "installments": 3}
    res = _resolve_catalogue_adjustment(pm_session, data)
    assert res["catalogue_surcharge_percentage"] == 27
    assert res["catalogue_surcharge_amount"] == 2700
    assert res["catalogue_discount_amount"] == 0
    assert res["catalogue_method_label"] == "Tarjeta de crédito"
    assert res["installments"] == 3
    assert len(res["catalogue_installment_detail"]) == 3
    expected_monto = round(12700 / 3, 2)
    for n, row in enumerate(res["catalogue_installment_detail"], start=1):
        assert row["cuota"] == n
        assert row["interes"] == 9
        assert row["monto"] == expected_monto
    # Suma de N filas = total
    total_breakdown = sum(r["monto"] for r in res["catalogue_installment_detail"])
    assert total_breakdown == pytest.approx(12700, rel=1e-4)


def test_credit_card_1_cuota_surcharge_breakdown(pm_session):
    """1 cuota → 9% surcharge (1 × 9%)."""
    data = {"payment_method": "TARJETA DE CRÉDITO", "payment_method_id": 2,
            "subtotal": 10000, "transport": 0, "discount_percentage": 0,
            "discount_fixed_amount": 0, "installments": 1}
    res = _resolve_catalogue_adjustment(pm_session, data)
    assert res["catalogue_surcharge_amount"] == 900
    assert res["catalogue_surcharge_percentage"] == 9
    # 1-row detail is rendered collapsed in the PDF (length > 1 guard)
    assert len(res["catalogue_installment_detail"]) == 1
    assert res["catalogue_installment_detail"][0]["interes"] == 9


def test_credit_card_2_cuotas_surcharge_breakdown(pm_session):
    """2 cuotas → 18% recargo (2 × 9%): 10000 × 1.18 = 11800, cuota = 5900."""
    data = {"payment_method": "TARJETA DE CRÉDITO", "payment_method_id": 2,
            "subtotal": 10000, "transport": 0, "discount_percentage": 0,
            "discount_fixed_amount": 0, "installments": 2}
    res = _resolve_catalogue_adjustment(pm_session, data)
    assert res["catalogue_surcharge_amount"] == 1800
    assert res["catalogue_surcharge_percentage"] == 18
    assert len(res["catalogue_installment_detail"]) == 2
    # Todas uniformes: mismo `interes` (9) y mismo `monto` (5900)
    for row in res["catalogue_installment_detail"]:
        assert row["interes"] == 9
        assert row["monto"] == 5900


def test_percentage_discount_breakdown(pm_session):
    """TRANSFER row (DISCOUNT 5% percentage) → 5% off the
    subtotal+transport, applied AFTER the manual discount."""
    data = {"payment_method": "TRANSFER", "payment_method_id": 3,
            "subtotal": 10000, "transport": 0, "discount_percentage": 0,
            "discount_fixed_amount": 0, "installments": 1}
    res = _resolve_catalogue_adjustment(pm_session, data)
    assert res["catalogue_discount_percentage"] == 5
    assert res["catalogue_discount_amount"] == 500
    assert res["catalogue_surcharge_amount"] == 0
    assert res["catalogue_method_label"] == "Transferencia 5% desc"


def test_fixed_ars_discount_breakdown(pm_session):
    """EFECTIVO_5_OFF row (DISCOUNT 5 ARS fixed) → 5 ARS off the
    subtotal+transport. Used to verify the percentage=False path."""
    data = {"payment_method": "EFECTIVO_5_OFF", "payment_method_id": 4,
            "subtotal": 10000, "transport": 0, "discount_percentage": 0,
            "discount_fixed_amount": 0, "installments": 1}
    res = _resolve_catalogue_adjustment(pm_session, data)
    assert res["catalogue_discount_percentage"] == 0
    assert res["catalogue_discount_amount"] == 5.0


def test_catalogue_resolves_via_name_fallback(pm_session):
    """When `payment_method_id` is missing or stale, the helper falls
    back to the legacy string `payment_method` so old budgets/OTs
    without the FK still surface the breakdown."""
    data = {"payment_method": "TARJETA DE CRÉDITO",  # no payment_method_id
            "subtotal": 10000, "transport": 0, "discount_percentage": 0,
            "discount_fixed_amount": 0, "installments": 3}
    res = _resolve_catalogue_adjustment(pm_session, data)
    assert res["catalogue_surcharge_percentage"] == 27
    assert res["catalogue_surcharge_amount"] == 2700


def test_manual_discount_applied_before_catalogue(pm_session):
    """10% manual discount comes off the subtotal+transport FIRST, then
    the catalogue surcharge is applied to the discounted base. This
    mirrors the order in the form hook."""
    data = {"payment_method": "TARJETA DE CRÉDITO", "payment_method_id": 2,
            "subtotal": 10000, "transport": 0, "discount_percentage": 10,
            "discount_fixed_amount": 0, "installments": 3}
    res = _resolve_catalogue_adjustment(pm_session, data)
    # base = 10000 - 10% = 9000 → 27% surcharge → 2430
    assert res["catalogue_surcharge_amount"] == 2430
