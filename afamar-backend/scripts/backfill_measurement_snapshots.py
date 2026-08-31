#!/usr/bin/env python3
"""Backfill dimensional + money snapshots onto legacy work_order rows.

The COMPARATIVA DE MEDICIÓN ("Presupuestado / Real / Diferencia") reads the
`m2_budgeted` / `linear_meters_budgeted` / `total_*_budgeted` snapshots that
`WorkOrderService.create_from_budget` writes inside each row's JSON. Those
snapshots only exist for work orders converted AFTER the feature was added
(sessions 2026-08-26 for money, 2026-08-30 for dimensions). Older OTs and OTs
that re-froze detail rows post-conversion therefore display "—" / "$0,00" on
those columns — and that conceals REAL changes (e.g. A-000003's frente went
from 2,5 ml → 3 ml but the comparison showed $0,00).

This script re-hydrates the missing snapshots by reading the source budget
(`work_order.budget_id`) and matching each WO row against the corresponding
budget row. It is idempotent (only fills missing keys, never clobbers
existing snapshots) and runs as a dry-run by default.

Usage:
    python scripts/backfill_measurement_snapshots.py             # dry-run
    python scripts/backfill_measurement_snapshots.py --fix       # apply
    python scripts/backfill_measurement_snapshots.py --fix --work-order 3   # scope
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any

# Add project root to path so we can import app modules
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select

from app.core.settings import settings
from app.db.session import SessionLocal
from app.models.budget import Budget
from app.models.work_order import WorkOrder


# Mirrors create_from_budget (work_order.py) — keep in sync.
FAB_M2_CONCEPTS = {"LENGTH", "BASEBOARD", "FRONT", "LARGO", "ZOCALOS", "FRENTE"}
FAB_LINEAR_CONCEPTS = {"TERMINACION"}


def _parse_json_list(raw: Any) -> list:
    """Best-effort parse of a JSON-text-or-list column into a list."""
    if raw is None or raw == "":
        return []
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, list) else []
        except (ValueError, TypeError):
            return []
    return []


def _normalized_concept(value: Any) -> str:
    return str(value or "").strip().upper()


def _row_snapshot_fields(row: dict, *, is_m2: bool, is_linear: bool, usd_rate: float) -> dict:
    """Compute `m2_budgeted` / `linear_meters_budgeted` / `total_*_budgeted`
    for a single row, mirroring `create_from_budget`."""
    out: dict = {}
    length = float(row.get("length") or row.get("largo") or 0)
    width = float(row.get("width") or row.get("ancho") or 0)
    quantity = float(row.get("quantity") or row.get("cantidad") or 1)
    if is_m2:
        out["m2_budgeted"] = length * width * quantity
    elif is_linear:
        out["linear_meters_budgeted"] = length * quantity
    # Money snapshots — same formula as create_from_budget for fabrication rows.
    currency = "USD" if str(row.get("currency") or "").upper() == "USD" else "ARS"
    if "price" in row or "quantity" in row:
        total = float(row.get("price") or 0) * float(row.get("quantity") or 1)
    elif "total" in row:
        total = float(row.get("total") or 0)
    else:
        total = float(row.get("unit_price") or 0) * float(row.get("quantity") or 1)
    out["total_ars_budgeted"] = (
        total if currency == "ARS" else (total * usd_rate if usd_rate > 0 else 0)
    )
    out["total_usd_budgeted"] = (
        total if currency == "USD" else (total / usd_rate if usd_rate > 0 else 0)
    )
    return out


def _aw_snapshot_fields(row: dict, *, usd_rate: float) -> dict:
    """Compute snapshots for an additional-works row (frente / flat)."""
    out: dict = {}
    is_frente = str(row.get("type") or "").lower() == "frente"
    if is_frente and "linear_meters" in row:
        out["linear_meters_budgeted"] = float(row.get("linear_meters") or 0)
    # Money snapshot — prefer `total`, fall back to price × quantity.
    total = float(row.get("total") or 0)
    if total == 0:
        total = float(row.get("price") or 0) * float(row.get("quantity") or 1)
    currency = "USD" if str(row.get("currency") or "").upper() == "USD" else "ARS"
    out["total_ars_budgeted"] = (
        total if currency == "ARS" else (total * usd_rate if usd_rate > 0 else 0)
    )
    out["total_usd_budgeted"] = (
        total if currency == "USD" else (total / usd_rate if usd_rate > 0 else 0)
    )
    return out


def backfill_work_order_snapshots(db, work_order: WorkOrder) -> dict:
    """Re-hydrate the missing dimensional/money snapshots on a work_order.
    Idempotent: only fills keys that are absent on the WO row, never
    clobbers existing snapshots. Returns a per-OT summary dict.
    """
    summary = {
        "fabric_added": [],
        "additional_added": [],
        "fabric_unmatched": 0,
        "additional_unmatched": 0,
        "fabric_global_skipped": 0,
        "additional_global_skipped": 0,
        "changed": False,
    }
    if work_order.budget_id is None:
        return summary

    budget = db.execute(select(Budget).where(Budget.id == work_order.budget_id)).scalar_one_or_none()
    if budget is None:
        return summary

    usd_rate = float(budget.usd_rate or settings.DEFAULT_USD_RATE)

    # ---- fabrication_details ----
    wo_fab = _parse_json_list(work_order.fabrication_details)
    bud_fab = _parse_json_list(budget.fabrication_details)
    bud_fab_remaining = list(bud_fab)
    for wo_row in wo_fab:
        if not isinstance(wo_row, dict):
            continue
        if str(wo_row.get("material") or "").strip().upper() == "POOL_MATERIAL_GLOBAL":
            summary["fabric_global_skipped"] += 1
            continue
        concept = _normalized_concept(wo_row.get("concept") or wo_row.get("concepto"))
        material = str(wo_row.get("material") or "").strip()
        match_idx = next(
            (
                i for i, b in enumerate(bud_fab_remaining)
                if isinstance(b, dict)
                and _normalized_concept(b.get("concept") or b.get("concepto")) == concept
                and str(b.get("material") or "").strip() == material
            ),
            None,
        )
        if match_idx is None:
            summary["fabric_unmatched"] += 1
            continue
        bud_row = bud_fab_remaining.pop(match_idx)
        is_m2 = concept in FAB_M2_CONCEPTS
        is_linear = concept in FAB_LINEAR_CONCEPTS
        snap = _row_snapshot_fields(bud_row, is_m2=is_m2, is_linear=is_linear, usd_rate=usd_rate)
        added = []
        for key, value in snap.items():
            if key not in wo_row or wo_row.get(key) is None:
                wo_row[key] = value
                added.append(key)
        if added:
            summary["fabric_added"].append({"material": material, "concept": concept, "keys": added})
            summary["changed"] = True

    if summary["changed"]:
        work_order.fabrication_details = json.dumps(wo_fab, ensure_ascii=False)

    # ---- additional_works_data ----
    wo_aw = _parse_json_list(work_order.additional_works_data)
    # Budget can hold its adicionales in either the new JSON column or the
    # legacy `BudgetAdicional` 1-N relation. Mirror the read in create_from_budget.
    bud_aw = _parse_json_list(budget.additional_works_data)
    if not bud_aw and budget.additional_works:
        bud_aw = [
            {
                "concept": ad.concept,
                "detail": ad.detail,
                "quantity": ad.quantity,
                "unit_price": ad.unit_price,
                "total": ad.total,
                "currency": ad.currency,
                "name": getattr(ad, "name", None),
                "type": getattr(ad, "type", None),
                "linear_meters": getattr(ad, "linear_meters", None),
                "materialName": getattr(ad, "materialName", None) or getattr(ad, "material_name", None),
            }
            for ad in budget.additional_works
        ]
    bud_aw_remaining = list(bud_aw)
    for wo_row in wo_aw:
        if not isinstance(wo_row, dict):
            continue
        raw_mat = str(wo_row.get("materialName") or wo_row.get("material_name") or "")
        if raw_mat == "POOL_MATERIAL_GLOBAL" or raw_mat.startswith("__GLOBAL__"):
            summary["additional_global_skipped"] += 1
            continue
        # Strongest match: additional_work_id.
        match_idx = next(
            (
                i for i, b in enumerate(bud_aw_remaining)
                if isinstance(b, dict)
                and wo_row.get("additional_work_id") is not None
                and b.get("additional_work_id") == wo_row.get("additional_work_id")
            ),
            None,
        )
        if match_idx is None:
            # Fallback: name + materialName (desprefijando el __ALT__:).
            wo_name = str(wo_row.get("name") or "").strip()
            wo_mat = raw_mat
            if wo_mat.startswith("__ALT__:"):
                wo_mat = wo_mat[len("__ALT__:"):]
            match_idx = next(
                (
                    i for i, b in enumerate(bud_aw_remaining)
                    if isinstance(b, dict)
                    and str(b.get("name") or "").strip() == wo_name
                    and str(b.get("materialName") or b.get("material_name") or "").strip() == wo_mat
                ),
                None,
            )
        if match_idx is None:
            summary["additional_unmatched"] += 1
            continue
        bud_row = bud_aw_remaining.pop(match_idx)
        snap = _aw_snapshot_fields(bud_row, usd_rate=usd_rate)
        added = []
        for key, value in snap.items():
            if key not in wo_row or wo_row.get(key) is None:
                wo_row[key] = value
                added.append(key)
        if added:
            summary["additional_added"].append(
                {"name": str(wo_row.get("name") or ""), "keys": added}
            )
            summary["changed"] = True

    if summary["fabric_added"] or summary["additional_added"]:
        work_order.additional_works_data = json.dumps(wo_aw, ensure_ascii=False)

    return summary


def _summary_str(label: str, items: list, field: str) -> str:
    if not items:
        return f"  {label}: 0"
    head = items[0]
    return f"  {label}: {len(items)} ({head.get(field, '?')}: +{','.join(head['keys'])})"


def main():
    parser = argparse.ArgumentParser(
        description="Backfill measurement snapshots onto legacy work orders."
    )
    parser.add_argument(
        "--fix", action="store_true",
        help="Apply the backfill (dry-run by default)",
    )
    parser.add_argument(
        "--work-order", type=int, default=None,
        help="Limit to a single work_order.id",
    )
    args = parser.parse_args()

    print(f"\n  Database: {settings.DATABASE_URL_SAFE}")
    print(f"  Environment: {settings.ENVIRONMENT}")
    print(f"  Mode: {'FIX' if args.fix else 'DRY-RUN'}\n")

    db = SessionLocal()
    try:
        stmt = select(WorkOrder).order_by(WorkOrder.id)
        if args.work_order:
            stmt = stmt.where(WorkOrder.id == args.work_order)
        orders = db.execute(stmt).scalars().all()

        totals = {
            "scanned": 0,
            "no_budget": 0,
            "changed": 0,
            "fabric_added": 0,
            "additional_added": 0,
            "fabric_unmatched": 0,
            "additional_unmatched": 0,
        }

        for wo in orders:
            totals["scanned"] += 1
            if wo.budget_id is None:
                totals["no_budget"] += 1
                continue
            budget = db.execute(select(Budget).where(Budget.id == wo.budget_id)).scalar_one_or_none()
            if budget is None:
                totals["no_budget"] += 1
                continue
            summary = backfill_work_order_snapshots(db, wo)
            totals["fabric_added"] += len(summary["fabric_added"])
            totals["additional_added"] += len(summary["additional_added"])
            totals["fabric_unmatched"] += summary["fabric_unmatched"]
            totals["additional_unmatched"] += summary["additional_unmatched"]
            if summary["changed"]:
                totals["changed"] += 1
                print(f"  WO #{wo.number} (id={wo.id}, budget={wo.budget_id}):")
                print(_summary_str("    fabrication", summary["fabric_added"], "material"))
                print(_summary_str("    adicionales", summary["additional_added"], "name"))
                if summary["fabric_unmatched"]:
                    print(f"    fabric_unmatched: {summary['fabric_unmatched']}")
                if summary["additional_unmatched"]:
                    print(f"    additional_unmatched: {summary['additional_unmatched']}")
            elif summary["fabric_added"] or summary["additional_added"]:
                # Defensive: shouldn't happen if `changed` is True, but log.
                print(f"  WO #{wo.number} (id={wo.id}): reported additions but no change")

        print("\n  -- Totals --")
        for k, v in totals.items():
            print(f"  {k}: {v}")
        print()

        if args.fix and totals["changed"]:
            db.commit()
            print(f"  Applied changes to {totals['changed']} work order(s).\n")
        elif args.fix:
            print("  No changes needed.\n")
        else:
            print("  (dry-run: no DB writes)\n")
    finally:
        db.close()


if __name__ == "__main__":
    main()
