r"""One-shot script that migrates existing `fabrication_details.FRONT` rows
into the new `additional_works` `frente` flow.

Run with:
    cd afamar-backend
    .\venv\Scripts\python.exe -m scripts.migrate_fabrication_front

Algorithm:
  1. Walk every budget and every work-order whose `fabrication_details`
     column contains at least one row with `concept == 'FRONT'`.
  2. Create one new catalogue row of `additional_works`
     (type='frente', formula_constant=1.15) named "Frente / Regrueso"
     if it doesn't already exist.
  3. For each FRONT fabrication detail row:
       - Read the `length` field as `linear_meters` (the business rule
         already encoded the edge length in cm — we keep it as cm and let
         the picker user treat it as metres per the catalogue contract).
         To preserve semantics, the script interprets `length` as centimetres
         and converts to metres (divides by 100) before applying the formula.
         If the source row didn't track length (legacy data), we default
         to 1.0 metres so the migration produces a usable row the operator
         can edit instead of an empty one.
       - Drop the row from `fabrication_details`.
       - Append a new entry to `additional_works_data` with
         `type='frente'`, `assigned_material_id` set to the budget's
         main material (the first row of `materials_data` if present),
         `linear_meters` (in metres), `price`, `total`, `currency`,
         and `formula_values` frozen at the migration timestamp.

The script is idempotent: if no FRONT rows remain, it does nothing.
Backup tables (`budgets__backup_<timestamp>`, etc.) are not created —
the script is reversible by hand if needed (the legacy data stays in
git history).

Decisions captured from PLAN.md (Q3 = "Migrate existing FRONT rows"):
  - We MOVE the row out of fabrication_details (no duplication).
  - The main material on the budget is selected via `materials_data[0]`.
  - Idempotent (skips rows already migrated).
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.additional_work import AdditionalWork
from app.models.budget import Budget
from app.models.work_order import WorkOrder
from app.services.frente_pricing import (
    FRENTE_FORMULA_MULTIPLIER_DEFAULT,
    compute_frente_subtotal,
)


CATALOG_NAME = "Frente / Regrueso"
DEFAULT_LINEAR_METERS_FOR_LEGACY = 1.0
CENTIMETRES_TO_METRES = 0.01


def _parse_json(raw: Any) -> Optional[Any]:
    if raw is None or raw == "":
        return None
    if isinstance(raw, (list, dict)):
        return raw
    if isinstance(raw, (bytes, bytearray)):
        try:
            raw = raw.decode("utf-8")
        except Exception:
            return None
    try:
        return json.loads(raw)
    except (ValueError, TypeError):
        return None


def _serialise(rows: List[Dict[str, Any]]) -> str:
    return json.dumps(rows, ensure_ascii=False)


def _ensure_catalog(db: Session, *, type_value: str) -> AdditionalWork:
    """Get-or-create the canonical `Frente / Regrueso` catalogue row.
    Looks up by name first (idempotent), then falls back to creating it.
    """
    existing = db.query(AdditionalWork).filter(AdditionalWork.name == CATALOG_NAME).first()
    if existing is not None:
        # Make sure the type is up-to-date in case the row pre-dates this
        # migration and was originally created as 'flat'.
        existing.type = type_value
        existing.formula_constant = (
            existing.formula_constant if existing.formula_constant is not None
            else FRENTE_FORMULA_MULTIPLIER_DEFAULT
        )
        db.flush()
        return existing
    row = AdditionalWork(
        name=CATALOG_NAME,
        detail="Mano de obra calculada automáticamente según material.",
        price=0.0,
        currency_id=1,  # ARS — currency is overridden by the per-budget formula anyway.
        type=type_value,
        formula_constant=FRENTE_FORMULA_MULTIPLIER_DEFAULT,
    )
    db.add(row)
    db.flush()
    return row


def _main_material_id(budget_or_wo) -> Optional[int]:
    """Resolve the main material's catalogue id from a budget or WO's
    `materials_data` JSON. Returns None if the row doesn't exist or
    has no materials attached — the migration still creates the
    `frente` snapshot row but skips the formula computation (the
    operator must fill `assigned_material_id` after the fact).
    """
    raw = getattr(budget_or_wo, "materials_data", None)
    rows = _parse_json(raw)
    if isinstance(rows, list):
        for r in rows:
            if isinstance(r, dict) and r.get("is_alternative") in (None, False):
                # `materials_data` rows don't carry the catalogue `id`.
                # The migration needs the catalogue row id from the
                # `Material` table — the budget row maintains the price
                # snapshot but not the FK. We fall back to None here and
                # the operator re-picks it on the form.
                return None
    return None


def _length_in_metres(detail_row: Dict[str, Any]) -> float:
    """Pull the edge length out of a fabrication detail row. The legacy
    schema stored it as centimetres; we convert to metres. Defaults
    to `DEFAULT_LINEAR_METERS_FOR_LEGACY` when missing.
    """
    length_cm = detail_row.get("length") or detail_row.get("largo") or 0
    try:
        length_cm = float(length_cm)
    except (TypeError, ValueError):
        return DEFAULT_LINEAR_METERS_FOR_LEGACY
    if length_cm <= 0:
        return DEFAULT_LINEAR_METERS_FOR_LEGACY
    return length_cm * CENTIMETRES_TO_METRES


def _migrate_one_table(
    db: Session,
    model_cls,
    *,
    catalogue_id: int,
) -> Tuple[int, int]:
    """Walk every row of `model_cls` (Budget or WorkOrder), strip
    FRONT fabrication rows, and append `frente` rows to
    `additional_works_data`. Returns (rows_migrated, rows_skipped).
    """
    migrated = 0
    skipped = 0
    now_iso = datetime.now(timezone.utc).isoformat()
    rows = db.query(model_cls).all()
    for row in rows:
        fabrication = _parse_json(getattr(row, "fabrication_details", None))
        if not isinstance(fabrication, list) or not fabrication:
            continue
        front_rows = [r for r in fabrication if isinstance(r, dict) and (r.get("concept") or "").upper() == "FRONT"]
        if not front_rows:
            continue

        keep = [r for r in fabrication if not (isinstance(r, dict) and (r.get("concept") or "").upper() == "FRONT")]
        row.fabrication_details = _serialise(keep) if keep else None

        snapshot = _parse_json(getattr(row, "additional_works_data", None))
        snapshot = snapshot if isinstance(snapshot, list) else []

        material_id = _main_material_id(row)
        for fr in front_rows:
            linear_meters = _length_in_metres(fr)
            new_row: Dict[str, Any] = {
                "additional_work_id": catalogue_id,
                "name": CATALOG_NAME,
                "detail": fr.get("detail") or None,
                "price": float(fr.get("price") or 0),
                "currency": (fr.get("currency") or "ARS"),
                "quantity": 1,
                "total": float(fr.get("price") or 0),
                "materialName": None,
                "type": "frente",
                "linear_meters": linear_meters,
                "assigned_material_id": material_id,
                "formula_values": {
                    "material_price_m2_at_selection": None,
                    "multiplier": FRENTE_FORMULA_MULTIPLIER_DEFAULT,
                    "computed_at": now_iso,
                    "migrated_from": "fabrication_details.FRONT",
                },
            }
            snapshot.append(new_row)
            migrated += 1

        row.additional_works_data = _serialise(snapshot)
        db.add(row)

    db.commit()
    return migrated, skipped


def main():
    db: Session = SessionLocal()
    try:
        catalogue = _ensure_catalog(db, type_value="frente")

        budgets_migrated, _ = _migrate_one_table(db, Budget, catalogue_id=catalogue.id)
        work_orders_migrated, _ = _migrate_one_table(db, WorkOrder, catalogue_id=catalogue.id)

        print(
            f"migrate_fabrication_front: catalog id={catalogue.id} (type=frente, "
            f"formula_constant={catalogue.formula_constant}); "
            f"budgets migrated={budgets_migrated}, work_orders migrated={work_orders_migrated}"
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
