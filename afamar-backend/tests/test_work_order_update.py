"""Regression + correctness tests for `WorkOrderService.update`.

The user-facing flow that broke today (2026-08-26): the user converts a
budget to a work order, opens the OT in MEDICION, edits the m² of a
material, and hits "Guardar". The PUT hit `_recalculate_totals_from_items(merged)`
without the `db` argument, raising `TypeError: ... missing 1 required
positional argument: 'data'` and returning 500 to the browser.

These tests exercise the full `WorkOrderService.update` path end-to-end
against an in-memory SQLite DB. They would have caught the bug.

What we cover:

1. `update()` with just `materials_data` (the exact path that 500'd)
   - no exception, total is recomputed, materials persisted.
2. `update()` with `payment_method_id` + `installments` while in MEDICION
   - recargo lineal scales with N cuotas, persists correctly.
3. `update()` with `discount_percentage` patch
   - manual discount applied before catalogue method (matches the hook).
4. `update()` while in `WORKSHOP` (forward state transition)
   - VALID_TRANSITIONS check works, totals recomputed.
5. `update()` that does NOT include any line-item key
   - no recalc path taken; only status / deposit / metadata changes.
"""
import json

import pytest

from app.models.client import Client
from app.models.reference import PaymentMethod
from app.models.work_order import WorkOrder
from app.services.work_order import WorkOrderService

from tests.conftest import TestingSessionLocal


# ────────────────────────────────────────────────────────────────────
# Fixtures
# ────────────────────────────────────────────────────────────────────


@pytest.fixture
def fresh_db():
    """Yield a session pre-seeded with the 4 default payment methods
    and one work order in MEDICION (the user-facing scenario)."""
    db = TestingSessionLocal()
    try:
        # The 4 seeded payment methods (mirrors scripts/seeders/payment_methods.py).
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
        db.add(Client(
            id=1, name="Test Client", phone="+54 11 0000-0000",
            address="Calle Test 123", email="test@test.com",
        ))
        order = WorkOrder(
            id=1,
            number="A-TEST-001",
            client_id=1,
            status="MEASUREMENT",
            origin="Budget",
            currency="ARS",
            usd_rate=1000.0,
            subtotal=0.0, total=0.0,
            subtotal_usd=0.0, total_usd=0.0,
            balance_due=0.0, balance_due_usd=0.0,
            material="Test Material",
            material_price_m2=1000.0,
            materials_data=None,
            fabrication_details=None,
            pools_data=None,
            additional_works_data=None,
            payment_method="EFECTIVO",
            installments=1,
        )
        db.add(order)
        db.commit()
        yield db
    finally:
        db.close()


def _materials_json(rows: list[dict]) -> str:
    return json.dumps(rows)


# ────────────────────────────────────────────────────────────────────
# 1. Regression del bug de hoy
# ────────────────────────────────────────────────────────────────────


def test_update_with_materials_data_does_not_500(fresh_db):
    """Exact reproduction of the user's complaint:

    Convert budget → OT in MEDICION → user edits m² of a material →
    hits Guardar → PUT /work-orders/{id} with `{materials_data: ...}`.

    Pre-fix: `_recalculate_totals_from_items(merged)` raised TypeError,
    bubbled to the FastAPI handler, returned 500.

    Post-fix: returns 200 with the new total and persists the JSON.
    """
    svc = WorkOrderService(fresh_db)
    new_materials = _materials_json([{
        "name": "Mármol Blanco",
        "length": 2.5, "width": 1.2, "quantity": 1,
        "price_m2": 1500, "currency": "ARS",
    }])
    result = svc.update(1, {"materials_data": new_materials})

    # Recompute fired: 2.5 × 1.2 × 1 × 1500 = 4500 ARS subtotal/total.
    assert result.materials_data == new_materials
    assert result.subtotal == pytest.approx(4500, abs=0.05)
    assert result.total == pytest.approx(4500, abs=0.05)
    # USD side: 4500 ARS / 1000 = 4.50 USD.
    assert result.total_usd == pytest.approx(4.5, abs=0.01)


def test_update_with_materials_data_and_payment_method(fresh_db):
    """Edit m² in MEDICION while the OT is paid with credit card 3 cuotas.

    Surcharge: linear, 3 × 9% = 27% on the total. Base = 4500 ARS →
    total = 4500 × 1.27 = 5715. Cuotas: 3 × 1905.00 ARS.
    """
    svc = WorkOrderService(fresh_db)
    new_materials = _materials_json([{
        "name": "Mármol Blanco",
        "length": 2.5, "width": 1.2, "quantity": 1,
        "price_m2": 1500, "currency": "ARS",
    }])
    result = svc.update(1, {
        "materials_data": new_materials,
        "payment_method_id": 2,
        "payment_method": "TARJETA DE CRÉDITO",
        "installments": 3,
    })

    assert result.total == pytest.approx(5715, abs=0.05)
    detail = json.loads(result.installment_detail_ars or "[]")
    assert len(detail) == 3
    assert all(row["interes"] == 9 for row in detail)
    # Cuotas uniformes: 5715 / 3 = 1905.00 ARS.
    expected_monto = round(5715 / 3, 2)
    for row in detail:
        assert row["monto"] == pytest.approx(expected_monto, abs=0.05)


def test_update_with_materials_data_and_discount_percentage(fresh_db):
    """Edit m² + apply a 10% manual discount. Order of operations must
    match the frontend hook: manual discount first, then catalogue method.
    With EFECTIVO (no surcharge) the total is just 4500 × 0.9 = 4050.
    """
    svc = WorkOrderService(fresh_db)
    new_materials = _materials_json([{
        "name": "Mármol Blanco",
        "length": 2.5, "width": 1.2, "quantity": 1,
        "price_m2": 1500, "currency": "ARS",
    }])
    result = svc.update(1, {
        "materials_data": new_materials,
        "discount_percentage": 10,
        "discount_fixed_amount": 0,
    })
    assert result.subtotal == pytest.approx(4500, abs=0.05)
    assert result.total == pytest.approx(4050, abs=0.05)


# ────────────────────────────────────────────────────────────────────
# 2. Status transitions + line-item update in one call
# ────────────────────────────────────────────────────────────────────


def test_update_advances_status_measurement_to_workshop(fresh_db):
    """Same PATCH that edits m² also flips the status from MEDICION to
    TALLER. The two operations must coexist (the user clicks Guardar
    after both changing the measurement and clicking Avanzar estado).
    """
    svc = WorkOrderService(fresh_db)
    new_materials = _materials_json([{
        "name": "Mármol Blanco",
        "length": 2.5, "width": 1.2, "quantity": 1,
        "price_m2": 1500, "currency": "ARS",
    }])
    result = svc.update(1, {
        "status": "WORKSHOP",
        "materials_data": new_materials,
    })
    assert result.status == "WORKSHOP"
    assert result.materials_data == new_materials
    assert result.total == pytest.approx(4500, abs=0.05)


def test_update_with_no_line_item_keys_skips_recalc(fresh_db):
    """Pure metadata update (no fabrication_details / materials_data /
    pools_data / payment_method / installments / discounts / deposit) →
    the recalc branch is skipped, no error.
    """
    svc = WorkOrderService(fresh_db)
    # Persist a known subtotal first so we can assert it doesn't change.
    fresh_db.query(WorkOrder).filter(WorkOrder.id == 1).update(
        {"subtotal": 1234.0, "total": 1234.0,
         "subtotal_usd": 1.234, "total_usd": 1.234}
    )
    fresh_db.commit()

    result = svc.update(1, {
        "notes": "Cliente pide adelantar entrega",
    })
    assert result.notes == "Cliente pide adelantar entrega"
    # No recalc → the seeded totals stay.
    assert result.subtotal == 1234.0
    assert result.total == 1234.0


# ────────────────────────────────────────────────────────────────────
# 3. Deposit update during MEDICION (cash movement side-effect)
# ────────────────────────────────────────────────────────────────────


def test_update_deposit_persists_and_creates_cash_movement(fresh_db):
    """User registers a deposit in the OT form (MEDICION). The PATCH
    persists `deposit_received` and triggers `_create_cash_movement_on_deposit`
    via the side-effect branch in `update()`. We assert the deposit
    is persisted; the cash movement itself is covered by an integration
    test in test_daily_cash.py.
    """
    svc = WorkOrderService(fresh_db)
    result = svc.update(1, {
        "deposit_received": 50000,
        "deposit_currency": "ARS",
    })
    assert result.deposit_received == 50000
    assert result.deposit_currency == "ARS"
