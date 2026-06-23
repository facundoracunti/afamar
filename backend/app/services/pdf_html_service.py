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
        if d.get("concepto"):
            d["concepto"] = _simplificar_concepto(d["concepto"])
        if d.get("detalle"):
            d["detalle"] = _simplificar_concepto(d["detalle"])
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

    ctx = {
        "logo_base64": _load_logo_base64(logo_path),
        "numero": data.get("numero", ""),
        "fecha": _format_date(data.get("fecha") or hoy),
        "cliente_nombre": data.get("cliente_nombre", "-"),
        "cliente_telefono": data.get("cliente_telefono", "-"),
        "domicilio": data.get("domicilio", ""),
        "email": data.get("email", ""),
        "detalles_fabricacion": data.get("detalles_fabricacion") or [],
        "items": data.get("items") or [],
        "adicionales": data.get("adicionales") or [],
        "materiales": data.get("materiales") or [],
        "piletas": data.get("piletas") or [],
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


def generar_orden_pdf(data: dict, logo_path: str = None) -> BytesIO:
    """Render the orden de trabajo HTML template and convert to PDF via xhtml2pdf."""
    template = _env.get_template("orden_pdf.html")
    data = _preparar_data(data)

    croquis_svg = _croquis_to_svg(data.get("croquis") or [])
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
        "detalles_fabricacion": data.get("detalles_fabricacion") or [],
        "materiales": data.get("materiales") or [],
        "piletas": data.get("piletas") or [],
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
        "croquis_svg": croquis_svg,
    }

    html_str = template.render(**ctx)
    return _render_pdf(html_str)
