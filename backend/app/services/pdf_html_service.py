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
