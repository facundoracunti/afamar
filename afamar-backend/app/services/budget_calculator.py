import json
import logging

from app.core.settings import settings

logger = logging.getLogger(__name__)


def parse_materials_data(materials_data: str | None | list | dict) -> list:
    if not materials_data:
        return []
    if isinstance(materials_data, list):
        return materials_data
    if isinstance(materials_data, dict):
        items = materials_data.get("items") or materials_data.get("materiales") or []
        return items if isinstance(items, list) else [materials_data]
    try:
        parsed = json.loads(materials_data)
        if isinstance(parsed, list):
            return parsed
        if isinstance(parsed, dict):
            items = parsed.get("items") or parsed.get("materiales") or []
            return items if isinstance(items, list) else [parsed]
        return []
    except (json.JSONDecodeError, TypeError):
        return []


def filter_main_materials(materials: list) -> list:
    return [m for m in materials if not m.get("is_alternative") and not m.get("es_alternativa")]


def has_alternative_materials(materials: list) -> bool:
    return any(m.get("is_alternative") or m.get("es_alternativa") for m in materials)


def flatten_pieces(data: dict, only_if_missing: bool = False) -> None:
    """When `data` carries `pieces_data` (multi-piece flow), derive the legacy
    document-level arrays from it and write them into `data`.

    `pieces_data` is the source of truth: each piece owns its materials,
    zócalo/frente rows and additional works. Downstream code (the totals
    recalc, the PDF, the cash formulas) still reads the flat
    `materials_data` / `fabrication_details` / `additional_works_data`
    arrays, so we rebuild them by concatenating every piece's sub-arrays in
    piece order. This is the server-side twin of the frontend
    `flattenPieces()` helper — keep the two in sync.

    With `only_if_missing=True` (used by both the budget path and the
    work-order recalc) the derived arrays fill only the keys the caller did
    NOT already provide: the client's flat arrays are the editable snapshot
    and must win when present. `pieces_data` only fills the gap for an
    API-only payload that carries the pieces alone.

    No-op when `pieces_data` is absent/empty, so legacy budgets/work orders
    keep their existing arrays untouched.
    """
    raw = data.get("pieces_data")
    if not raw:
        return
    try:
        pieces = raw if not isinstance(raw, str) else json.loads(raw)
    except (ValueError, TypeError):
        return
    if not isinstance(pieces, list) or not pieces:
        return

    materials: list = []
    fabrication: list = []
    additional: list = []
    pools: list = []
    for piece in pieces:
        if not isinstance(piece, dict):
            continue
        # Pieces v2: the piece may carry its materials under
        # `mainMaterial` + `alternativeMaterials` (singular model) instead
        # of the legacy `materials` array. Support both shapes.
        if isinstance(piece.get("mainMaterial"), dict):
            materials.append({**piece["mainMaterial"], "is_alternative": False})
        elif isinstance(piece.get("materials"), list):
            materials.extend(piece["materials"])
        if isinstance(piece.get("alternativeMaterials"), list):
            for alt in piece["alternativeMaterials"]:
                materials.append({**alt, "is_alternative": True})
        piece_fab = piece.get("fabrication_details")
        if isinstance(piece_fab, list):
            fabrication.extend(piece_fab)
        piece_add = piece.get("additional_works_data")
        if isinstance(piece_add, str) and piece_add:
            try:
                parsed = json.loads(piece_add)
                if isinstance(parsed, list):
                    additional.extend(parsed)
            except (ValueError, TypeError):
                pass
        elif isinstance(piece_add, list):
            additional.extend(piece_add)
        # Pieces v2: piletas moved into the piece. Concatenate them so the
        # document-level `pools_data` (still read by the recalc + the legacy
        # xhtml2pdf PDF) carries the union.
        piece_pools = piece.get("pools")
        if isinstance(piece_pools, list):
            pools.extend(piece_pools)

    derived = {
        "materials_data": json.dumps(materials, ensure_ascii=False),
        "fabrication_details": json.dumps(fabrication, ensure_ascii=False),
        "additional_works_data": json.dumps(additional, ensure_ascii=False),
        "pools_data": json.dumps(pools, ensure_ascii=False),
    }
    for key, value in derived.items():
        if only_if_missing and data.get(key) not in (None, "", "[]"):
            continue
        data[key] = value


def calculate_material_totals(materials: list, usd_rate: float) -> dict:
    ars = 0.0
    usd = 0.0
    for m in materials:
        largo = float(m.get("length") or m.get("largo", 0) or 0)
        ancho = float(m.get("width") or m.get("ancho", 0) or 0)
        cantidad = float(m.get("quantity") or m.get("cantidad", 1) or 1)
        m2 = (largo * ancho) if largo > 0 and ancho > 0 else 0
        area = m2 * cantidad
        moneda = m.get("moneda") or m.get("currency", "ARS")
        if moneda == "USD":
            usd += round(area * float(m.get("price_m2_usd") or m.get("precio_m2_usd", 0) or 0), 2)
        else:
            ars += round(area * float(m.get("price_m2") or m.get("precio_m2", 0) or 0), 2)
    return {"ars": ars, "usd": usd}


def compute_alternative_totals(alt: dict, budget) -> tuple:
    largo = float(alt.get("length") or alt.get("largo", 0) or 0)
    ancho = float(alt.get("width") or alt.get("ancho", 0) or 0)
    m2 = (largo * ancho) if largo > 0 and ancho > 0 else 0
    cantidad = float(alt.get("quantity") or alt.get("cantidad", 1) or 1)
    area = m2 * cantidad

    alt_currency = alt.get("moneda") or alt.get("currency") or budget.currency or "ARS"
    usd_rate_value = budget.usd_rate or settings.DEFAULT_USD_RATE

    if alt_currency == "USD":
        mat_cost_usd = round(area * float(alt.get("price_m2_usd") or alt.get("precio_m2_usd", 0) or 0), 2)
        mat_cost_ars = round(mat_cost_usd * usd_rate_value)
    else:
        mat_cost_ars = round(area * float(alt.get("price_m2") or alt.get("precio_m2", 0) or 0), 2)
        mat_cost_usd = round(mat_cost_ars / usd_rate_value, 2) if usd_rate_value > 0 else 0

    return mat_cost_ars, mat_cost_usd, alt_currency, usd_rate_value, area


def compute_detail_totals(detalles: list) -> tuple:
    total_ars = 0.0
    total_usd = 0.0
    for d in (detalles if isinstance(detalles, list) else []):
        p = float(d.get("precio", 0) or 0)
        c = float(d.get("cantidad") or d.get("quantity", 1) or 1)
        if d.get("moneda") == "USD":
            total_usd += p * c
        else:
            total_ars += p * c
    return total_ars, total_usd


def compute_pool_totals(pools: list) -> tuple:
    total_ars = 0.0
    total_usd = 0.0
    for pt in pools:
        p = float(pt.get("precio") or pt.get("price", 0) or 0)
        c = float(pt.get("cantidad") or pt.get("quantity", 1) or 1)
        if pt.get("moneda") == "USD":
            total_usd += p * c
        else:
            total_ars += p * c
    return total_ars, total_usd


def parse_additional_works_snapshot(raw) -> list:
    """Parse the JSON snapshot stored in `additional_works_data` (TEXT
    column) into a list of dicts. Treats null / non-list values as
    empty so callers can always iterate.
    """
    if raw is None or raw == "":
        return []
    if isinstance(raw, list):
        return raw
    if isinstance(raw, (bytes, bytearray)):
        try:
            raw = raw.decode("utf-8")
        except Exception:
            logger.warning("Failed to parse additional works snapshot")
            return []
    try:
        parsed = json.loads(raw)
    except (json.JSONDecodeError, TypeError, ValueError):
        return []
    return parsed if isinstance(parsed, list) else []


def compute_additional_totals(rows: list) -> tuple:
    """Bucket `additional_works_data` rows into (total_ars, total_usd).

    `frente` rows contribute their frozen `total` (set by
    `apply_frente_rows` at save time). Flat rows contribute
    `price * quantity` in their own currency. Mirrors the contract the
    frontend `useBudgetCalculations` uses so backend recomputes match.
    """
    total_ars = 0.0
    total_usd = 0.0
    for r in rows if isinstance(rows, list) else []:
        if not isinstance(r, dict):
            continue
        currency = (r.get("currency") or "ARS").upper()
        is_frente = (r.get("type") or "flat") == "frente"
        if is_frente:
            total = float(r.get("total") or 0)
        else:
            price = float(r.get("price") or 0)
            quantity = float(r.get("quantity") or 1)
            total = price * quantity
        if currency == "USD":
            total_usd += total
        else:
            total_ars += total
    return total_ars, total_usd
