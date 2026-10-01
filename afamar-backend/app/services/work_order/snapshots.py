"""Bake measurement snapshots INTO ``pieces_data`` so the COMPARATIVA DE
MEDICIÓN survives any round-trip.

The flat arrays (``materials_data`` / ``fabrication_details`` /
``additional_works_data``) get snapshot keys at conversion time, but the
frontend is pieces-first and re-derives the flat arrays from the pieces on
every edit (``flattenPieces`` inside ``useBudgetPieces.commit``). Without
this baking, the snapshot dies at the first measurement change.

Materials → ``m2_budgeted`` (length × width × quantity, meters).
Fabrication rows → ``total_ars/usd_budgeted`` + ``m2_budgeted`` /
``linear_meters_budgeted`` by concept.
Additional works → ``total_ars/usd_budgeted`` (+ ``linear_meters_budgeted``
for frentes), re-serialising each piece's per-piece JSON.

Returns the re-serialised JSON string (same string when the payload is
absent or malformed).
"""
import json

from app.services.work_order.helpers import FAB_LINEAR_CONCEPTS, FAB_M2_CONCEPTS


def _m2_snapshot(row: dict) -> dict:
    length_m = float(row.get("length") or row.get("largo") or 0)
    width_m = float(row.get("width") or row.get("ancho") or 0)
    quantity = float(row.get("quantity") or row.get("cantidad") or 1)
    return {**row, "m2_budgeted": length_m * width_m * quantity}


def _fab_snapshot(row: dict, wo_usd_rate: float) -> dict:
    fd_currency = "USD" if str(row.get("currency") or "").upper() == "USD" else "ARS"
    fd_total = float((row.get("price") or 0) * (row.get("quantity") or 1))
    fd_ars = fd_total if fd_currency == "ARS" else (fd_total * wo_usd_rate if wo_usd_rate > 0 else 0)
    fd_usd = fd_total if fd_currency == "USD" else (fd_total / wo_usd_rate if wo_usd_rate > 0 else 0)
    fd_length = float(row.get("length") or row.get("largo") or 0)
    fd_width = float(row.get("width") or row.get("ancho") or 0)
    fd_qty = float(row.get("quantity") or row.get("cantidad") or 1)
    fd_concept = str(row.get("concept") or row.get("concepto") or "").strip().upper()
    snapshot = {"total_ars_budgeted": fd_ars, "total_usd_budgeted": fd_usd}
    if fd_concept in FAB_M2_CONCEPTS:
        snapshot["m2_budgeted"] = fd_length * fd_width * fd_qty
    elif fd_concept in FAB_LINEAR_CONCEPTS:
        snapshot["linear_meters_budgeted"] = fd_length * fd_qty
    return {**row, **snapshot}


def _additional_snapshot(row: dict, wo_usd_rate: float) -> dict:
    aw_currency = "USD" if str(row.get("currency") or "").upper() == "USD" else "ARS"
    aw_total = float(
        row.get("total")
        or (row.get("price") or row.get("unit_price") or 0)
        * (row.get("quantity") or 1)
    )
    aw_ars = aw_total if aw_currency == "ARS" else (aw_total * wo_usd_rate if wo_usd_rate > 0 else 0)
    aw_usd = aw_total if aw_currency == "USD" else (aw_total / wo_usd_rate if wo_usd_rate > 0 else 0)
    snapshot = {"total_ars_budgeted": aw_ars, "total_usd_budgeted": aw_usd}
    if str(row.get("type") or "").lower() == "frente" and row.get("linear_meters") is not None:
        snapshot["linear_meters_budgeted"] = float(row.get("linear_meters") or 0)
    return {**row, **snapshot}


def bake_snapshot_into_pieces(pieces_raw, wo_usd_rate: float) -> str | None:
    """Re-serialise ``pieces_data`` with budgeted-measurement snapshots baked in.

    Returns the input unchanged when it's absent / empty / non-JSON. The
    bake is a no-op when the wire format is malformed — the frontend would
    fall back to its own parsing rather than crash on the WO form.
    """
    if not pieces_raw:
        return pieces_raw if isinstance(pieces_raw, str) else None
    try:
        pieces = json.loads(pieces_raw) if isinstance(pieces_raw, str) else pieces_raw
    except (ValueError, TypeError):
        return pieces_raw
    if not isinstance(pieces, list):
        return pieces_raw

    baked = []
    for piece in pieces:
        if not isinstance(piece, dict):
            baked.append(piece)
            continue
        next_piece = {**piece}
        if isinstance(piece.get("mainMaterial"), dict):
            next_piece["mainMaterial"] = _m2_snapshot(piece["mainMaterial"])
        if isinstance(piece.get("mainMaterialRows"), list):
            next_piece["mainMaterialRows"] = [
                _m2_snapshot(m) if isinstance(m, dict) else m
                for m in piece["mainMaterialRows"]
            ]
        if isinstance(piece.get("alternativeMaterials"), list):
            next_piece["alternativeMaterials"] = [
                _m2_snapshot(m) if isinstance(m, dict) else m
                for m in piece["alternativeMaterials"]
            ]
        if isinstance(piece.get("materials"), list):
            next_piece["materials"] = [
                _m2_snapshot(m) if isinstance(m, dict) else m
                for m in piece["materials"]
            ]
        if isinstance(piece.get("fabrication_details"), list):
            next_piece["fabrication_details"] = [
                _fab_snapshot(fd, wo_usd_rate) if isinstance(fd, dict) else fd
                for fd in piece["fabrication_details"]
            ]
        piece_add = piece.get("additional_works_data")
        if piece_add:
            try:
                parsed = json.loads(piece_add) if isinstance(piece_add, str) else piece_add
                if isinstance(parsed, list):
                    next_piece["additional_works_data"] = json.dumps(
                        [_additional_snapshot(aw, wo_usd_rate) if isinstance(aw, dict) else aw for aw in parsed],
                        ensure_ascii=False,
                    )
            except (ValueError, TypeError):
                pass
        baked.append(next_piece)
    return json.dumps(baked, ensure_ascii=False)
