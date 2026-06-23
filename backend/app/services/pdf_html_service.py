import os
import base64
from io import BytesIO
from datetime import datetime
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from xhtml2pdf import pisa

from app.config import get_settings


_TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"
_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATE_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
)


def _load_logo_base64(logo_path=None):
    if logo_path and os.path.exists(logo_path):
        try:
            with open(logo_path, "rb") as f:
                return base64.b64encode(f.read()).decode("utf-8")
        except Exception:
            pass

    settings = get_settings()
    default_logo = os.path.join(settings.UPLOAD_DIR, "logo.png")
    if os.path.exists(default_logo):
        try:
            with open(default_logo, "rb") as f:
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


def _simplificar_concepto(texto):
    """Abrevia nombres largos de conceptos para el PDF.
    Ordenado de más específico a menos específico."""
    if not texto:
        return ""
    m = texto.upper().strip()
    # Normalizar acentos para matching
    m_norm = m.replace("É","E").replace("Í","I").replace("Ó","O").replace("Ú","U").replace("Ñ","N")
    # -- Detalles de fabricacion --
    if "LONGITUD" in m_norm:
        return "Longitud"
    if "FRENTE" in m_norm:
        return "Frente"
    if "ZOCALO" in m_norm:
        return "Zócalo"
    # -- Traforos / extras (específicos primero) --
    if "APOYO" in m_norm and "PILETA" in m_norm:
        return "Traforo de Apoyo"
    if "PILETA" in m_norm and "APERTURA" in m_norm and "PEGADO" in m_norm:
        return "Traforo de Pileta"
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


def _preparar_data(data):
    """Pre-process data for the template: shorten concepts, clean up."""
    data = dict(data)
    for d in data.get("detalles_fabricacion", []):
        original_concepto = d.get("concepto", "")
        if original_concepto:
            d["concepto"] = _simplificar_concepto(original_concepto)
        if d.get("detalle"):
            # Clear detalle if it's a direct duplicate of concepto (prevents "Traforo de Pileta - Traforo de Pileta")
            if d["detalle"].upper().strip() == original_concepto.upper().strip():
                d["detalle"] = ""
    for d in data.get("items", []):
        if d.get("sector"):
            d["sector"] = _simplificar_concepto(d["sector"])
    return data


def _render_pdf(html_string: str) -> BytesIO:
    """Convert HTML to PDF using xhtml2pdf (pisa)."""
    result = BytesIO()
    pdf = pisa.CreatePDF(
        src=html_string,
        dest=result,
        encoding="utf-8",
    )
    if pdf.err:
        raise RuntimeError(f"PDF generation error: {pdf.err}")
    result.seek(0)
    return result


def generar_presupuesto_pdf(data: dict, logo_path: str = None) -> BytesIO:
    """Render the presupuesto HTML template and convert to PDF via xhtml2pdf."""

    template = _env.get_template("presupuesto_pdf.html")
    data = _preparar_data(data)

    hoy = datetime.now().strftime("%d/%m/%Y")
    dd = data.get("dolar_dia") or 1
    croquis_imagenes = _croquis_to_png_base64_list(data.get("croquis") or [])

    ctx = {
        "logo_base64": _load_logo_base64(logo_path),
        "numero": data.get("numero", ""),
        "fecha": _format_date(data.get("fecha") or hoy),
        "cliente_nombre": data.get("cliente_nombre", "-"),
        "cliente_telefono": data.get("cliente_telefono", "-"),
        "domicilio": data.get("domicilio", ""),
        "email": data.get("email", ""),
        "items_ordenados": _combinar_y_ordenar_items(
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


def _croquis_to_svg(croquis_data) -> str:
    """Convert croquis JSON (pages with elements) to an inline SVG string."""
    if not croquis_data:
        return ""
    if isinstance(croquis_data, dict):
        pages = croquis_data.get("paginas", [croquis_data])
    elif isinstance(croquis_data, list):
        pages = croquis_data
    else:
        return ""

    svg_parts = []
    for page in pages:
        elementos = page.get("elementos") or page.get("dibujo") or []
        if not elementos:
            continue
        svg_parts.append(
            '<svg xmlns="http://www.w3.org/2000/svg" '
            'viewBox="0 0 800 500" '
            'style="width:100%;max-height:320px;background:#fff;border:1px solid #e2e8f0;">'
        )
        for el in elementos:
            color = el.get("color", "#1e40af")
            fill = el.get("fill", "none")
            lw = el.get("lineWidth", 1.5)
            sw = f'stroke="{color}" stroke-width="{lw}"'
            ft = f'fill="{fill}"'
            t = el.get("type", "")
            if t == "rect":
                x = el.get("x", 0)
                y = el.get("y", 0)
                w = el.get("w", el.get("ancho", 0))
                h = el.get("h", el.get("alto", 0))
                svg_parts.append(
                    f'<rect x="{x}" y="{y}" width="{w}" height="{h}" '
                    f'{ft} {sw} />'
                )
            elif t == "circle":
                cx = el.get("x", 0)
                cy = el.get("y", 0)
                r = el.get("r", 10)
                svg_parts.append(
                    f'<circle cx="{cx}" cy="{cy}" r="{r}" {ft} {sw} />'
                )
            elif t == "hole":
                cx = el.get("x", 0)
                cy = el.get("y", 0)
                r = el.get("r", 12)
                h_color = el.get("color", "#dc2626")
                h_fill = el.get("fill", "#fee2e2")
                svg_parts.append(
                    f'<circle cx="{cx}" cy="{cy}" r="{r}" '
                    f'fill="{h_fill}" stroke="{h_color}" stroke-width="{lw}" />'
                )
            elif t == "line":
                x1 = el.get("x1", 0)
                y1 = el.get("y1", 0)
                x2 = el.get("x2", 0)
                y2 = el.get("y2", 0)
                svg_parts.append(
                    f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" {sw} />'
                )
            elif t == "path":
                pts = el.get("points", [])
                if pts and len(pts) > 1:
                    ps = " ".join(f'{p.get("x",0)},{p.get("y",0)}' for p in pts)
                    svg_parts.append(
                        f'<polyline points="{ps}" {sw} fill="none" />'
                    )
            elif t == "text":
                tx = el.get("x", 0)
                ty = el.get("y", 0)
                text = el.get("text", "")
                font_size = 14
                font_str = el.get("font", "")
                if "px" in font_str:
                    try:
                        font_size = int(font_str.split("px")[0].strip())
                    except ValueError:
                        pass
                svg_parts.append(
                    f'<text x="{tx}" y="{ty}" fill="{color}" '
                    f'font-size="{font_size}px" font-family="Inter, sans-serif">'
                    f'{_xml_escape(text)}</text>'
                )
            elif t == "measure":
                x1 = el.get("x1", 0)
                y1 = el.get("y1", 0)
                x2 = el.get("x2", 0)
                y2 = el.get("y2", 0)
                mx = (x1 + x2) / 2
                my = (y1 + y2) / 2
                label = el.get("label", "")
                svg_parts.append(
                    f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" '
                    f'stroke="#2563eb" stroke-width="1.5" />'
                )
                if label:
                    svg_parts.append(
                        f'<text x="{mx + 5}" y="{my - 5}" fill="#2563eb" '
                        f'font-size="12px" font-family="Inter, sans-serif">'
                        f'{_xml_escape(label)}</text>'
                    )
            elif t == "bacha":
                bx = el.get("x", 0)
                by = el.get("y", 0)
                bw = el.get("ancho", 80)
                bh = el.get("alto", 50)
                svg_parts.append(
                    f'<rect x="{bx}" y="{by}" width="{bw}" height="{bh}" '
                    f'fill="none" stroke="#2563eb" stroke-width="2" />'
                )
                svg_parts.append(
                    f'<circle cx="{bx + bw / 2}" cy="{by + bh / 2}" r="18" '
                    f'fill="none" stroke="#2563eb" stroke-width="2" />'
                )
            elif t == "anafe":
                ax = el.get("x", 0)
                ay = el.get("y", 0)
                aw = el.get("ancho", 60)
                ah = el.get("alto", 60)
                svg_parts.append(
                    f'<rect x="{ax}" y="{ay}" width="{aw}" height="{ah}" '
                    f'fill="none" stroke="#dc2626" stroke-width="2" />'
                )
                for ox, oy in [(15, 15), (45, 15), (15, 45), (45, 45)]:
                    svg_parts.append(
                        f'<circle cx="{ax + ox}" cy="{ay + oy}" r="10" '
                        f'fill="none" stroke="#dc2626" stroke-width="2" />'
                    )
        svg_parts.append("</svg>")
    return "\n".join(svg_parts)


def _xml_escape(text: str) -> str:
    import html as _html
    return _html.escape(text or "")


def _svg_to_base64(svg_str: str) -> str:
    """Convert an SVG string to a base64 data URI for use in <img> tags."""
    if not svg_str:
        return ""
    encoded = base64.b64encode(svg_str.encode("utf-8")).decode("utf-8")
    return f"data:image/svg+xml;base64,{encoded}"


def _get_item_priority(concepto: str) -> int:
    """Returns sort key for a concept string. Lower = higher in table."""
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


def _combinar_y_ordenar_items(detalles_fabricacion, materiales, piletas):
    items = []

    for d in (detalles_fabricacion or []):
        d = dict(d)
        d["_tipo"] = _get_item_priority(d.get("concepto", ""))
        items.append(d)

    for p in (piletas or []):
        items.append({
            "_tipo": 7,
            "concepto": f"Pileta {p.get('marca', '')} {p.get('modelo', '')}".strip(),
            "detalle": None,
            "largo": None, "ancho": None, "m2": None,
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
            "detalle": None,
            "largo": m.get("largo"),
            "ancho": m.get("ancho"),
            "m2": m2_item,
            "cantidad": m.get("cantidad", 1),
            "precio": precio_item,
            "moneda": m.get("moneda", "ARS"),
        })

    items.sort(key=lambda x: x.get("_tipo", 99))
    return items


def _croquis_to_png_base64_list(croquis_data) -> list:
    """Convert croquis JSON pages to a list of PNG base64 data URIs (one per page)."""
    if not croquis_data:
        return []
    if isinstance(croquis_data, dict):
        pages = croquis_data.get("paginas", [croquis_data])
    elif isinstance(croquis_data, list):
        pages = croquis_data
    else:
        return []

    from PIL import Image, ImageDraw

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
        return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

    def _parse_lw(lw):
        try:
            return max(1, int(float(lw)))
        except (ValueError, TypeError):
            return 1

    for page in pages:
        elementos = page.get("elementos") or page.get("dibujo") or []
        img = Image.new("RGB", (W, H), "white")
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
                bbox = [cx - r, cy - r, cx + r, cy + r]
                draw.ellipse(bbox, fill=h_fill, outline=h_color, width=lw)

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


def generar_orden_pdf(data: dict, logo_path: str = None) -> BytesIO:
    """Render the orden de trabajo HTML template and convert to PDF via xhtml2pdf."""
    template = _env.get_template("orden_pdf.html")
    data = _preparar_data(data)

    croquis_imagenes = _croquis_to_png_base64_list(data.get("croquis") or [])
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
        "items_ordenados": _combinar_y_ordenar_items(
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
