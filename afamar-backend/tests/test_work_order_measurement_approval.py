import json

import pytest

from app.api.routers.work_orders import (
    approve_measurement_adjustment as approve_measurement_route,
)
from app.core.exceptions import ConflictError, ValidationError
from app.models.client import Client
from app.models.daily_cash import CashMovement
from app.models.reference import PaymentMethod
from app.models.user import User
from app.models.work_order import WorkOrder
from app.models.work_order_measurement_approval import WorkOrderMeasurementApproval
from app.schemas.measurement_approval import ApprovalBreakdown
from app.schemas.work_order import (
    WorkOrderMeasurementAdjustmentRequest,
    WorkOrderResponse,
)
from app.services.work_order import WorkOrderService
from app.services.work_order.recalc import recalculate_totals_from_items
from app.services.work_order_measurement_approval import (
    _amount,
    _breakdown_line,
    _missing_snapshot_labels,
    build_measurement_adjustment,
)
from tests.conftest import TestingSessionLocal


def test_approval_breakdown_material_unit_price_uses_native_currency():
    line = _breakdown_line(
        {
            "name": "SILESTONE",
            "currency": "USD",
            "price_m2": 729166.67,
            "price_m2_usd": 607.6388889,
            "length": 1.2,
            "width": 1.2,
            "quantity": 1,
            "m2_budgeted": 1.2,
        },
        0,
        "material",
        1200,
    )

    assert line["unit_price"] == pytest.approx(607.6388889)
    assert line["subtotal_approved"] == {
        "ars": 875 * 1200,
        "usd": 875,
        "native": 875,
        "currency": "USD",
    }


@pytest.fixture
def approval_db():
    db = TestingSessionLocal()
    db.add(PaymentMethod(
        id=1, name="EFECTIVO", label="Efectivo", is_active=True,
        sort_order=10, type="NONE", value=0, is_percentage=False,
        applies_to_installments=False,
    ))
    db.add(PaymentMethod(
        id=2, name="TARJETA DE CRÉDITO", label="Tarjeta", is_active=True,
        sort_order=20, type="SURCHARGE", value=9, is_percentage=True,
        applies_to_installments=True,
    ))
    db.add(Client(id=1, name="Cliente", phone="", address="", email=""))
    db.add(User(
        id=1, username="approver", email="approver@test.local",
        hashed_password="x", is_active=True, is_admin=True,
    ))
    db.add(WorkOrder(
        id=1, number="A-APP-001", client_id=1, budget_id=10,
        status="MEASUREMENT", origin="Budget", currency="ARS", usd_rate=1000,
        payment_method="EFECTIVO", payment_method_id=1, installments=1,
        discount_enabled=False, discount_target="materials",
        materials_data=json.dumps([{
            "id": 1, "name": "Material", "length": 2, "width": 1,
            "quantity": 1, "price_m2": 1000, "currency": "ARS",
            "is_alternative": False, "m2_budgeted": 2,
        }]),
        fabrication_details="[]", additional_works_data="[]", pools_data="[]",
        total=2000, subtotal=2000, total_usd=2, subtotal_usd=2,
        deposit_received=200, deposit_currency="ARS", deposit_usd=0,
        balance_due=1800, balance_due_usd=1.8,
    ))
    db.commit()
    try:
        yield db
    finally:
        db.close()


def _change_length(db, length: float):
    order = db.query(WorkOrder).filter(WorkOrder.id == 1).first()
    rows = json.loads(order.materials_data)
    rows[0]["length"] = length
    order.materials_data = json.dumps(rows)
    db.commit()
    return order


def test_positive_approval_uses_server_recalculation_and_updates_only_balance(approval_db):
    order = _change_length(approval_db, 3)
    proposal = build_measurement_adjustment(order, approval_db)
    assert proposal["difference_ars"] == 3000
    assert proposal["exact_difference_ars"] == 1000
    assert proposal["new_total"] == 5000
    assert proposal["payments_ars"] == 200
    assert proposal["new_balance_due"] == 4800

    updated, approval = WorkOrderService(approval_db).approve_measurement_adjustment(
        1, 1, {
            "measurement_fingerprint": proposal["measurement_fingerprint"],
            "previous_total": proposal["original_total"],
            "previous_total_usd": proposal["original_total_usd"],
        },
    )
    assert updated.total == 5000
    assert updated.balance_due == 4800
    assert approval.previous_total == 2000
    assert approval.new_total == 5000
    assert updated.deposit_received == 200
    assert approval_db.query(CashMovement).count() == 0
    breakdown = ApprovalBreakdown.model_validate(json.loads(approval.approval_breakdown))
    assert breakdown.total_before.ars == 2000
    assert breakdown.total_approved.ars == 5000
    assert breakdown.difference.ars == 3000
    assert breakdown.exact_total_approved.ars == 3000
    assert breakdown.pieces[0].lines[0].subtotal_before.ars == 2000
    assert breakdown.pieces[0].lines[0].subtotal_approved.ars == 3000


def test_approval_response_serializes_existing_orm_approval(approval_db):
    order = _change_length(approval_db, 3)
    proposal = build_measurement_adjustment(order, approval_db)
    updated, _ = WorkOrderService(approval_db).approve_measurement_adjustment(
        1, 1, {
            "measurement_fingerprint": proposal["measurement_fingerprint"],
            "previous_total": proposal["original_total"],
            "previous_total_usd": proposal["original_total_usd"],
        },
    )

    response = WorkOrderResponse.from_orm_with_client(updated)

    assert response.id == 1
    assert len(response.measurement_approvals) == 1
    assert response.measurement_approvals[0].new_total == proposal["new_total"]
    assert response.measurement_approvals[0].approval_breakdown["total_approved"]["ars"] == proposal["new_total"]


def test_approval_route_returns_http_200_after_commit(approval_db):
    order = _change_length(approval_db, 3)
    proposal = build_measurement_adjustment(order, approval_db)
    response = approve_measurement_route(
        1,
        WorkOrderMeasurementAdjustmentRequest(
            measurement_fingerprint=proposal["measurement_fingerprint"],
            previous_total=proposal["original_total"],
            previous_total_usd=proposal["original_total_usd"],
        ),
        approval_db,
        approval_db.get(User, 1),
    )

    assert response.status_code == 200
    payload = json.loads(response.body)
    assert payload["success"] is True
    assert payload["data"]["order"]["measurement_approvals"]


def test_repeated_fingerprint_returns_conflict_without_a_second_row(approval_db):
    order = _change_length(approval_db, 3)
    proposal = build_measurement_adjustment(order, approval_db)
    payload = {
        "measurement_fingerprint": proposal["measurement_fingerprint"],
        "previous_total": proposal["original_total"],
        "previous_total_usd": proposal["original_total_usd"],
    }
    service = WorkOrderService(approval_db)
    service.approve_measurement_adjustment(1, 1, payload)

    with pytest.raises(ConflictError, match="ya fueron aprobadas"):
        service.approve_measurement_adjustment(1, 1, payload)

    persisted = approval_db.get(WorkOrder, 1)
    assert persisted.total == proposal["new_total"]
    assert len(persisted.measurement_approvals) == 1


def test_commit_failure_rolls_back_order_and_approval(approval_db, monkeypatch):
    order = _change_length(approval_db, 3)
    proposal = build_measurement_adjustment(order, approval_db)
    original_commit = approval_db.commit

    def fail_commit():
        raise RuntimeError("commit failed")

    monkeypatch.setattr(approval_db, "commit", fail_commit)
    with pytest.raises(RuntimeError, match="commit failed"):
        WorkOrderService(approval_db).approve_measurement_adjustment(1, 1, {
            "measurement_fingerprint": proposal["measurement_fingerprint"],
            "previous_total": proposal["original_total"],
            "previous_total_usd": proposal["original_total_usd"],
        })

    monkeypatch.setattr(approval_db, "commit", original_commit)
    approval_db.expire_all()
    persisted = approval_db.get(WorkOrder, 1)
    assert persisted.total == 2000
    assert approval_db.query(WorkOrderMeasurementApproval).count() == 0


def test_negative_measurement_difference_can_be_approved(approval_db):
    order = _change_length(approval_db, 1)
    proposal = build_measurement_adjustment(order, approval_db)
    assert proposal["difference_ars"] == 3000
    assert proposal["exact_difference_ars"] == -1000
    assert proposal["negative_difference_ars"] == -1000

    updated, _ = WorkOrderService(approval_db).approve_measurement_adjustment(1, 1, {
        "measurement_fingerprint": proposal["measurement_fingerprint"],
        "previous_total": proposal["original_total"],
        "previous_total_usd": proposal["original_total_usd"],
    })
    assert updated.total == 5000
    assert updated.balance_due == 4800


def test_discount_is_applied_once_and_second_measurement_is_incremental(approval_db):
    order = approval_db.query(WorkOrder).filter(WorkOrder.id == 1).first()
    order.discount_enabled = True
    order.discount_percentage = 10
    order.total = 1800
    order.subtotal = 2000
    order.balance_due = 1600
    approval_db.commit()
    _change_length(approval_db, 3)

    first = build_measurement_adjustment(order, approval_db)
    assert first["new_total"] == 5000
    assert first["difference_ars"] == 3200
    assert first["exact_difference_ars"] == 900
    WorkOrderService(approval_db).approve_measurement_adjustment(1, 1, {
        "measurement_fingerprint": first["measurement_fingerprint"],
        "previous_total": first["original_total"],
        "previous_total_usd": first["original_total_usd"],
    })

    _change_length(approval_db, 4)
    second = build_measurement_adjustment(approval_db.get(WorkOrder, 1), approval_db)
    assert second["new_total"] == 5000
    assert second["difference_ars"] == 0
    assert second["exact_difference_ars"] == 900


def test_two_successive_approvals_keep_independent_immutable_breakdowns(approval_db):
    order = _change_length(approval_db, 3)
    service = WorkOrderService(approval_db)

    first_proposal = build_measurement_adjustment(order, approval_db)
    _, first_approval = service.approve_measurement_adjustment(1, 1, {
        "measurement_fingerprint": first_proposal["measurement_fingerprint"],
        "previous_total": first_proposal["original_total"],
        "previous_total_usd": first_proposal["original_total_usd"],
    })
    first_breakdown = first_approval.approval_breakdown

    _change_length(approval_db, 4)
    second_order = approval_db.get(WorkOrder, 1)
    second_proposal = build_measurement_adjustment(second_order, approval_db)
    _, second_approval = service.approve_measurement_adjustment(1, 1, {
        "measurement_fingerprint": second_proposal["measurement_fingerprint"],
        "previous_total": second_proposal["original_total"],
        "previous_total_usd": second_proposal["original_total_usd"],
    })

    persisted = (
        approval_db.query(WorkOrderMeasurementApproval)
        .filter(WorkOrderMeasurementApproval.work_order_id == 1)
        .order_by(WorkOrderMeasurementApproval.id)
        .all()
    )
    assert len(persisted) == 2
    assert persisted[0].approval_breakdown == first_breakdown
    assert persisted[0].new_total == 5000
    assert persisted[1].previous_total == 5000
    assert persisted[1].new_total == 5000
    assert persisted[1].approval_breakdown != persisted[0].approval_breakdown
    assert approval_db.get(WorkOrder, 1).total == 5000
    assert ApprovalBreakdown.model_validate(json.loads(second_approval.approval_breakdown)).total_approved.ars == 5000


def test_missing_snapshot_blocks_approval_instead_of_charging_full_line(approval_db):
    order = approval_db.query(WorkOrder).filter(WorkOrder.id == 1).first()
    rows = json.loads(order.materials_data)
    rows[0].pop("m2_budgeted")
    rows[0]["length"] = 3
    order.materials_data = json.dumps(rows)
    approval_db.commit()

    proposal = build_measurement_adjustment(order, approval_db)

    assert proposal["approval_blocked"] is True
    assert "Mesada Material" in proposal["blocking_reasons"][0]
    assert proposal["gross_difference_ars"] == 0

    with pytest.raises(ValidationError, match="Faltan datos históricos"):
        WorkOrderService(approval_db).approve_measurement_adjustment(1, 1, {
            "measurement_fingerprint": proposal["measurement_fingerprint"],
            "previous_total": proposal["original_total"],
            "previous_total_usd": proposal["original_total_usd"],
        })


def test_explicitly_new_line_can_be_approved_without_baseline(approval_db):
    order = approval_db.query(WorkOrder).filter(WorkOrder.id == 1).first()
    rows = json.loads(order.materials_data)
    rows.append({
        "id": 2, "name": "Material nuevo", "length": 1, "width": 1,
        "quantity": 1, "price_m2": 1000, "currency": "ARS",
        "is_alternative": False, "measurement_origin": "new",
    })
    order.materials_data = json.dumps(rows)
    approval_db.commit()

    proposal = build_measurement_adjustment(order, approval_db)

    assert proposal["approval_blocked"] is False, proposal["blocking_reasons"]
    assert proposal["difference_ars"] == 3000
    assert proposal["exact_difference_ars"] == 1000


def test_missing_snapshot_labels_cover_m2_linear_and_additional_rows():
    labels = _missing_snapshot_labels(
        [{"name": "Mesada", "length": 2, "width": 1, "quantity": 1}],
        [
            {"concept": "BASEBOARD", "material": "Granito", "length": 2, "width": .1, "quantity": 1},
            {"concept": "TERMINACION", "material": "Granito", "length": 3, "quantity": 1},
        ],
        [{"name": "Frente", "type": "frente", "linear_meters": 3, "total": 100}],
    )

    assert len(labels) == 4
    assert any("Mesada" in label for label in labels)
    assert any("BASEBOARD" in label for label in labels)
    assert any("TERMINACION" in label for label in labels)
    assert any("Frente" in label for label in labels)


def test_discount_breakdown_is_not_the_gross_measurement_difference(approval_db):
    order = approval_db.query(WorkOrder).filter(WorkOrder.id == 1).first()
    order.discount_enabled = True
    order.discount_percentage = 10
    order.total = 1800
    order.subtotal = 2000
    order.balance_due = 1600
    approval_db.commit()
    _change_length(approval_db, 3)

    proposal = build_measurement_adjustment(order, approval_db)

    assert proposal["gross_difference_ars"] == 1000
    assert proposal["difference_ars"] == 3200
    assert proposal["exact_difference_ars"] == 900
    assert proposal["commercial_discount_ars"] == 300
    assert proposal["commercial_adjustment_delta_ars"] == -100
    assert proposal["discount_difference_ars"] != proposal["gross_difference_ars"]


def test_breakdown_reconciles_multi_piece_mixed_currency_and_commercial_layers(approval_db):
    order = approval_db.get(WorkOrder, 1)
    materials = [
        {"id": 1, "name": "ARS", "length": 2, "width": 1, "quantity": 1, "price_m2": 1000, "currency": "ARS", "is_alternative": False, "m2_budgeted": 2},
        {"id": 2, "name": "USD", "length": 1, "width": 1, "quantity": 1, "price_m2_usd": 100, "currency": "USD", "is_alternative": False, "m2_budgeted": 1},
    ]
    fabrication = [{
        "concept": "BASEBOARD", "detail": "Zócalo", "material": "ARS",
        "length": 2, "width": .1, "quantity": 1, "material_price_m2": 500,
        "currency": "ARS", "m2_budgeted": .2, "total_ars_budgeted": 100,
    }]
    additional = [
        {"additional_work_id": 1, "name": "Frente", "type": "frente", "materialName": "USD",
         "linear_meters": 2, "linear_meters_budgeted": 2, "total": 26,
         "total_usd_budgeted": 26, "currency": "USD",
         "formula_values": {"material_price_m2_at_selection": 100, "multiplier": 1}},
        {"additional_work_id": 2, "name": "Trasforo global", "type": "flat", "materialName": "__GLOBAL__",
         "total": 50, "total_ars_budgeted": 50, "currency": "ARS"},
    ]
    pools = [{"brand": "Bacha", "model": "M1", "material": "POOL_MATERIAL_GLOBAL", "price": 200, "currency": "ARS", "quantity": 1}]
    pieces = [
        {"id": "p1", "name": "Cocina", "mainMaterial": {"name": "ARS"}},
        {"id": "p2", "name": "Baño", "mainMaterial": {"name": "USD"}},
    ]
    baseline = {
        "usd_rate": 1000, "transport": 100, "transport_usd": 0,
        "discount_enabled": True, "discount_target": "total", "discount_percentage": 10,
        "discount_fixed_amount": 0, "payment_method": "TARJETA DE CRÉDITO", "payment_method_id": 2,
        "installments": 2, "apply_cash_discount": False,
        "deposit_received": 200, "deposit_usd": 0, "deposit_currency": "ARS",
        "materials_data": json.dumps(materials), "fabrication_details": json.dumps(fabrication),
        "additional_works_data": json.dumps(additional), "pools_data": json.dumps(pools),
        "pieces_data": json.dumps(pieces),
    }
    recalculate_totals_from_items(approval_db, baseline)
    for key in ("subtotal", "subtotal_usd", "total", "total_usd", "balance_due", "balance_due_usd"):
        setattr(order, key, baseline[key])
    order.usd_rate = 1000
    order.transport = 100
    order.transport_usd = 0
    order.discount_enabled = True
    order.discount_target = "total"
    order.discount_percentage = 10
    order.payment_method = "TARJETA DE CRÉDITO"
    order.payment_method_id = 2
    order.installments = 2
    order.materials_data = json.dumps(materials)
    order.fabrication_details = json.dumps(fabrication)
    order.additional_works_data = json.dumps(additional)
    order.pools_data = json.dumps(pools)
    order.pieces_data = json.dumps(pieces)
    approval_db.commit()

    materials[0]["length"] = 2.5  # increase
    materials[1]["length"] = .8  # decrease
    fabrication[0]["length"] = 2.4
    additional[0]["linear_meters"] = 3
    additional[1]["total"] = 75
    order.materials_data = json.dumps(materials)
    order.fabrication_details = json.dumps(fabrication)
    order.additional_works_data = json.dumps(additional)
    approval_db.commit()

    proposal = build_measurement_adjustment(order, approval_db)
    breakdown = ApprovalBreakdown.model_validate(proposal["approval_breakdown"])
    reconciliation = breakdown.reconciliation
    assert proposal["approval_blocked"] is False, proposal["blocking_reasons"]
    assert reconciliation.is_reconciled is True
    assert abs(reconciliation.subtotal_error_ars) <= .01
    assert abs(reconciliation.subtotal_error_usd) <= .01
    assert len(breakdown.pieces) == 2
    assert {line.line_kind for piece in breakdown.pieces for line in piece.lines} == {"material", "fabrication", "additional"}
    assert len(breakdown.global_lines) == 2
    assert breakdown.surcharge.approved > 0
    assert breakdown.difference.ars == proposal["difference_ars"]


def test_reconciliation_failure_blocks_before_commit_and_preserves_order(approval_db, monkeypatch):
    order = _change_length(approval_db, 3)
    proposal = build_measurement_adjustment(order, approval_db)
    original_builder = __import__(
        "app.services.work_order_measurement_approval", fromlist=["_approval_breakdown"]
    )._approval_breakdown

    def inconsistent_breakdown(current_order, candidate_data, db):
        breakdown = original_builder(current_order, candidate_data, db)
        breakdown["reconciliation"]["is_reconciled"] = False
        breakdown["reconciliation"]["total_error_ars"] = 1.0
        return breakdown

    module = __import__("app.services.work_order_measurement_approval", fromlist=["_approval_breakdown"])
    monkeypatch.setattr(module, "_approval_breakdown", inconsistent_breakdown)
    with pytest.raises(ValidationError, match="desglose comercial"):
        WorkOrderService(approval_db).approve_measurement_adjustment(1, 1, {
            "measurement_fingerprint": proposal["measurement_fingerprint"],
            "previous_total": proposal["original_total"],
            "previous_total_usd": proposal["original_total_usd"],
        })
    approval_db.expire_all()
    assert approval_db.get(WorkOrder, 1).total == 2000
    assert approval_db.query(WorkOrderMeasurementApproval).count() == 0


def test_persisted_breakdown_is_immutable_after_later_measurement_edit(approval_db):
    order = _change_length(approval_db, 3)
    proposal = build_measurement_adjustment(order, approval_db)
    WorkOrderService(approval_db).approve_measurement_adjustment(1, 1, {
        "measurement_fingerprint": proposal["measurement_fingerprint"],
        "previous_total": proposal["original_total"],
        "previous_total_usd": proposal["original_total_usd"],
    })
    approval = approval_db.query(WorkOrderMeasurementApproval).one()
    persisted = approval.approval_breakdown
    rows = json.loads(approval_db.get(WorkOrder, 1).materials_data)
    rows[0]["length"] = 4
    approval_db.get(WorkOrder, 1).materials_data = json.dumps(rows)
    approval_db.commit()
    approval_db.expire_all()
    assert approval_db.query(WorkOrderMeasurementApproval).one().approval_breakdown == persisted


def test_historical_approval_without_breakdown_remains_readable(approval_db):
    legacy = WorkOrderMeasurementApproval(
        work_order_id=1,
        approved_by_user_id=1,
        previous_total=2000,
        previous_total_usd=2,
        difference_ars=100,
        difference_usd=.1,
        new_total=2100,
        new_total_usd=2.1,
        usd_rate=1000,
        measurement_fingerprint="legacy-fingerprint",
        measurement_snapshot="{}",
        approval_breakdown=None,
    )
    approval_db.add(legacy)
    approval_db.commit()
    assert approval_db.query(WorkOrderMeasurementApproval).one().approval_breakdown is None


def test_amount_conversion_keeps_currency_and_cent_precision():
    amount = _amount(.01, "USD", 1535)
    assert amount == {"ars": 15.35, "usd": .01, "native": .01, "currency": "USD"}


def test_stale_fingerprint_and_duplicate_approval_are_rejected(approval_db):
    order = _change_length(approval_db, 3)
    proposal = build_measurement_adjustment(order, approval_db)
    _change_length(approval_db, 4)
    with pytest.raises(ConflictError):
        WorkOrderService(approval_db).approve_measurement_adjustment(1, 1, {
            "measurement_fingerprint": proposal["measurement_fingerprint"],
            "previous_total": proposal["original_total"],
            "previous_total_usd": proposal["original_total_usd"],
        })

    fresh = build_measurement_adjustment(approval_db.get(WorkOrder, 1), approval_db)
    WorkOrderService(approval_db).approve_measurement_adjustment(1, 1, {
        "measurement_fingerprint": fresh["measurement_fingerprint"],
        "previous_total": fresh["original_total"],
        "previous_total_usd": fresh["original_total_usd"],
    })
    with pytest.raises(ValidationError):
        build_measurement_adjustment(approval_db.get(WorkOrder, 1), approval_db)
