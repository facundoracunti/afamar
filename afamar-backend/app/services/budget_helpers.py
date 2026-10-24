"""Pure-ish helpers for the budget service.

Extracted verbatim from the former monolithic ``app/services/budget.py``
(ADR 0009 — modularización) so the service class stays focused on
queries + mutations:

  * ``_flatten_sketch_pages``      — normalise the croquis wire format.
  * ``_sync_children``             — sync the 1-N children rows.
  * ``_process_additional_works_snapshot`` — freeze the catalogue pricing
    + the budgeted-measurement snapshot of every ``frente`` row.
"""
import json
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.core.settings import settings
from app.models.additional_work import AdditionalWork
from app.models.budget import Budget
from app.models.material import Material
from app.repositories.budget import BudgetRepository
from app.services.frente_pricing import apply_frente_rows


def _flatten_sketch_pages(sketch_data: list) -> list:
    """Normalise the frontend wire format for `sketch_elements` into the
    flat list of `{type, data, order}` rows the `BudgetSketchElement` 1-N
    table expects.

    Two shapes arrive:
      1. New page shape (WorkOrders persist it): `[{ pagina_id, name,
         material?, dibujo: [{type, data, order}] }, ...]`. Budget has no
         per-page column, so we flatten `dibujo` rows back into elements.
      2. Legacy flat element list `[{type, data, order}]` — returned as-is.
    """
    out = []
    for item in sketch_data:
        if not isinstance(item, dict):
            continue
        dibujo = item.get("dibujo")
        if isinstance(dibujo, list) and dibujo:
            for el in dibujo:
                if isinstance(el, dict) and el.get("type"):
                    out.append({
                        "type": el.get("type"),
                        "data": el.get("data"),
                        "order": el.get("order"),
                    })
        elif item.get("type"):
            out.append({
                "type": item.get("type"),
                "data": item.get("data"),
                "order": item.get("order"),
            })
    return out


def _sync_children(budget: Budget, repo: BudgetRepository, attr: str, model_class, data_list: Optional[List[Dict]]):
    if data_list is None:
        return
    existing = {getattr(obj, "id"): obj for obj in getattr(budget, attr)}
    incoming_ids = {d.get("id") for d in data_list if d.get("id")}
    for obj_id, obj in existing.items():
        if obj_id not in incoming_ids:
            repo.delete(obj)
    for d in data_list:
        obj_id = d.get("id")
        if obj_id and obj_id in existing:
            for k, v in d.items():
                if k != "id":
                    setattr(existing[obj_id], k, v)
        else:
            new_obj = model_class(budget_id=budget.id, **{k: v for k, v in d.items() if k != "id"})
            repo.add(new_obj)


def _process_additional_works_snapshot(
    db: Session,
    raw_json: Optional[str],
    usd_rate: Optional[float] = None,
) -> Optional[str]:
    """Take the JSON snapshot from the form, resolve any `frente`
    rows against their linked Material row, and return the serialised
    JSON for persistence (with `price`, `total`, and `formula_values`
    frozen at the chosen moment).

    Rows that aren't `frente` pass through unchanged. Rows whose linked
    catalogue item or material can't be found are kept verbatim so the
    budget doesn't lose data when an item is deleted after the fact.

    After applying the catalogue pricing we ALSO snapshot the dimensional
    budgeted measure (`linear_meters_budgeted`) and the budgeted monetary
    totals (`total_ars_budgeted` / `total_usd_budgeted`) for each frente.
    These snapshots are what the COMPARATIVA DE MEDICIÓN of the resulting
    work order needs to render the "Presupuestado" column and the delta
    vs the Real measurement. Without them the comparison would show "—"
    in Presupuestado for every frente and the deltas would be wrong the
    moment the operator edits the measure in MEASUREMENT.
    """
    if not raw_json:
        return raw_json
    try:
        rows = json.loads(raw_json) if isinstance(raw_json, str) else raw_json
    except (ValueError, TypeError):
        return raw_json
    if not isinstance(rows, list) or not rows:
        return raw_json

    catalogue_ids = {
        int(r.get("additional_work_id"))
        for r in rows
        if r.get("additional_work_id") is not None
    }
    material_ids = {
        int(r.get("assigned_material_id"))
        for r in rows
        if r.get("assigned_material_id") is not None
    }

    catalogue_by_id: Dict[int, AdditionalWork] = {}
    if catalogue_ids:
        catalogue_by_id = {
            c.id: c
            for c in db.query(AdditionalWork).filter(AdditionalWork.id.in_(catalogue_ids)).all()
        }

    materials_by_id: Dict[int, Material] = {}
    if material_ids:
        materials_by_id = {
            m.id: m for m in db.query(Material).filter(Material.id.in_(material_ids)).all()
        }

    try:
        processed = apply_frente_rows(
            rows,
            catalogue_by_id=catalogue_by_id,
            materials_by_id=materials_by_id,
        )
    except Exception:
        return json.dumps(rows, ensure_ascii=False)

    # Snapshot the dimensional budgeted measure and the budgeted monetary
    # totals for every `frente` row, so the COMPARATIVA DE MEDICIÓN of the
    # converted work order can render the Presupuestado column and the
    # delta vs Real. We freeze the snapshot at the moment the BUDGET is
    # saved (the conversion path reuses the same JSON, so the snapshot
    # survives the budget → work order handoff). See WorkOrderService.
    # create_from_budget for the matching read-side snapshot logic on
    # work-order creation.
    effective_usd_rate = float(
        usd_rate if usd_rate not in (None, 0) else settings.DEFAULT_USD_RATE
    )
    snapped: List[Dict] = []
    for r in processed:
        if not isinstance(r, dict) or str(r.get("type") or "").lower() != "frente":
            snapped.append(r)
            continue
        row_currency = "USD" if str(r.get("currency") or "").upper() == "USD" else "ARS"
        price = float(r.get("price") or 0)
        quantity = float(r.get("quantity") or 1)
        total_src = float(r.get("total") or price * quantity)
        if row_currency == "ARS":
            snap_ars = total_src
            snap_usd = total_src / effective_usd_rate if effective_usd_rate > 0 else 0
        else:
            snap_usd = total_src
            snap_ars = total_src * effective_usd_rate if effective_usd_rate > 0 else 0
        r["total_ars_budgeted"] = snap_ars
        r["total_usd_budgeted"] = snap_usd
        if "linear_meters" in r and r.get("linear_meters") is not None:
            r["linear_meters_budgeted"] = float(r.get("linear_meters") or 0)
        snapped.append(r)
    processed = snapped

    return json.dumps(processed, ensure_ascii=False)
