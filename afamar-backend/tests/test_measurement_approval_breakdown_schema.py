from app.schemas.measurement_approval import (
    ApprovalAdjustment,
    ApprovalAmount,
    ApprovalBreakdown,
    ApprovalBreakdownLine,
    ApprovalMeasurement,
    ApprovalPiece,
    ApprovalReconciliation,
)


def test_approval_breakdown_schema_covers_piece_lines_and_order_adjustments():
    amount = ApprovalAmount(ars=1000, native=1000)
    line = ApprovalBreakdownLine(
        line_key="piece:p1|material:m1",
        line_kind="material",
        concept_type="material",
        material="Granito",
        measurement_before=ApprovalMeasurement(length=2, width=0.5, quantity=1),
        measurement_approved=ApprovalMeasurement(length=2.2, width=0.5, quantity=1),
        unit_price=1000,
        subtotal_before=amount,
        subtotal_approved=ApprovalAmount(ars=1100, native=1100),
        difference=ApprovalAmount(ars=100, native=100),
    )
    breakdown = ApprovalBreakdown(
        usd_rate=1500,
        rounding_policy="line_native_2dp; group_conversion_2dp; ars_total_0dp",
        pieces=[ApprovalPiece(
            piece_key="piece:p1",
            piece_id="p1",
            name="Cocina",
            lines=[line],
            subtotal_before=amount,
            subtotal_approved=ApprovalAmount(ars=1100, native=1100),
            difference=ApprovalAmount(ars=100, native=100),
        )],
        global_lines=[],
        transport=ApprovalAdjustment(),
        discount=ApprovalAdjustment(),
        surcharge=ApprovalAdjustment(),
        subtotal_before=amount,
        subtotal_approved=ApprovalAmount(ars=1100, native=1100),
        total_before=amount,
        total_approved=ApprovalAmount(ars=1100, native=1100),
        difference=ApprovalAmount(ars=100, native=100),
        reconciliation=ApprovalReconciliation(
            line_subtotal_before=amount,
            line_subtotal_approved=ApprovalAmount(ars=1100, native=1100),
            total_reconstructed_before=amount,
            total_reconstructed_approved=ApprovalAmount(ars=1100, native=1100),
            is_reconciled=True,
        ),
    )

    assert breakdown.version == 1
    assert breakdown.pieces[0].lines[0].measurement_approved.length == 2.2
    assert breakdown.total_approved.ars == 1100
