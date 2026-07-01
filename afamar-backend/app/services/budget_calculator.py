import json


def compute_surcharge(payment_method: str | None, installments: int) -> dict:
    if payment_method == "CREDIT_CARD":
        pct = 0 if installments <= 2 else installments * 5
    else:
        pct = 0
    return {"percentage": pct}


def apply_surcharge(amount_ars: float, amount_usd: float, surcharge_pct: float) -> dict:
    recargo = round(amount_ars * surcharge_pct / 100)
    recargo_usd = round(amount_usd * surcharge_pct / 100, 2)
    return {
        "surcharge_ars": recargo,
        "surcharge_usd": recargo_usd,
        "total_with_surcharge_ars": round(amount_ars + recargo),
        "total_with_surcharge_usd": round(amount_usd + recargo_usd, 2),
    }


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
    return [m for m in materials if not m.get("es_alternativa")]


def has_alternative_materials(materials: list) -> bool:
    return any(m.get("es_alternativa") for m in materials)


def calculate_material_totals(materials: list, usd_rate: float) -> dict:
    ars = 0.0
    usd = 0.0
    for m in materials:
        largo = float(m.get("length") or m.get("largo", 0) or 0)
        ancho = float(m.get("width") or m.get("ancho", 0) or 0)
        cantidad = float(m.get("quantity") or m.get("cantidad", 1) or 1)
        m2 = (largo * ancho) / 10000 if largo > 0 and ancho > 0 else 0
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
    m2 = (largo * ancho) / 10000 if largo > 0 and ancho > 0 else 0
    cantidad = float(alt.get("quantity") or alt.get("cantidad", 1) or 1)
    area = m2 * cantidad

    alt_currency = alt.get("moneda") or alt.get("currency") or budget.currency or "ARS"
    usd_rate_value = budget.usd_rate or 1000.0

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
