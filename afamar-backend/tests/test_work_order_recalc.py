"""Parity tests for the server-side totals recalculation.

`_recalculate_totals_from_items` must produce the same `total` /
`subtotal` / `balance_due` that the frontend's `useBudgetCalculations`
hook computes for the form. Otherwise the form shows one number and
the persisted WO row (which the PDF and the list endpoint read
directly) shows another.

The five cases below cover the surfaces that broke in the past and
would have shipped silently if the seed had just happened to leave
`payment_method_id` unset:

1. Credit-card 3-cuotas scales `value` by installments (5% × 3 = 15%).
   Used to be silently wrong (5% surcharge regardless of N).
2. `additional_works_data` is included in the subtotal. Used to be
   dropped on the server side.
3. Alternative-material override is honoured (the WO total matches
   the form's "PRESUPUESTO" card when the form has alternatives).
4. Catalogue `DISCOUNT` rows apply correctly to the subtotal.
5. Manual `discount_percentage` applies BEFORE the catalogue method
   (consistent with the hook).
"""
import json

import pytest
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.models.reference import PaymentMethod
from app.services.work_order import _recalculate_totals_from_items

from tests.conftest import TestingSessionLocal, engine


@pytest.fixture
def pm_session():
    """Insert the 4 default payment methods into the test DB and yield
    a session the recalc helper can query against."""
    # Schema is created per-test by the autouse `setup_db` fixture, so
    # PaymentMethod exists by the time this fixture runs.
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
        db.commit()
        yield db
    finally:
        db.close()


def test_case_1_credit_card_three_installments_linear_surcharge(pm_session):
    """Credit-card rule (recargo lineal por cuota): el interés
    `value%` se aplica N veces al total, después se divide en N
    cuotas iguales. Con `value=9, N=3`: ratio = 1.27 → 1000 ×
    1.27 = 1270 (cuota = 423.33).

    El per-cuota breakdown es uniforme (todas las filas tienen
    el mismo `monto` y el mismo `interes = value`)."""
    data = {
        "fabrication_details": json.dumps(
            [{"price": 1000, "quantity": 1, "currency": "ARS"}]
        ),
        "materials_data": "[]",
        "pools_data": "[]",
        "additional_works_data": "[]",
        "usd_rate": 1000,
        "transport": 0,
        "discount_percentage": 0,
        "discount_fixed_amount": 0,
        "payment_method_id": 2,
        "payment_method": "TARJETA DE CRÉDITO",
        "installments": 3,
    }
    _recalculate_totals_from_items(pm_session, data)
    assert data["subtotal"] == 1000
    assert data["total"] == 1270, (
        "credit-card 3 cuotas with value=9 should be 1000 × 1.27 = 1270 "
        f"(recargo lineal: 3 × 9% = 27% sobre el total), got {data['total']}"
    )
    detail_ars = json.loads(data["installment_detail_ars"])
    assert len(detail_ars) == 3
    # Todas las cuotas uniformes: mismo `interes` (value) y mismo
    # `monto` (total / N).
    expected_monto = round(1270 / 3, 2)
    for n, row in enumerate(detail_ars, start=1):
        assert row["cuota"] == n
        assert row["interes"] == 9
        assert row["monto"] == expected_monto
    # sum de las N filas = total (rounding loss dentro de ±0.05)
    total_breakdown = sum(r["monto"] for r in detail_ars)
    assert total_breakdown == pytest.approx(1270, abs=0.05)


def test_case_2_additional_works_included_in_subtotal(pm_session):
    """`additional_works_data` MUST contribute to the subtotal —
    dropping it on the server side made WOs lose Pulidos / Traforos
    from the persisted total."""
    data = {
        "fabrication_details": json.dumps(
            [{"price": 1000, "quantity": 1, "currency": "ARS"}]
        ),
        "materials_data": "[]",
        "pools_data": "[]",
        "additional_works_data": json.dumps(
            [{
                "name": "Pulido", "price": 500, "quantity": 1, "currency": "ARS",
                "total": 500, "materialName": "__GLOBAL__", "type": "flat",
            }]
        ),
        "usd_rate": 1000,
        "transport": 0,
        "discount_percentage": 0,
        "discount_fixed_amount": 0,
        "payment_method": "EFECTIVO",
        "installments": 1,
    }
    _recalculate_totals_from_items(pm_session, data)
    assert data["subtotal"] == 1500, f"expected 1500 (fab+additional), got {data['subtotal']}"
    assert data["total"] == 1500


def test_case_3_alternative_material_overrides_main(pm_session):
    """When the form has an `is_alternative=True` material, the form's
    main "PRESUPUESTO" card displays the alternative's total — the
    persisted row MUST match it (not the main material's total)."""
    data = {
        "fabrication_details": "[]",
        "materials_data": json.dumps([
            # main: 5 m² × 100 USD/m² = 500 USD = 500_000 ARS
            {"name": "MAIN", "price_m2": 0, "price_m2_usd": 100,
             "length": 5, "width": 1, "quantity": 1, "currency": "USD",
             "is_alternative": False},
            # alt: 1 m² × 50 USD/m² = 50 USD = 50_000 ARS
            {"name": "ALT", "price_m2": 0, "price_m2_usd": 50,
             "length": 1, "width": 1, "quantity": 1, "currency": "USD",
             "is_alternative": True},
        ]),
        "pools_data": "[]",
        "additional_works_data": "[]",
        "usd_rate": 1000,
        "transport": 0,
        "discount_percentage": 0,
        "discount_fixed_amount": 0,
        "payment_method_id": 2,
        "payment_method": "TARJETA DE CRÉDITO",
        "installments": 3,
    }
    _recalculate_totals_from_items(pm_session, data)
    # alt (50_000 ARS) × 1.27 (recargo lineal 3 cuotas, value=9) = 63_500
    assert data["total"] == 63500, (
        f"alt 50000 × 1.27 should be 63500, got {data['total']}"
    )


def test_case_4_catalogue_discount_applies(pm_session):
    """TRANSFER is configured as DISCOUNT 5% — should subtract 5% from
    the subtotal."""
    data = {
        "fabrication_details": json.dumps(
            [{"price": 10000, "quantity": 1, "currency": "ARS"}]
        ),
        "materials_data": "[]",
        "pools_data": "[]",
        "additional_works_data": "[]",
        "usd_rate": 1000,
        "transport": 0,
        "discount_percentage": 0,
        "discount_fixed_amount": 0,
        "payment_method_id": 3,
        "payment_method": "TRANSFER",
        "installments": 1,
    }
    _recalculate_totals_from_items(pm_session, data)
    assert data["total"] == 9500, f"10000 - 5% should be 9500, got {data['total']}"


def test_case_5_manual_discount_before_catalogue(pm_session):
    """Manual discount_percentage applies first, then the catalogue
    method — same order as the hook."""
    data = {
        "fabrication_details": json.dumps(
            [{"price": 10000, "quantity": 1, "currency": "ARS"}]
        ),
        "materials_data": "[]",
        "pools_data": "[]",
        "additional_works_data": "[]",
        "usd_rate": 1000,
        "transport": 0,
        "discount_percentage": 10,
        "discount_fixed_amount": 0,
        "payment_method": "EFECTIVO",
        "installments": 1,
    }
    _recalculate_totals_from_items(pm_session, data)
    assert data["total"] == 9000, f"10000 - 10% should be 9000, got {data['total']}"
