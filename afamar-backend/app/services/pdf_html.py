import base64
import os
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Optional

from jinja2 import Environment, FileSystemLoader, select_autoescape
from PIL import Image as PILImage, ImageDraw
from xhtml2pdf import pisa

from app.core.settings import settings

_TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"
_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATE_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
)


def _load_logo_base64(logo_path: Optional[str] = None) -> Optional[str]:
    candidates = []
    if logo_path:
        candidates.append(logo_path)
    candidates.append(os.path.join(settings.pdf_output_dir, "logo.png"))
    for path in candidates:
        if path and os.path.exists(path):
            try:
                with open(path, "rb") as f:
                    return base64.b64encode(f.read()).decode("utf-8")
            except Exception:
                pass
    return None


def _format_date(d):
    if not d:
        return datetime.now().strftime("%d/%m/%Y")
    if isinstance(d, str):
        try:
            return datetime.strptime(d[:10], "%Y-%m-%d").strftime("%d/%m/%Y")
        except ValueError:
            return d
    return d.strftime("%d/%m/%Y")


def _simplify_concept(texto: str) -> str:
    if not texto:
        return ""
    m = texto.upper().strip()
    m_norm = m.replace("É", "E").replace("Í", "I").replace("Ó", "O").replace("Ú", "U").replace("Ñ", "N")

    if "LONGITUD" in m_norm:
        return "Longitud"
    if "FRENTE" in m_norm:
        return "Frente"
    if "ZOCALO" in m_norm:
        return "Zócalo"
    if "APOYO" in m_norm and "PILETA" in m_norm:
        return "Traforo de Apoyo"
    if "PILETA" in m_norm and ("APERTURA" in m_norm or "PEGADO" in m_norm):
        return "Traforo de Pileta"
    if "PILETA" in m_norm and "TRAFORO" in m_norm:
        return "Traforo de Pileta"
    if "ANAFE" in m_norm:
        return "Traforo de Anafe"
    if "MENSULA" in m_norm:
        return "Ménsulas"
    if "TERMINACI" in m_norm:
        return "Terminación"
    return texto


def _prepare_data(data: dict) -> dict:
    data = dict(data)
    for d in data.get("detalles_fabricacion", []):
        original = d.get("concepto", "")
        if original:
            d["concepto"] = _simplify_concept(original)
        if d.get("detalle") and d["detalle"].upper().strip() == original.upper().strip():
            d["detalle"] = ""
    for d in data.get("items", []):
        if d.get("sector"):
            d["sector"] = _simplify_concept(d["sector"])
    return data


def _render_pdf(html_string: str) -> BytesIO:
    result = BytesIO()
    pdf = pisa.CreatePDF(src=html_string, dest=result, encoding="utf-8")
    if pdf.err:
        raise RuntimeError(f"PDF generation error: {pdf.err}")
    result.seek(0)
    return result


def _xml_escape(text: str) -> str:
    import html as _html
    return _html.escape(text or "")


def _get_item_priority(concepto: str) -> int:
    c = (concepto or "").upper().strip()
    if c.startswith("MATERIAL:") or c.startswith("MATERIAL :"):
        return 1
    if "ZOCALO" in c or "ZÓCALO" in c:
        return 2
    if c == "FRENTE":
        return 3
    if "PILETA" in c and "TRAFORO" in c and "APOYO" not in c:
        return 4
    if "APOYO" in c and "PILETA" in c:
        return 5
    if "ANAFE" in c:
        return 6
    return 8


def _combine_and_sort_items(detalles_fabricacion, materiales, piletas) -> list:
    items = []
    for d in (detalles_fabricacion or []):
        d = dict(d)
        d["_tipo"] = _get_item_priority(d.get("concepto", ""))
        items.append(d)
    for p in (piletas or []):
        items.append({
            "_tipo": 7,
            "concepto": f"Pileta {p.get('marca', '')} {p.get('modelo', '')}".strip(),
            "detalle": None, "largo": None, "ancho": None, "m2": None,
            "cantidad": p.get("cantidad", 1),
            "precio": p.get("precio", 0),
            "moneda": p.get("moneda", "ARS"),
        })
    for m in (materiales or []):
        if m.get("es_alternativa"):
            continue
        m2_item = (m.get("largo") or 0) * (m.get("ancho") or 0) * (m.get("cantidad") or 1)
        if m.get("moneda") == "USD":
            precio_item = m2_item * (m.get("precio_m2_usd") or 0)
        else:
            precio_item = m2_item * (m.get("precio_m2") or 0)
        items.append({
            "_tipo": 1,
            "concepto": f"Material: {m.get('nombre', '')}",
            "detalle": None, "largo": m.get("largo"), "ancho": m.get("ancho"),
            "m2": m2_item, "cantidad": m.get("cantidad", 1),
            "precio": precio_item, "moneda": m.get("moneda", "ARS"),
        })
    items.sort(key=lambda x: x.get("_tipo", 99))
    return items


def _sketch_to_png_base64_list(croquis_data) -> list:
    if not croquis_data:
        return []
    if isinstance(croquis_data, dict):
        pages = croquis_data.get("paginas", [croquis_data])
    elif isinstance(croquis_data, list):
        pages = croquis_data
    else:
        return []

    W, H = 800, 500
    results = []

    def _hex_to_rgb(h):
        if not h or h == "none":
            return None
        h = h.lstrip("#")
        if len(h) == 3:
            h = "".join(c * 2 for c in h)
        if len(h) != 6:
            return (0, 0, 0)
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

    def _parse_lw(lw):
        try:
            return max(1, int(float(lw)))
        except (ValueError, TypeError):
            return 1

    for page in pages:
        elementos = page.get("elementos") or page.get("dibujo") or []
        img = PILImage.new("RGB", (W, H), "white")
        draw = ImageDraw.Draw(img)

        for el in elementos:
            t = el.get("type", "")
            color = _hex_to_rgb(el.get("color", "#1e40af")) or (0, 0, 0)
            fill_c = _hex_to_rgb(el.get("fill", "none"))
            lw = _parse_lw(el.get("lineWidth", 1.5))

            if t == "rect":
                x = float(el.get("x", 0))
                y = float(el.get("y", 0))
                w = float(el.get("w", el.get("ancho", 0)))
                rh = float(el.get("h", el.get("alto", 0)))
                if fill_c:
                    draw.rectangle([x, y, x + w, y + rh], fill=fill_c, outline=color, width=lw)
                else:
                    draw.rectangle([x, y, x + w, y + rh], outline=color, width=lw)

            elif t == "circle":
                cx = float(el.get("x", 0))
                cy = float(el.get("y", 0))
                r = float(el.get("r", 10))
                bbox = [cx - r, cy - r, cx + r, cy + r]
                if fill_c:
                    draw.ellipse(bbox, fill=fill_c, outline=color, width=lw)
                else:
                    draw.ellipse(bbox, outline=color, width=lw)

            elif t == "hole":
                cx = float(el.get("x", 0))
                cy = float(el.get("y", 0))
                r = float(el.get("r", 12))
                h_color = _hex_to_rgb(el.get("color", "#dc2626")) or (220, 38, 38)
                h_fill = _hex_to_rgb(el.get("fill", "#fee2e2")) or (254, 226, 226)
                draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=h_fill, outline=h_color, width=lw)

            elif t == "line":
                x1 = float(el.get("x1", 0))
                y1 = float(el.get("y1", 0))
                x2 = float(el.get("x2", 0))
                y2 = float(el.get("y2", 0))
                draw.line([x1, y1, x2, y2], fill=color, width=lw)

            elif t == "path":
                pts = el.get("points", [])
                if pts and len(pts) > 1:
                    coords = []
                    for p in pts:
                        coords.append(float(p.get("x", 0)))
                        coords.append(float(p.get("y", 0)))
                    draw.line(coords, fill=color, width=lw)

            elif t == "text":
                tx = float(el.get("x", 0))
                ty = float(el.get("y", 0))
                text = el.get("text", "")
                draw.text((tx, ty), text, fill=color)

            elif t == "measure":
                x1 = float(el.get("x1", 0))
                y1 = float(el.get("y1", 0))
                x2 = float(el.get("x2", 0))
                y2 = float(el.get("y2", 0))
                blue = (37, 99, 235)
                draw.line([x1, y1, x2, y2], fill=blue, width=2)
                label = el.get("label", "")
                if label:
                    mx = (x1 + x2) / 2
                    my = (y1 + y2) / 2
                    draw.text((mx + 5, my - 15), label, fill=blue)

            elif t == "bacha":
                bx = float(el.get("x", 0))
                by = float(el.get("y", 0))
                bw = float(el.get("ancho", 80))
                bh = float(el.get("alto", 50))
                blue = (37, 99, 235)
                draw.rectangle([bx, by, bx + bw, by + bh], outline=blue, width=2)
                cx = bx + bw / 2
                cy = by + bh / 2
                draw.ellipse([cx - 18, cy - 18, cx + 18, cy + 18], outline=blue, width=2)

            elif t == "anafe":
                ax = float(el.get("x", 0))
                ay = float(el.get("y", 0))
                aw = float(el.get("ancho", 60))
                ah = float(el.get("alto", 60))
                red = (220, 38, 38)
                draw.rectangle([ax, ay, ax + aw, ay + ah], outline=red, width=2)
                for ox, oy in [(15, 15), (45, 15), (15, 45), (45, 45)]:
                    draw.ellipse(
                        [ax + ox - 10, ay + oy - 10, ax + ox + 10, ay + oy + 10],
                        outline=red, width=2,
                    )

        buf = BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        encoded = base64.b64encode(buf.getvalue()).decode("utf-8")
        results.append(f"data:image/png;base64,{encoded}")

    return results


def generate_budget_pdf(data: dict, logo_path: Optional[str] = None) -> BytesIO:
    template = _env.get_template("budget_pdf.html")
    data = _prepare_data(data)

    hoy = datetime.now().strftime("%d/%m/%Y")
    dd = data.get("dolar_dia") or 1
    croquis_imagenes = _sketch_to_png_base64_list(data.get("croquis") or [])

    ctx = {
        "logo_base64": _load_logo_base64(logo_path),
        "numero": data.get("numero", ""),
        "fecha": _format_date(data.get("fecha") or hoy),
        "cliente_nombre": data.get("cliente_nombre", "-"),
        "cliente_telefono": data.get("cliente_telefono", "-"),
        "domicilio": data.get("domicilio", ""),
        "email": data.get("email", ""),
        "items_ordenados": _combine_and_sort_items(
            data.get("detalles_fabricacion") or [],
            data.get("materiales") or [],
            data.get("piletas") or [],
        ),
        "detalles_fabricacion": data.get("detalles_fabricacion") or [],
        "items": data.get("items") or [],
        "adicionales": data.get("adicionales") or [],
        "materiales": data.get("materiales") or [],
        "piletas": data.get("piletas") or [],
        "croquis_imagenes": croquis_imagenes,
        "subtotal": data.get("subtotal") or 0,
        "traslado": data.get("traslado") or 0,
        "total": data.get("total") or 0,
        "total_usd": data.get("total_usd") or 0,
        "dolar_dia": dd,
        "sena_recibida": data.get("sena_recibida") or 0,
        "saldo_pendiente": data.get("saldo_pendiente") or 0,
        "descuento_porcentaje": data.get("descuento_porcentaje") or 0,
        "descuento_monto_fijo": data.get("descuento_monto_fijo") or 0,
        "forma_pago": data.get("forma_pago", ""),
        "cuotas": data.get("cuotas") or 1,
        "observaciones": data.get("observaciones", ""),
        "observaciones_importantes": data.get("observaciones_importantes", ""),
        "validez": data.get("validez", "7 días"),
        "entrega_aproximada": data.get("entrega_aproximada", "7 a 10 días hábiles"),
    }

    html_str = template.render(**ctx)
    return _render_pdf(html_str)


def generate_work_order_pdf(data: dict, logo_path: Optional[str] = None) -> BytesIO:
    template = _env.get_template("work_order_pdf.html")
    data = _prepare_data(data)

    croquis_imagenes = _sketch_to_png_base64_list(data.get("croquis") or [])
    hoy = datetime.now().strftime("%d/%m/%Y")

    ctx = {
        "logo_base64": _load_logo_base64(logo_path),
        "numero": data.get("numero", ""),
        "fecha": _format_date(data.get("fecha") or hoy),
        "estado": data.get("estado", ""),
        "prioridad": data.get("prioridad", ""),
        "cliente_nombre": data.get("cliente_nombre", "-"),
        "cliente_telefono": data.get("cliente_telefono", "-"),
        "domicilio": data.get("domicilio", ""),
        "email": data.get("email", ""),
        "color_tipo": data.get("color_tipo", ""),
        "espesor": data.get("espesor", ""),
        "acabado": data.get("acabado", ""),
        "fecha_entrega": _format_date(data.get("fecha_entrega") or ""),
        "items_ordenados": _combine_and_sort_items(
            data.get("detalles_fabricacion") or [],
            data.get("materiales") or [],
            data.get("piletas") or [],
        ),
        "subtotal": data.get("subtotal") or 0,
        "traslado": data.get("traslado") or 0,
        "total": data.get("total") or 0,
        "total_usd": data.get("total_usd") or 0,
        "sena_recibida": data.get("sena_recibida") or 0,
        "saldo_pendiente": data.get("saldo_pendiente") or 0,
        "descuento_porcentaje": data.get("descuento_porcentaje") or 0,
        "descuento_monto_fijo": data.get("descuento_monto_fijo") or 0,
        "forma_pago": data.get("forma_pago", ""),
        "cuotas": data.get("cuotas") or 1,
        "observaciones": data.get("observaciones", ""),
        "observaciones_importantes": data.get("observaciones_importantes", ""),
        "croquis_imagenes": croquis_imagenes,
    }

    html_str = template.render(**ctx)
    return _render_pdf(html_str)


def build_budget_pdf_data(budget_data: dict, client_dict: dict, company: dict, terms: dict) -> dict:
    from app.services.budget_calculator import filter_main_materials, parse_materials_data

    materiales_raw = parse_materials_data(budget_data.get("materials_data"))
    main_materials = filter_main_materials(materiales_raw)
    alternatives = [m for m in materiales_raw if m.get("es_alternativa")]

    items_list = []
    for it in (budget_data.get("items") or []):
        items_list.append({
            "sector": it.get("sector", ""),
            "detalle": it.get("description", ""),
            "largo": it.get("length"),
            "ancho": it.get("width"),
            "m2": it.get("m2"),
            "cantidad": it.get("quantity", 1),
            "precio_m2": it.get("price_m2", 0),
            "precio_unitario": it.get("unit_price", 0),
            "total": it.get("total", 0),
        })

    adicionales_list = []
    for ad in (budget_data.get("adicionales") or []):
        adicionales_list.append({
            "concepto": ad.get("concept", ""),
            "detalle": ad.get("detail", ""),
            "cantidad": ad.get("quantity", 1),
            "precio_unitario": ad.get("unit_price", 0),
            "total": ad.get("total", 0),
        })

    fabricacion_raw = budget_data.get("fabrication_details")
    detalles_fabricacion = []
    if fabricacion_raw:
        import json as _json
        try:
            parsed = _json.loads(fabricacion_raw) if isinstance(fabricacion_raw, str) else fabricacion_raw
            detalles_fabricacion = parsed if isinstance(parsed, list) else []
        except (_json.JSONDecodeError, TypeError):
            pass

    materiales_pdf = []
    for m in main_materials:
        materiales_pdf.append({
            "nombre": m.get("nombre") or m.get("name", ""),
            "largo": m.get("largo") or m.get("length", 0),
            "ancho": m.get("ancho") or m.get("width", 0),
            "cantidad": m.get("cantidad") or m.get("quantity", 1),
            "precio_m2": m.get("precio_m2") or m.get("price_m2", 0),
            "precio_m2_usd": m.get("precio_m2_usd") or m.get("price_m2_usd", 0),
            "moneda": m.get("moneda") or m.get("currency", "ARS"),
            "es_alternativa": False,
        })
    for m in alternatives:
        materiales_pdf.append(m)

    piletas_list = []
    for pt in (parse_materials_data(budget_data.get("pools_data")) or []):
        piletas_list.append({
            "marca": pt.get("marca") or pt.get("brand", ""),
            "modelo": pt.get("modelo") or pt.get("model", ""),
            "cantidad": pt.get("cantidad") or pt.get("quantity", 1),
            "precio": pt.get("precio") or pt.get("price", 0),
            "moneda": pt.get("moneda") or pt.get("currency", "ARS"),
        })

    subtotal_ars = float(budget_data.get("subtotal") or 0)
    traslado = float(budget_data.get("transport") or 0)
    desc_pct = float(budget_data.get("discount_percentage") or 0)
    desc_fijo = float(budget_data.get("discount_fixed_amount") or 0)
    total_ars = float(budget_data.get("total") or 0)
    total_usd_val = float(budget_data.get("total_usd") or 0)
    sena = float(budget_data.get("deposit_received") or 0)
    saldo = max(0, float(budget_data.get("balance_due") or (total_ars - sena)))

    return {
        "numero": budget_data.get("number", ""),
        "fecha": budget_data.get("date", ""),
        "cliente_nombre": client_dict.get("name", ""),
        "cliente_telefono": client_dict.get("phone", ""),
        "domicilio": client_dict.get("address", ""),
        "email": client_dict.get("email", ""),
        "detalles_fabricacion": detalles_fabricacion,
        "materiales": materiales_pdf,
        "piletas": piletas_list,
        "items": items_list,
        "adicionales": adicionales_list,
        "subtotal": subtotal_ars,
        "traslado": traslado,
        "total": total_ars,
        "total_usd": total_usd_val,
        "dolar_dia": float(budget_data.get("usd_rate") or 1000),
        "sena_recibida": sena,
        "saldo_pendiente": saldo,
        "descuento_porcentaje": desc_pct,
        "descuento_monto_fijo": desc_fijo,
        "forma_pago": budget_data.get("payment_method", ""),
        "cuotas": budget_data.get("installments", 1),
        "observaciones": (terms.get("budget_terms") or "") + "\n\n" + (budget_data.get("notes") or ""),
        "observaciones_importantes": budget_data.get("important_observations", ""),
        "validez": f"{budget_data.get('validity_days', 7)} días",
        "entrega_aproximada": budget_data.get("estimated_date", "7 a 10 días hábiles"),
        "croquis": budget_data.get("sketch_elements"),
    }


def build_work_order_pdf_data(order_data: dict, client_dict: dict, company: dict, terms: dict) -> dict:
    from app.services.budget_calculator import filter_main_materials, parse_materials_data

    materiales_raw = parse_materials_data(order_data.get("materials_data"))
    main_materials = filter_main_materials(materiales_raw)

    items_list = []
    for it in (order_data.get("items") or []):
        items_list.append({
            "sector": it.get("sector", ""),
            "detalle": it.get("description", ""),
            "largo": it.get("length"),
            "ancho": it.get("width"),
            "m2": it.get("m2"),
            "cantidad": it.get("quantity", 1),
            "precio_m2": it.get("price_m2", 0),
            "precio_unitario": it.get("unit_price", 0),
            "total": it.get("total", 0),
        })

    fabricacion_raw = order_data.get("fabrication_details")
    detalles_fabricacion = []
    if fabricacion_raw:
        import json as _json
        try:
            parsed = _json.loads(fabricacion_raw) if isinstance(fabricacion_raw, str) else fabricacion_raw
            detalles_fabricacion = parsed if isinstance(parsed, list) else []
        except (_json.JSONDecodeError, TypeError):
            pass

    materiales_pdf = []
    for m in main_materials:
        materiales_pdf.append({
            "nombre": m.get("nombre") or m.get("name", ""),
            "largo": m.get("largo") or m.get("length", 0),
            "ancho": m.get("ancho") or m.get("width", 0),
            "cantidad": m.get("cantidad") or m.get("quantity", 1),
            "precio_m2": m.get("precio_m2") or m.get("price_m2", 0),
            "precio_m2_usd": m.get("precio_m2_usd") or m.get("price_m2_usd", 0),
            "moneda": m.get("moneda") or m.get("currency", "ARS"),
        })

    piletas_list = []
    for pt in (parse_materials_data(order_data.get("pools_data")) or []):
        piletas_list.append({
            "marca": pt.get("marca") or pt.get("brand", ""),
            "modelo": pt.get("modelo") or pt.get("model", ""),
            "cantidad": pt.get("cantidad") or pt.get("quantity", 1),
            "precio": pt.get("precio") or pt.get("price", 0),
            "moneda": pt.get("moneda") or pt.get("currency", "ARS"),
        })

    total_ars = float(order_data.get("total") or 0)
    total_usd_val = float(order_data.get("total_usd") or 0)
    sena = float(order_data.get("deposit_received") or 0)
    saldo = max(0, float(order_data.get("balance_due") or (total_ars - sena)))

    return {
        "numero": order_data.get("number", ""),
        "fecha": order_data.get("date", ""),
        "estado": order_data.get("status", ""),
        "prioridad": order_data.get("priority", ""),
        "cliente_nombre": client_dict.get("name", ""),
        "cliente_telefono": client_dict.get("phone", ""),
        "domicilio": client_dict.get("address", ""),
        "email": client_dict.get("email", ""),
        "color_tipo": order_data.get("color", ""),
        "espesor": order_data.get("thickness", ""),
        "acabado": order_data.get("finish", ""),
        "fecha_entrega": order_data.get("delivery_date", ""),
        "detalles_fabricacion": detalles_fabricacion,
        "materiales": materiales_pdf,
        "piletas": piletas_list,
        "items": items_list,
        "subtotal": float(order_data.get("subtotal") or 0),
        "traslado": float(order_data.get("transport") or 0),
        "total": total_ars,
        "total_usd": total_usd_val,
        "sena_recibida": sena,
        "saldo_pendiente": saldo,
        "descuento_porcentaje": float(order_data.get("discount_percentage") or 0),
        "descuento_monto_fijo": float(order_data.get("discount_fixed_amount") or 0),
        "forma_pago": order_data.get("payment_method", ""),
        "cuotas": order_data.get("installments", 1),
        "observaciones": order_data.get("notes", ""),
        "observaciones_importantes": order_data.get("important_observations", ""),
        "croquis": order_data.get("budgeted_details") or order_data.get("sketch_elements"),
    }
