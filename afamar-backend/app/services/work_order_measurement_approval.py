"""Safe, explicit approval of measurement-driven commercial differences."""
from __future__ import annotations

import hashlib
import json
from copy import deepcopy

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.models.daily_cash import CashMovement
from app.models.work_order import WorkOrder
from app.models.work_order_measurement_approval import WorkOrderMeasurementApproval
from app.repositories.daily_cash import movement_ars
from app.schemas.measurement_approval import ApprovalBreakdown
from app.services.pdf_html.measurement import _build_measurement_comparison
from app.services.work_order.recalc import recalculate_totals_from_items
from app.services.commercial_rounding import contractual_totals
from app.utils.measurement_numbers import measurement_number

_M2_CONCEPTS = {"LENGTH", "BASEBOARD", "FRONT", "LARGO", "ZOCALOS", "FRENTE"}
_LINEAR_CONCEPTS = {"TERMINACION"}
_ROUNDING_POLICY = "ARS/USD amounts rounded to 2 decimals; line amounts converted at approval usd_rate"


def _json_list(raw) -> list:
    if isinstance(raw, list):
        return raw
    if not raw:
        return []
    try:
        value = json.loads(raw)
    except (TypeError, ValueError):
        return []
    return value if isinstance(value, list) else []


def measurement_snapshot(order: WorkOrder) -> dict:
    """Return only measurement inputs, excluding prices and frozen snapshots."""
    materials = []
    for row in _json_list(order.materials_data):
        if isinstance(row, dict):
            materials.append({
                "id": row.get("id"),
                "name": row.get("name") or row.get("nombre"),
                "alternative": bool(row.get("is_alternative") or row.get("es_alternativa")),
                "length": row.get("length", row.get("largo", 0)),
                "width": row.get("width", row.get("ancho", 0)),
                "quantity": row.get("quantity", row.get("cantidad", 1)),
            })
    fabrication = []
    for row in _json_list(order.fabrication_details):
        if isinstance(row, dict):
            fabrication.append({
                "concept": row.get("concept") or row.get("concepto"),
                "detail": row.get("detail") or row.get("detalle"),
                "material": row.get("material") or row.get("material_name"),
                "length": row.get("length", row.get("largo", 0)),
                "width": row.get("width", row.get("ancho", 0)),
                "quantity": row.get("quantity", row.get("cantidad", 1)),
            })
    additional = []
    for row in _json_list(order.additional_works_data):
        if isinstance(row, dict):
            additional.append({
                "id": row.get("additional_work_id"),
                "name": row.get("name"),
                "type": row.get("type"),
                "material": row.get("materialName") or row.get("material_name"),
                "linear_meters": row.get("linear_meters", row.get("metros_lineales")),
                "quantity": row.get("quantity", row.get("cantidad", 1)),
            })
    return {"materials": materials, "fabrication": fabrication, "additional": additional}


def measurement_fingerprint(snapshot: dict) -> str:
    encoded = json.dumps(snapshot, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def _candidate_rows(order: WorkOrder) -> tuple[list, list, list, list]:
    materials = deepcopy(_json_list(order.materials_data))
    fabrication = deepcopy(_json_list(order.fabrication_details))
    additional = deepcopy(_json_list(order.additional_works_data))
    pools = deepcopy(_json_list(order.pools_data))

    # Material-linked m² fabrication rows use the agreed $/m² snapshot. This
    # makes the candidate independent from a stale derived `price` field.
    for row in fabrication:
        if not isinstance(row, dict):
            continue
        concept = str(row.get("concept") or row.get("concepto") or "").upper()
        price_m2 = float(row.get("material_price_m2") or row.get("price_m2") or 0)
        if concept in _M2_CONCEPTS and price_m2 > 0:
            length = measurement_number(row.get("length") or row.get("largo"))
            width = measurement_number(row.get("width") or row.get("ancho"))
            row["price"] = round(length * width * price_m2, 2)

    # A frente is linear, not m². Rebuild its current total from the frozen
    # formula inputs when available, never from a client-supplied total.
    for row in additional:
        if not isinstance(row, dict) or str(row.get("type") or "").lower() != "frente":
            continue
        meters = measurement_number(row.get("linear_meters") or row.get("metros_lineales"))
        formula = row.get("formula_values") or {}
        price_m2 = float(formula.get("material_price_m2_at_selection") or 0)
        multiplier = float(formula.get("multiplier") or 0)
        if meters > 0 and price_m2 > 0 and multiplier > 0:
            row["total"] = round(price_m2 * 0.13 * multiplier * meters, 2)
        elif meters > 0 and float(row.get("price") or 0) > 0:
            row["total"] = round(float(row["price"]) * meters, 2)

    return materials, fabrication, additional, pools


def _latest_breakdown_lines(order: WorkOrder, db: Session) -> dict[str, dict]:
    approval = (
        db.query(WorkOrderMeasurementApproval)
        .filter(WorkOrderMeasurementApproval.work_order_id == order.id)
        .order_by(WorkOrderMeasurementApproval.id.desc())
        .first()
    )
    if not approval or not approval.approval_breakdown:
        return {}
    try:
        breakdown = ApprovalBreakdown.model_validate(json.loads(approval.approval_breakdown))
    except (TypeError, ValueError):
        return {}
    lines = {
        line.line_key: line.model_dump(mode="json")
        for piece in breakdown.pieces
        for line in piece.lines
    }
    lines.update({line.line_key: line.model_dump(mode="json") for line in breakdown.global_lines})
    return lines


def _line_key(row: dict, index: int, kind: str) -> str:
    material = row.get("material") or row.get("materialName") or row.get("material_name") or row.get("name") or ""
    return f"{kind}:{row.get('id') or row.get('additional_work_id') or material or index}:{index}"


def _apply_previous_breakdown_baseline(
    rows: list,
    kind: str,
    previous_lines: dict[str, dict],
) -> list:
    result = deepcopy(rows)
    for index, row in enumerate(result):
        if not isinstance(row, dict):
            continue
        previous = previous_lines.get(_line_key(row, index, kind))
        if not previous:
            continue
        approved = previous.get("subtotal_approved") or {}
        measurement = previous.get("measurement_approved") or {}
        if kind == "material":
            row["m2_budgeted"] = (
                float(measurement.get("length") or 0)
                * float(measurement.get("width") or 0)
                * float(measurement.get("quantity") or 1)
            )
        elif kind == "fabrication":
            concept = str(row.get("concept") or row.get("concepto") or "").upper()
            if concept in _M2_CONCEPTS:
                row["m2_budgeted"] = (
                    float(measurement.get("length") or 0)
                    * float(measurement.get("width") or 0)
                    * float(measurement.get("quantity") or 1)
                )
            elif concept in _LINEAR_CONCEPTS:
                row["linear_meters_budgeted"] = float(measurement.get("length") or 0) * float(measurement.get("quantity") or 1)
            row["total_usd_budgeted"] = approved.get("usd")
            row["total_ars_budgeted"] = approved.get("ars")
        elif kind == "additional":
            if str(row.get("type") or "").lower() == "frente":
                row["linear_meters_budgeted"] = measurement.get("linear_meters")
            row["total_usd_budgeted"] = approved.get("usd")
            row["total_ars_budgeted"] = approved.get("ars")
    return result


def _candidate(order: WorkOrder, db: Session) -> tuple[dict, dict, list[dict]]:
    materials, fabrication, additional, pools = _candidate_rows(order)
    data = {
        "usd_rate": order.usd_rate,
        "transport": order.transport,
        "transport_usd": order.transport_usd,
        "discount_enabled": order.discount_enabled,
        "discount_target": order.discount_target,
        "discount_percentage": order.discount_percentage,
        "discount_fixed_amount": order.discount_fixed_amount,
        "payment_method": order.payment_method,
        "payment_method_id": order.payment_method_id,
        "installments": order.installments,
        "apply_cash_discount": order.apply_cash_discount,
        "deposit_received": order.deposit_received,
        "deposit_usd": order.deposit_usd,
        "deposit_currency": order.deposit_currency,
        "materials_data": json.dumps(materials, ensure_ascii=False),
        "fabrication_details": json.dumps(fabrication, ensure_ascii=False),
        "additional_works_data": json.dumps(additional, ensure_ascii=False),
        "pools_data": json.dumps(pools, ensure_ascii=False),
    }
    recalculate_totals_from_items(db, data)
    previous_lines = _latest_breakdown_lines(order, db)
    comparison = _build_measurement_comparison(
        _apply_previous_breakdown_baseline(materials, "material", previous_lines),
        float(order.usd_rate or 0),
        json.dumps(_apply_previous_breakdown_baseline(fabrication, "fabrication", previous_lines), ensure_ascii=False),
        json.dumps(_apply_previous_breakdown_baseline(additional, "additional", previous_lines), ensure_ascii=False),
    )
    return data, {
        "positive_difference_ars": round(sum(max(0, r["subtotal_ars"]) for r in comparison), 2),
        "negative_difference_ars": round(sum(min(0, r["subtotal_ars"]) for r in comparison), 2),
        "raw_difference_ars": round(sum(r["subtotal_ars"] for r in comparison), 2),
        "raw_difference_usd": round(sum(r["subtotal_usd"] for r in comparison), 2),
    }, comparison


def _amount(native: float, currency: str, usd_rate: float) -> dict:
    currency = "USD" if str(currency).upper() == "USD" else "ARS"
    native = round(float(native or 0), 2)
    ars = native * usd_rate if currency == "USD" else native
    usd = native if currency == "USD" else (native / usd_rate if usd_rate > 0 else 0)
    return {
        "ars": round(ars, 2),
        "usd": round(usd, 2),
        "native": native,
        "currency": currency,
    }


def _measurement(row: dict, *, linear: bool = False) -> dict:
    return {
        "length": measurement_number(row.get("length") or row.get("largo")),
        "width": measurement_number(row.get("width") or row.get("ancho")),
        "quantity": measurement_number(row.get("quantity") or row.get("cantidad"), default=1),
        "linear_meters": measurement_number(row.get("linear_meters") or row.get("metros_lineales")) if linear else None,
    }


def _baseline_measurement(row: dict, *, linear: bool = False) -> dict | None:
    if linear and row.get("linear_meters_budgeted") is not None:
        return {"length": None, "width": None, "quantity": None, "linear_meters": float(row["linear_meters_budgeted"])}
    if not linear and row.get("length_budgeted") is not None and row.get("width_budgeted") is not None:
        return {
            "length": float(row["length_budgeted"]),
            "width": float(row["width_budgeted"]),
            "quantity": float(row.get("quantity_budgeted") or 1),
            "linear_meters": None,
        }
    return None


def _line_amount(row: dict, approved: bool, usd_rate: float, kind: str) -> tuple[dict, dict | None]:
    currency = str(row.get("currency") or row.get("moneda") or "ARS").upper()
    if kind == "material":
        measure = _measurement(row)
        unit_price = (
            row.get("price_m2_usd") or row.get("precio_m2_usd")
            if currency == "USD"
            else row.get("price_m2") or row.get("precio_m2")
        )
        native = (
            measure["length"] * measure["width"] * measure["quantity"]
            * float(unit_price or row.get("material_price_m2") or 0)
        )
        before_measure = float(row.get("m2_budgeted") or 0)
        before = before_measure * float(unit_price or row.get("material_price_m2") or 0)
        return _amount(native if approved else before, currency, usd_rate), measure if approved else _baseline_measurement(row)
    if kind == "fabrication":
        concept = str(row.get("concept") or row.get("concepto") or "").upper()
        measure = _measurement(row, linear=concept in _LINEAR_CONCEPTS)
        if concept in _M2_CONCEPTS:
            current_measure = measure["length"] * measure["width"] * measure["quantity"]
            before_measure = float(row.get("m2_budgeted") or 0)
        elif concept in _LINEAR_CONCEPTS:
            current_measure = measure["length"] * measure["quantity"]
            before_measure = float(row.get("linear_meters_budgeted") or 0)
        else:
            current_measure = float(row.get("quantity") or row.get("cantidad") or 1)
            before_measure = float(row.get("quantity") or row.get("cantidad") or 1)
        stored_price = float(row.get("price") or row.get("precio") or 0)
        price_m2 = float(row.get("material_price_m2") or row.get("price_m2") or 0)
        before = row.get("total_usd_budgeted") if currency == "USD" else row.get("total_ars_budgeted")
        before_native = float(before) if before is not None else before_measure * (stored_price or price_m2)
        current_native = stored_price * measure["quantity"] if stored_price > 0 else current_measure * price_m2
        return _amount(current_native if approved else before_native, currency, usd_rate), measure if approved else _baseline_measurement(row, linear=concept in _LINEAR_CONCEPTS)
    measure = _measurement(row, linear=str(row.get("type") or "").lower() == "frente")
    current = float(row.get("total") or row.get("price") or 0) * float(row.get("quantity") or row.get("cantidad") or 1)
    if str(row.get("type") or "").lower() == "frente":
        current = float(row.get("total") or 0)
    before = row.get("total_usd_budgeted") if currency == "USD" else row.get("total_ars_budgeted")
    if kind == "pool":
        before = current
    return _amount(current if approved else float(before or 0), currency, usd_rate), measure if approved else _baseline_measurement(row, linear=str(row.get("type") or "").lower() == "frente")


def _breakdown_line(
    row: dict,
    index: int,
    kind: str,
    usd_rate: float,
    previous_line: dict | None = None,
) -> dict:
    approved, approved_measure = _line_amount(row, True, usd_rate, kind)
    if previous_line:
        before = previous_line.get("subtotal_approved") or _amount(0, approved["currency"], usd_rate)
        before_measure = previous_line.get("measurement_approved")
    else:
        before, before_measure = _line_amount(row, False, usd_rate, kind)
    measure_before = before_measure
    concept = str(row.get("concept") or row.get("type") or kind).upper()
    material = row.get("material") or row.get("materialName") or row.get("material_name") or row.get("name")
    if kind == "material":
        unit_price = (
            row.get("price_m2_usd") or row.get("precio_m2_usd")
            if approved["currency"] == "USD"
            else row.get("price_m2") or row.get("precio_m2")
        )
    else:
        unit_price = row.get("price_m2") or row.get("price_m2_usd") or row.get("material_price_m2") or row.get("price") or 0
    breakdown = {
        "line_key": f"{kind}:{row.get('id') or row.get('additional_work_id') or material or index}:{index}",
        "concept_type": concept,
        "material": material,
        "measurement_before": measure_before,
        "measurement_approved": approved_measure,
        "unit_price": float(unit_price or 0),
        "line_kind": kind,
        "currency": approved["currency"],
        "subtotal_before": before,
        "subtotal_approved": approved,
        "difference": {
            "ars": round(approved["ars"] - before["ars"], 2),
            "usd": round(approved["usd"] - before["usd"], 2),
            "native": round(approved["native"] - before["native"], 2),
            "currency": approved["currency"],
        },
    }
    return breakdown


def _piece_descriptors(order: WorkOrder) -> list[dict]:
    pieces = _json_list(order.pieces_data)
    result = []
    for index, piece in enumerate(pieces):
        if not isinstance(piece, dict):
            continue
        names = set()
        main = piece.get("mainMaterial")
        if isinstance(main, dict) and main.get("name"):
            names.add(str(main["name"]))
        for row in piece.get("mainMaterialRows") or []:
            if isinstance(row, dict) and row.get("name"):
                names.add(str(row["name"]))
        for row in piece.get("alternativeMaterials") or []:
            if isinstance(row, dict) and row.get("name"):
                names.add(str(row["name"]))
        result.append({
            "piece_key": f"piece:{piece.get('id') or index + 1}",
            "piece_id": str(piece.get("id")) if piece.get("id") is not None else None,
            "name": str(piece.get("name") or f"Pieza {index + 1}"),
            "materials": names,
            "lines": [],
        })
    return result


def _all_breakdown_lines(breakdown_pieces: list[dict], global_lines: list[dict]) -> list[dict]:
    return [line for piece in breakdown_pieces for line in piece["lines"]] + global_lines


def _line_subtotal(lines: list[dict], side: str, usd_rate: float) -> dict:
    totals = {"material": {"ars": 0.0, "usd": 0.0}, "fabrication": {"ars": 0.0, "usd": 0.0}, "pool": {"ars": 0.0, "usd": 0.0}, "additional": {"ars": 0.0, "usd": 0.0}}
    for line in lines:
        amount = line[f"subtotal_{side}"]
        kind = line.get("line_kind", "additional")
        if kind not in totals:
            kind = "additional"
        totals[kind]["ars"] += amount["ars"]
        totals[kind]["usd"] += amount["usd"]
    ars = 0.0
    usd = 0.0
    for family in totals.values():
        ars += family["ars"]
        usd += family["usd"]
    return {"ars": round(ars, 2), "usd": round(usd, 2), "native": round(ars, 2), "currency": "ARS"}


def _dual_adjustment(before_ars: float, approved_ars: float, before_usd: float, approved_usd: float) -> dict:
    return {
        "before": round(before_ars, 2),
        "approved": round(approved_ars, 2),
        "difference": round(approved_ars - before_ars, 2),
        "currency": "ARS",
        "before_usd": round(before_usd, 2),
        "approved_usd": round(approved_usd, 2),
        "difference_usd": round(approved_usd - before_usd, 2),
    }


def _approval_breakdown(order: WorkOrder, candidate_data: dict, db: Session) -> dict:
    materials, fabrication, additional, pools = _candidate_rows(order)
    rate = float(order.usd_rate or 0)
    previous_lines = _latest_breakdown_lines(order, db)
    pieces = _piece_descriptors(order) or [{"piece_key": "piece:legacy", "piece_id": None, "name": "Trabajos de la orden", "materials": set(), "lines": []}]
    global_lines = []
    for kind, rows in (
        ("material", materials),
        ("fabrication", fabrication),
        ("additional", additional),
        ("pool", pools),
    ):
        for index, row in enumerate(rows):
            if not isinstance(row, dict):
                continue
            if kind == "material" and bool(row.get("is_alternative") or row.get("es_alternativa")):
                continue
            material = str(row.get("material") or row.get("materialName") or row.get("material_name") or row.get("name") or "")
            if kind in {"additional", "pool"} and material.upper() in {"", "__GLOBAL__", "POOL_MATERIAL_GLOBAL"}:
                global_lines.append(_breakdown_line(row, index, kind, rate, previous_lines.get(_line_key(row, index, kind))))
                continue
            target = next((piece for piece in pieces if material in piece["materials"]), pieces[0])
            target["lines"].append(_breakdown_line(row, index, kind, rate, previous_lines.get(_line_key(row, index, kind))))
    for piece in pieces:
        piece.pop("materials", None)
        lines = piece["lines"]
        piece["subtotal_before"] = {"ars": round(sum(x["subtotal_before"]["ars"] for x in lines), 2), "usd": round(sum(x["subtotal_before"]["usd"] for x in lines), 2), "native": 0, "currency": "ARS"}
        piece["subtotal_approved"] = {"ars": round(sum(x["subtotal_approved"]["ars"] for x in lines), 2), "usd": round(sum(x["subtotal_approved"]["usd"] for x in lines), 2), "native": 0, "currency": "ARS"}
        piece["difference"] = {"ars": round(sum(x["difference"]["ars"] for x in lines), 2), "usd": round(sum(x["difference"]["usd"] for x in lines), 2), "native": 0, "currency": "ARS"}
    all_lines = _all_breakdown_lines(pieces, global_lines)
    line_before = _line_subtotal(all_lines, "before", rate)
    line_approved = _line_subtotal(all_lines, "approved", rate)
    original_base = float(order.subtotal or 0) + float(order.transport or 0)
    original_base_usd = float(order.subtotal_usd or 0) + float(order.transport_usd or 0)
    pct = float(order.discount_percentage or 0) if order.discount_enabled else 0
    fixed = float(order.discount_fixed_amount or 0) if order.discount_enabled else 0
    commercial = _commercial_breakdown(db, order, candidate_data)
    discount_before = min(original_base, max(0.0, original_base * pct / 100 + fixed))
    discount_approved = commercial["commercial_discount_ars"]
    discount_before_usd = min(original_base_usd, max(0.0, original_base_usd * pct / 100 + fixed / rate if rate > 0 else 0))
    discount_approved_usd = commercial["commercial_discount_usd"]
    baseline_total_exact = float(
        order.total_exact_ars if order.total_exact_ars is not None else order.total or 0
    )
    baseline_total_contractual = float(
        order.total_contractual_ars
        if order.total_contractual_ars is not None
        else order.total or 0
    )
    baseline_total_exact_usd = float(
        order.total_exact_usd if order.total_exact_usd is not None else order.total_usd or 0
    )
    surcharge_before = baseline_total_exact - (original_base - discount_before)
    surcharge_approved = commercial["catalogue_adjustment_ars"]
    surcharge_before_usd = baseline_total_exact_usd - (original_base_usd - discount_before_usd)
    surcharge_approved_usd = commercial["catalogue_adjustment_usd"]
    subtotal_before = _amount(float(order.subtotal or 0), "ARS", rate)
    subtotal_approved = _amount(float(candidate_data["subtotal"]), "ARS", rate)
    exact_total_before = _amount(baseline_total_exact, "ARS", rate)
    exact_total_approved = _amount(float(candidate_data["total"]), "ARS", rate)
    contractual_before = {"contractual_ars": baseline_total_contractual}
    contractual_approved = contractual_totals(float(candidate_data["total"]), rate)
    total_before = _amount(contractual_before["contractual_ars"], "ARS", rate)
    total_approved = _amount(contractual_approved["contractual_ars"], "ARS", rate)
    reconstructed_before = _amount(line_before["ars"] + float(order.transport or 0) - discount_before + surcharge_before, "ARS", rate)
    reconstructed_before["usd"] = round(line_before["usd"] + float(order.transport_usd or 0) - discount_before_usd + surcharge_before_usd, 2)
    reconstructed_approved = _amount(line_approved["ars"] + float(candidate_data.get("transport") or 0) - discount_approved + surcharge_approved, "ARS", rate)
    reconstructed_approved["usd"] = round(line_approved["usd"] + float(candidate_data.get("transport_usd") or 0) - discount_approved_usd + surcharge_approved_usd, 2)
    subtotal_error_ars = round(line_approved["ars"] - float(candidate_data["subtotal"]), 2)
    subtotal_error_usd = round(line_approved["usd"] - float(candidate_data["subtotal_usd"]), 2)
    total_error_ars = round(reconstructed_approved["ars"] - float(candidate_data["total"]), 2)
    total_error_usd = round(reconstructed_approved["usd"] - float(candidate_data["total_usd"]), 2)
    breakdown = {
        "version": 1, "usd_rate": rate, "rounding_policy": _ROUNDING_POLICY,
        "pieces": pieces, "global_lines": global_lines,
        "transport": _dual_adjustment(float(order.transport or 0), float(candidate_data.get("transport") or 0), float(order.transport_usd or 0), float(candidate_data.get("transport_usd") or 0)),
        "discount": _dual_adjustment(-discount_before, -discount_approved, -discount_before_usd, -discount_approved_usd),
        "surcharge": _dual_adjustment(surcharge_before, surcharge_approved, surcharge_before_usd, surcharge_approved_usd),
        "subtotal_before": subtotal_before, "subtotal_approved": subtotal_approved,
        "total_before": total_before, "total_approved": total_approved,
        "exact_total_before": exact_total_before, "exact_total_approved": exact_total_approved,
        "difference": {"ars": round(total_approved["ars"] - total_before["ars"], 2), "usd": round(total_approved["usd"] - total_before["usd"], 2), "native": round(total_approved["native"] - total_before["native"], 2), "currency": "ARS"},
        "reconciliation": {
            "line_subtotal_before": line_before,
            "line_subtotal_approved": line_approved,
            "subtotal_error_ars": subtotal_error_ars,
            "subtotal_error_usd": subtotal_error_usd,
            "total_reconstructed_before": reconstructed_before,
            "total_reconstructed_approved": reconstructed_approved,
            "total_error_ars": total_error_ars,
            "total_error_usd": total_error_usd,
            "precision_error_ars": total_error_ars,
            "precision_error_usd": total_error_usd,
            "is_reconciled": abs(subtotal_error_ars) <= 0.01 and abs(subtotal_error_usd) <= 0.01 and abs(total_error_ars) <= 0.01 and abs(total_error_usd) <= 0.01,
        },
    }
    exact_values = contractual_totals(float(candidate_data["total"]), rate)
    breakdown["exact_total_approved"] = {
        "ars": exact_values["exact_ars"],
        "usd": exact_values["exact_usd"],
        "native": exact_values["exact_ars"],
        "currency": "ARS",
    }
    breakdown["rounding_adjustment"] = {
        "before": 0.0,
        "approved": exact_values["adjustment_ars"],
        "difference": exact_values["adjustment_ars"],
        "currency": "ARS",
        "before_usd": 0.0,
        "approved_usd": exact_values["adjustment_usd"],
        "difference_usd": exact_values["adjustment_usd"],
    }
    return ApprovalBreakdown.model_validate(breakdown).model_dump(mode="json")


def _is_explicitly_new(row: dict) -> bool:
    """Only an explicit marker may turn a missing baseline into a new line."""
    return bool(row.get("is_new") is True or row.get("measurement_origin") == "new")


def _missing_snapshot_labels(
    materials: list,
    fabrication: list,
    additional: list,
) -> list[str]:
    """Find lines whose original measurement cannot be established safely.

    A missing/zero baseline is never inferred to mean "new". New lines must
    carry the explicit ``is_new``/``measurement_origin`` marker from the form.
    """
    missing: list[str] = []
    for row in materials:
        if not isinstance(row, dict) or bool(row.get("is_alternative") or row.get("es_alternativa")):
            continue
        length = measurement_number(row.get("length") or row.get("largo"))
        width = measurement_number(row.get("width") or row.get("ancho"))
        quantity = measurement_number(row.get("quantity") or row.get("cantidad"), default=1)
        if length * width * quantity <= 0 or _is_explicitly_new(row):
            continue
        snapshot = row.get("m2_budgeted")
        if snapshot is None or float(snapshot or 0) <= 0:
            missing.append(f"Mesada {row.get('name') or row.get('nombre') or '(sin nombre)'}: m² presupuestados")

    for row in fabrication:
        if not isinstance(row, dict) or _is_explicitly_new(row):
            continue
        concept = str(row.get("concept") or row.get("concepto") or "").upper()
        length = measurement_number(row.get("length") or row.get("largo"))
        width = measurement_number(row.get("width") or row.get("ancho"))
        quantity = measurement_number(row.get("quantity") or row.get("cantidad"), default=1)
        if concept in _M2_CONCEPTS:
            measure = length * width * quantity
            key = "m2_budgeted"
            unit = "m²"
        elif concept in _LINEAR_CONCEPTS:
            measure = length * quantity
            key = "linear_meters_budgeted"
            unit = "ml"
        else:
            continue
        if measure > 0 and (row.get(key) is None or float(row.get(key) or 0) <= 0):
            label = row.get("custom_concept") or row.get("detail") or concept or "Trabajo"
            missing.append(f"{label} {row.get('material') or row.get('material_name') or ''}: {unit} presupuestados")

    for row in additional:
        if not isinstance(row, dict) or _is_explicitly_new(row):
            continue
        name = row.get("name") or "Trabajo adicional"
        if str(row.get("type") or "").lower() == "frente":
            meters = measurement_number(row.get("linear_meters") or row.get("metros_lineales"))
            if meters > 0 and (
                row.get("linear_meters_budgeted") is None
                or float(row.get("linear_meters_budgeted") or 0) <= 0
            ):
                missing.append(f"{name}: metros lineales presupuestados")
            continue
        amount = float(row.get("total") or row.get("price") or 0) * float(row.get("quantity") or 1)
        if amount > 0 and row.get("total_ars_budgeted") is None and row.get("total_usd_budgeted") is None:
            missing.append(f"{name}: importe presupuestado")
    return missing


def _commercial_breakdown(db: Session, order: WorkOrder, candidate_data: dict) -> dict:
    """Return identifiable current commercial layers and their net variation."""
    def variant(**overrides):
        data = deepcopy(candidate_data)
        data.update(overrides)
        recalculate_totals_from_items(db, data)
        return data

    no_commercial = variant(
        discount_enabled=False,
        discount_percentage=0,
        discount_fixed_amount=0,
        payment_method=None,
        payment_method_id=None,
        apply_cash_discount=False,
    )
    manual_only = variant(
        payment_method=None,
        payment_method_id=None,
        apply_cash_discount=False,
    )
    current_total = float(candidate_data["total"])
    base_total = float(no_commercial["total"])
    manual_total = float(manual_only["total"])
    current_discount = round(max(0.0, base_total - manual_total), 2)
    catalogue_adjustment = round(current_total - manual_total, 2)
    current_adjustment = round(current_total - base_total, 2)
    original_base = float(order.subtotal or 0) + float(order.transport or 0)
    original_adjustment = round(
        float(order.total_exact_ars if order.total_exact_ars is not None else order.total or 0)
        - original_base,
        2,
    )
    adjustment_delta = round(current_adjustment - original_adjustment, 2)
    return {
        "commercial_discount_ars": current_discount,
        "commercial_discount_usd": round(float(no_commercial["total_usd"]) - float(manual_only["total_usd"]), 2),
        "catalogue_adjustment_ars": catalogue_adjustment,
        "catalogue_adjustment_usd": round(float(candidate_data["total_usd"]) - float(manual_only["total_usd"]), 2),
        "commercial_adjustment_delta_ars": adjustment_delta,
        "reconciled_difference_ars": round(
            float(candidate_data["total"]) - float(order.total or 0), 2
        ),
    }


def _paid_balances(db: Session, order: WorkOrder) -> tuple[float, float]:
    movements = db.query(CashMovement).filter(
        CashMovement.order_id == order.id,
        CashMovement.type == "INCOME",
    ).all()
    if not movements:
        rate = float(order.usd_rate or 0)
        paid_ars = float(order.deposit_usd or 0) * rate if str(order.deposit_currency or "ARS").upper() == "USD" else float(order.deposit_received or 0)
        paid_usd = float(order.deposit_usd or 0) if str(order.deposit_currency or "ARS").upper() == "USD" else (paid_ars / rate if rate > 0 else 0)
        return paid_ars, paid_usd
    rate = float(order.usd_rate or 0)
    paid_ars = sum(movement_ars(m) for m in movements)
    paid_usd = sum(
        float(m.amount or 0) if str(m.currency or "ARS").upper() == "USD"
        else (movement_ars(m) / rate if rate > 0 else 0)
        for m in movements
    )
    return paid_ars, paid_usd


def build_measurement_adjustment(order: WorkOrder, db: Session) -> dict:
    if order.budget_id is None:
        raise ValidationError("Solo las órdenes convertidas desde un presupuesto pueden aprobar diferencias de medición.")
    data, raw, comparison = _candidate(order, db)
    contractual = contractual_totals(float(data["total"]), order.usd_rate)
    baseline_exact_ars = float(
        order.total_exact_ars
        if order.total_exact_ars is not None
        else order.total or 0
    )
    baseline_exact_usd = float(
        order.total_exact_usd
        if order.total_exact_usd is not None
        else order.total_usd or 0
    )
    exact_difference_ars = round(float(data["total"]) - baseline_exact_ars, 2)
    exact_difference_usd = round(float(data["total_usd"]) - baseline_exact_usd, 2)
    baseline_contractual_ars = float(
        order.total_contractual_ars
        if order.total_contractual_ars is not None
        else order.total or 0
    )
    baseline_contractual_usd = float(
        order.total_contractual_usd
        if order.total_contractual_usd is not None
        else order.total_usd or 0
    )
    difference_ars = round(contractual["contractual_ars"] - baseline_contractual_ars, 2)
    difference_usd = round(contractual["contractual_usd"] - baseline_contractual_usd, 2)
    if abs(exact_difference_ars) <= 0.005 and abs(exact_difference_usd) <= 0.005:
        raise ValidationError("No existen diferencias económicas pendientes de aprobación.")
    materials, fabrication, additional, _ = _candidate_rows(order)
    missing_snapshots = _missing_snapshot_labels(materials, fabrication, additional)
    commercial = _commercial_breakdown(db, order, data)
    breakdown = _approval_breakdown(order, data, db)
    breakdown_line_delta_ars = round(
        breakdown["reconciliation"]["line_subtotal_approved"]["ars"]
        - breakdown["reconciliation"]["line_subtotal_before"]["ars"],
        2,
    )
    commercial_delta_ars = round(
        breakdown["transport"]["difference"]
        + breakdown["discount"]["difference"]
        + breakdown["surcharge"]["difference"],
        2,
    )
    reconciliation_error = round(
        breakdown_line_delta_ars + commercial_delta_ars - exact_difference_ars,
        2,
    )
    blocking_reasons = [
        f"Faltan datos históricos: {', '.join(missing_snapshots)}"
    ] if missing_snapshots else []
    if abs(reconciliation_error) > 1.0:
        blocking_reasons.append(
            "La diferencia bruta no se puede reconciliar con los ajustes comerciales identificables."
        )
    reconciliation = breakdown["reconciliation"]
    if not reconciliation["is_reconciled"]:
        blocking_reasons.append(
            "El desglose comercial no reconstruye exactamente el subtotal o el total aprobado."
        )
    snapshot = measurement_snapshot(order)
    fingerprint = measurement_fingerprint(snapshot)
    paid_ars, paid_usd = _paid_balances(db, order)
    return {
        "work_order_id": order.id,
        "measurement_fingerprint": fingerprint,
        "measurement_snapshot": snapshot,
        "original_total": float(order.total or 0),
        "original_total_usd": float(order.total_usd or 0),
        "positive_difference_ars": raw["positive_difference_ars"],
        "negative_difference_ars": raw["negative_difference_ars"],
        # Keep the historical fields as exact measurement deltas. The
        # contractual delta is explicit below and may be zero when a new
        # exact value remains inside the same ARS 5,000 bucket.
        "difference_ars": difference_ars,
        "difference_usd": difference_usd,
        "exact_difference_ars": exact_difference_ars,
        "exact_difference_usd": exact_difference_usd,
        "exact_difference_ars": exact_difference_ars,
        "exact_difference_usd": exact_difference_usd,
        # Kept for the persisted approval schema; the UI must use the explicit
        # commercial fields below and never present this as a discount.
        "discount_difference_ars": commercial["commercial_discount_ars"],
        "gross_difference_ars": raw["raw_difference_ars"],
        "gross_difference_usd": raw["raw_difference_usd"],
        "commercial_discount_ars": commercial["commercial_discount_ars"],
        "catalogue_adjustment_ars": commercial["catalogue_adjustment_ars"],
        "commercial_adjustment_delta_ars": commercial["commercial_adjustment_delta_ars"],
        "reconciliation_error_ars": reconciliation_error,
        "approval_blocked": bool(blocking_reasons),
        "blocking_reasons": blocking_reasons,
        "discount_percentage": float(order.discount_percentage or 0),
        "discount_fixed_amount": float(order.discount_fixed_amount or 0),
        "new_total": contractual["contractual_ars"],
        "new_total_usd": contractual["contractual_usd"],
        "new_total_exact_ars": contractual["exact_ars"],
        "new_total_exact_usd": contractual["exact_usd"],
        "rounding_adjustment_ars": contractual["adjustment_ars"],
        "rounding_adjustment_usd": contractual["adjustment_usd"],
        "payments_ars": round(paid_ars, 2),
        "payments_usd": round(paid_usd, 2),
        "new_balance_due": round(max(0, contractual["contractual_ars"] - paid_ars), 2),
        "new_balance_due_usd": round(max(0, contractual["contractual_usd"] - paid_usd), 2),
        "usd_rate": float(order.usd_rate or 0),
        "comparison": comparison,
        "approval_breakdown": breakdown,
    }


def approve_measurement_adjustment(
    db: Session,
    order_id: int,
    user_id: int,
    fingerprint: str,
    previous_total: float,
    previous_total_usd: float,
) -> tuple[WorkOrder, WorkOrderMeasurementApproval]:
    order = (
        db.query(WorkOrder)
        .filter(WorkOrder.id == order_id)
        .with_for_update()
        .first()
    )
    if not order:
        raise NotFoundError("Work order")
    duplicate = (
        db.query(WorkOrderMeasurementApproval.id)
        .filter(
            WorkOrderMeasurementApproval.work_order_id == order.id,
            WorkOrderMeasurementApproval.measurement_fingerprint == fingerprint,
        )
        .first()
    )
    if duplicate:
        raise ConflictError("Estas medidas ya fueron aprobadas.")
    proposal = build_measurement_adjustment(order, db)
    if proposal.get("approval_blocked"):
        raise ValidationError(
            "No se puede confirmar la diferencia: "
            + " ".join(proposal.get("blocking_reasons") or [])
        )
    if proposal["measurement_fingerprint"] != fingerprint:
        raise ConflictError("Las medidas cambiaron. Vuelva a revisar las diferencias.")
    if abs(float(order.total or 0) - previous_total) > 0.005 or abs(float(order.total_usd or 0) - previous_total_usd) > 0.005:
        raise ConflictError("El importe de la orden cambió. Vuelva a revisar las diferencias.")

    order.total = proposal["new_total"]
    order.total_usd = proposal["new_total_usd"]
    order.total_exact_ars = proposal["new_total_exact_ars"]
    order.total_exact_usd = proposal["new_total_exact_usd"]
    order.rounding_adjustment_ars = proposal["rounding_adjustment_ars"]
    order.rounding_adjustment_usd = proposal["rounding_adjustment_usd"]
    order.total_contractual_ars = proposal["new_total"]
    order.total_contractual_usd = proposal["new_total_usd"]
    # Keep the current commercial breakdown aligned with the approved total;
    # the original total remains immutable in the append-only approval row.
    candidate_data, _, _ = _candidate(order, db)
    order.subtotal = float(candidate_data["subtotal"])
    order.subtotal_usd = float(candidate_data["subtotal_usd"])
    order.balance_due, order.balance_due_usd = proposal["new_balance_due"], proposal["new_balance_due_usd"]
    order.balance_paid = order.balance_due <= 0.001
    approval = WorkOrderMeasurementApproval(
        work_order_id=order.id,
        approved_by_user_id=user_id,
        previous_total=previous_total,
        previous_total_usd=previous_total_usd,
        positive_difference_ars=proposal["positive_difference_ars"],
        negative_difference_ars=proposal["negative_difference_ars"],
        difference_ars=proposal["difference_ars"],
        difference_usd=proposal["difference_usd"],
        discount_difference_ars=proposal["discount_difference_ars"],
        new_total=proposal["new_total"],
        new_total_usd=proposal["new_total_usd"],
        new_total_exact_ars=proposal["new_total_exact_ars"],
        new_total_exact_usd=proposal["new_total_exact_usd"],
        rounding_adjustment_ars=proposal["rounding_adjustment_ars"],
        rounding_adjustment_usd=proposal["rounding_adjustment_usd"],
        usd_rate=proposal["usd_rate"],
        measurement_fingerprint=fingerprint,
        measurement_snapshot=json.dumps(proposal["measurement_snapshot"], ensure_ascii=False, sort_keys=True),
        approval_breakdown=json.dumps(proposal["approval_breakdown"], ensure_ascii=False, sort_keys=True),
    )
    try:
        db.add(approval)
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(order)
    return order, approval
