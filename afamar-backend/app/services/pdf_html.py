import base64
import logging
import os
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

from jinja2 import Environment, FileSystemLoader, select_autoescape
from PIL import Image as PILImage, ImageDraw
from xhtml2pdf import pisa

from app.core.settings import settings

_TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"
_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATE_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
)


def _jinja2_format(value, *args, **kwargs):
    """Override built-in ``format`` filter so that ``"{:,.2f}"|format(n)``
    works the same as ``f"{n:,.2f}"`` in Python.  The default Jinja2 filter
    uses ``%``-style formatting which does not understand ``{:,}``."""
    if not args and not kwargs:
        return str(value)
    try:
        if kwargs:
            return str(value).format(**kwargs)
        return str(value).format(*args)
    except (IndexError, KeyError, ValueError, TypeError):
        return str(value)


_env.filters["format"] = _jinja2_format


_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent


def _split_terms(value) -> list[str]:
    """Return a clean list of non-blank terms from `value`.

    Accepts:
      - list[str]: the new structured shape from /admin/configuration
      - str: JSON-encoded list (auto-parsed), or legacy multi-line plain text
      - None/empty: returns []
    """
    if value is None:
        return []
    if isinstance(value, list):
        return [str(t).strip() for t in value if str(t).strip()]
    text = str(value).strip()
    if not text:
        return []
    # Try JSON first — the frontend sends terms as JSON-encoded lists
    if text.startswith("["):
        import json as _json
        try:
            parsed = _json.loads(text)
            if isinstance(parsed, list):
                return [str(t).strip() for t in parsed if str(t).strip()]
        except (_json.JSONDecodeError, TypeError):
            pass
    # Legacy plain-text fallback: split on newlines
    return [t for t in (line.strip() for line in text.splitlines()) if t]


def _load_logo_base64(logo_path: Optional[str] = None) -> Optional[str]:
    candidates = []
    if logo_path:
        if os.path.isabs(logo_path):
            candidates.append(logo_path)
        else:
            candidates.append(str(_BACKEND_ROOT / logo_path.lstrip("/")))
    candidates.append(str(_BACKEND_ROOT / "uploads" / "logo.png"))
    candidates.append(str(_BACKEND_ROOT / "uploads" / "logo.jpg"))
    candidates.append(str(_BACKEND_ROOT / "static" / "logo.png"))
    for path in candidates:
        if path and os.path.exists(path):
            try:
                with open(path, "rb") as f:
                    return base64.b64encode(f.read()).decode("utf-8")
            except Exception:
                logger.warning("Failed to encode logo image")
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


_CONCEPT_DISPLAY = {
    "BASEBOARD": "Zócalo",
    "FRONT": "Frente",
    "LENGTH": "Longitud",
    "ZOCALOS": "Zócalos",
    "CUTOUT_SINK": "Traforo de Pileta",
    "CUTOUT_COOKTOP": "Traforo de Anafe",
    "CUTOUT_DROPIN_SINK": "Traforo de Pileta de Apoyo",
    "PILETA MOD": "Pileta Mod.",
    "TERMINACION": "Terminación",
    "OTHER": "Otro",
}

_STATUS_SUB_MAP = {
    "PENDING": "Pendiente",
    "ONLINE": "Online",
    "APPROVED": "Aprobado",
    "REJECTED": "Rechazado",
    "CONVERTED_TO_OT": "Convertido a OT",
    "MEASUREMENT": "Medición",
    "WORKSHOP": "En Taller",
    "FINISHED": "Finalizado",
    "DELIVERED": "Entregado",
    "CANCELLED": "Cancelado",
}


def _concept_to_display(concept_code: str, custom: str = "") -> str:
    if concept_code == "OTHER" and custom:
        return custom
    return _CONCEPT_DISPLAY.get(concept_code, concept_code or "—")


def _fmt_num(value, decimals: int = 8) -> str:
    """Format a number for the PDF template.

    xhtml2pdf's Jinja2 has a buggy `|format` filter — instead of running the
    Python format spec it often prints the spec string verbatim
    (`%.2f` literal in the rendered PDF). Pre-formatting on the Python side
    sidesteps the bug entirely and gives us consistent output.
    """
    try:
        n = float(value or 0)
    except (TypeError, ValueError):
        n = 0.0
    return f"{n:,.{decimals}f}".rstrip("0").rstrip(".")


def _fmt_money(value) -> str:
    """Format an ARS/USD amount for the PDF (no currency symbol — the
    template renders `$ ` separately to keep right-aligned numbers tidy)."""
    try:
        n = float(value or 0)
    except (TypeError, ValueError):
        n = 0.0
    return f"{n:,.2f}"


def _fmt_unit(value, decimals: int = 8, suffix: str = "") -> str:
    """Format a measurement-like value with an optional unit suffix."""
    return f"{_fmt_num(value, decimals)} {suffix}".strip()


def _parse_fabrication_details(raw) -> list[dict]:
    if not raw:
        return []
    import json as _json
    try:
        parsed = _json.loads(raw) if isinstance(raw, str) else raw
        items = parsed if isinstance(parsed, list) else []
    except (_json.JSONDecodeError, TypeError):
        return []

    # Concepts that are priced per square meter (Largo × Ancho × Cant × $/m²).
    # Map to the English concept code shipped by the frontend today; keep the
    # legacy Spanish keys so older rows still classify correctly.
    M2_CONCEPTS = {"LENGTH", "BASEBOARD", "FRONT", "LARGO", "ZOCALOS", "FRENTE"}
    # Concepts that are billed per piece / per cut (Cant × $).
    UNIT_CONCEPTS = {
        "CUTOUT_SINK", "CUTOUT_COOKTOP", "CUTOUT_DROPIN_SINK", "PILETA MOD",
        "TRAFORO_PILETA", "TRAFORO_ANAFE", "TRAFORO_PILETA_APOYO",
    }
    # Concepts billed per linear meter (Largo × $).
    LINEAR_CONCEPTS = {"TERMINACION"}

    result = []
    for d in items:
        # Accept both legacy Spanish keys (`concepto`, `largo`, `ancho`, …)
        # and the English keys that the frontend now ships after the type
        # migration (`concept`, `length`, `width`, …). Older rows in the DB
        # were stored in Spanish; newer ones in English.
        concept_code = (
            (d.get("concepto") or d.get("concept") or "").strip().upper()
        )
        custom = (d.get("concepto_personalizado") or d.get("custom_concept") or "").strip()
        length = float(d.get("largo", 0) or d.get("length", 0) or 0)
        width = float(d.get("ancho", 0) or d.get("width", 0) or 0)
        quantity = float(d.get("cantidad", 1) or d.get("quantity", 1) or 1)
        labor = float(d.get("mano_de_obra", 0) or d.get("labor", 0) or 0)
        price = float(d.get("precio", 0) or d.get("price", 0) or 0)

        # Decide which columns apply. This drives the "—" placeholders the
        # template renders for irrelevant fields — the schema is rich but no
        # single row uses every column.
        is_m2 = concept_code in M2_CONCEPTS
        is_unit = concept_code in UNIT_CONCEPTS
        is_linear = concept_code in LINEAR_CONCEPTS
        show_length = is_m2 or is_linear or length > 0
        show_width = is_m2 or width > 0
        show_m2 = is_m2
        show_quantity = is_m2 or is_unit or quantity > 0

        # M² is meaningful only when we actually have length & width. For
        # unit cuts the cell shows "U" (unit) instead.
        m2_value = round(length * width * quantity, 8) if is_m2 else None

        result.append({
            "concept": _concept_to_display(concept_code, custom),
            "detail": d.get("detalle", "") or d.get("detail", "") or "",
            "material": d.get("material", "") or "",
            "show_length": show_length,
            "show_width": show_width,
            "show_m2": show_m2,
            "show_quantity": show_quantity,
            "length_str": _fmt_unit(length, suffix="m") if show_length and length else None,
            "width_str": _fmt_unit(width, suffix="m") if show_width and width else None,
            "m2_label": "U" if is_unit else _fmt_num(m2_value) if is_m2 else None,
            "quantity": int(quantity) if quantity and float(quantity).is_integer() else quantity,
            "price_str": _fmt_money(price),
        })
    return result


def _build_materials_pdf(main_materials: list, alternatives: list) -> list[dict]:
    result = []
    for src in (main_materials or []) + (alternatives or []):
        length = src.get("largo") or src.get("length", 0) or 0
        width = src.get("ancho") or src.get("width", 0) or 0
        quantity = src.get("cantidad") or src.get("quantity", 1) or 1
        m2 = length * width * quantity
        price_m2 = src.get("precio_m2") or src.get("price_m2", 0) or 0
        subtotal = m2 * price_m2
        result.append({
            "name": src.get("nombre") or src.get("name", ""),
            "color": src.get("color", ""),
            "length_str": _fmt_unit(length, suffix="m"),
            "width_str": _fmt_unit(width, suffix="m"),
            "quantity": int(quantity) if float(quantity).is_integer() else float(quantity),
            "m2_str": _fmt_num(m2),
            "price_m2_str": _fmt_money(price_m2),
            "subtotal_str": _fmt_money(subtotal),
        })
    return result


def _build_pools_pdf(pools: list) -> list[dict]:
    result = []
    for p in pools or []:
        quantity = p.get("cantidad") or p.get("quantity", 1) or 1
        price = p.get("precio") or p.get("price", 0) or 0
        subtotal = price * quantity
        result.append({
            "brand": p.get("marca") or p.get("brand", ""),
            "model": p.get("modelo") or p.get("model", ""),
            "quantity": int(quantity) if float(quantity).is_integer() else float(quantity),
            "price_str": _fmt_money(price),
            "subtotal_str": _fmt_money(subtotal),
        })
    return result


def _render_pdf(html_string: str, footer_text: str = "") -> BytesIO:
    from xhtml2pdf.context import pisaContext
    from xhtml2pdf.document import PmlBaseDoc, PmlPageTemplate, pisaStory
    from xhtml2pdf.util import getBox
    from reportlab.lib.colors import HexColor
    from reportlab.lib.units import mm
    from reportlab.platypus import Frame

    result = BytesIO()

    context = pisaContext(path="", debug=0, capacity=102400)
    context = pisaStory(
        html_string, "", None, 0, None, False, None, context=context,
    )

    pagesize = context.pageSize

    if footer_text:
        class _FooterDoc(PmlBaseDoc):
            def afterPage(self_):
                c = self_.canv
                c.saveState()
                c.setFont("Helvetica", 7)
                c.setFillColor(HexColor("#64748b"))
                c.drawCentredString(pagesize[0] / 2, 8 * mm, footer_text)
                c.restoreState()

        doc_cls = _FooterDoc
    else:
        doc_cls = PmlBaseDoc

    if "body" in context.templateList:
        body = context.templateList["body"]
        del context.templateList["body"]
    else:
        x, y, w, h = getBox("1cm 1cm -1cm -1cm", pagesize)
        body = PmlPageTemplate(
            id="body",
            frames=[Frame(x, y, w, h, id="body",
                           leftPadding=0, rightPadding=0,
                           bottomPadding=0, topPadding=0)],
            pagesize=pagesize,
        )

    doc = doc_cls(
        result,
        pagesize=pagesize,
        author=context.meta.get("author", ""),
        subject=context.meta.get("subject", ""),
        keywords=[k.strip() for k in context.meta.get("keywords", "").split(",") if k.strip()],
        title=context.meta.get("title", ""),
        showBoundary=0,
        allowSplitting=1,
    )
    doc.addPageTemplates([body, *list(context.templateList.values())])
    doc.build(context.story)

    result.seek(0)
    return result


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
        results.append(encoded)

    return results


def generate_budget_pdf(data: dict, logo_path: Optional[str] = None) -> BytesIO:
    template = _env.get_template("document_pdf.html")

    ctx = dict(data)
    ctx["logo_base64"] = _load_logo_base64(logo_path)
    ctx["croquis_images"] = _sketch_to_png_base64_list(data.get("sketch_elements") or [])

    html_str = template.render(**ctx)
    return _render_pdf(html_str, footer_text=data.get("pdf_footer") or "")


def generate_work_order_pdf(data: dict, logo_path: Optional[str] = None) -> BytesIO:
    template = _env.get_template("document_pdf.html")

    ctx = dict(data)
    ctx["logo_base64"] = _load_logo_base64(logo_path)
    ctx["croquis_images"] = _sketch_to_png_base64_list(data.get("sketch_elements") or [])

    html_str = template.render(**ctx)
    return _render_pdf(html_str, footer_text=data.get("pdf_footer") or "")


def _resolve_catalogue_adjustment(db, data: dict) -> dict:
    """Compute the catalogue-driven surcharge / discount for the PDF
    footer / totals breakdown.

    The form (frontend `useBudgetCalculations` + `buildPdfData` hook)
    and the server-side `_recalculate_totals_from_items` already apply
    this rule when persisting `total` / `total_usd`. The PDF only
    shows a single "TOTAL" line, so the customer can't see the
    surcharge / discount that came from the catalogue. This helper
    surfaces it as discrete breakdown lines (the template uses them
    to render `Recargo (X%)` / `Descuento (X%)` rows + a per-cuota
    table).

    Returns a dict with:
      - catalogue_surcharge_percentage: effective % (0 when N/A)
      - catalogue_surcharge_amount: ARS amount (0 when N/A)
      - catalogue_discount_percentage: effective % (0 when N/A)
      - catalogue_discount_amount: ARS amount (0 when N/A)
      - catalogue_method_label: the row's display label (or "")
      - catalogue_method_name: the row's stable `name` (or "")
      - installments: int (echoed for the footer line)
      - catalogue_installment_detail: list of {cuota, interes, monto}
        for the per-cuota table (only when the method is a credit-card
        percentage surcharge).
    """
    from app.models.reference import PaymentMethod  # local import: avoid cold-start cycle

    pm_id = data.get("payment_method_id")
    pm_name = data.get("payment_method")
    installments = int(data.get("installments") or 1)
    pm = None
    if pm_id:
        pm = db.query(PaymentMethod).filter(PaymentMethod.id == pm_id).first()
    if pm is None and pm_name:
        pm = db.query(PaymentMethod).filter(PaymentMethod.name == pm_name).first()
    if pm is None or pm.type not in ("DISCOUNT", "SURCHARGE") or not pm.value:
        return {
            "catalogue_surcharge_percentage": 0,
            "catalogue_surcharge_amount": 0.0,
            "catalogue_discount_percentage": 0,
            "catalogue_discount_amount": 0.0,
            "catalogue_method_label": "",
            "catalogue_method_name": "",
            "installments": installments,
            "catalogue_installment_detail": [],
        }

    # Credit-card rule (current spec): *recargo lineal por cuota*.
    # El interés `value%` se aplica N veces al total, después se
    # divide en N cuotas iguales. Total = `base × (1 + N × value/100)`.
    value = float(pm.value)
    ratio = 1.0
    if pm.applies_to_installments:
        n = max(1, installments)
        ratio = 1 + n * (value / 100)
    elif pm.is_percentage:
        ratio = 1 - value / 100 if pm.type == "DISCOUNT" else 1 + value / 100

    subtotal = float(data.get("subtotal") or 0)
    transport = float(data.get("transport") or 0)
    discount_pct = float(data.get("discount_percentage") or 0)
    discount_fijo = float(data.get("discount_fixed_amount") or 0)
    base = max(0.0, subtotal + transport)
    if discount_pct > 0:
        base = round(base * (1 - discount_pct / 100))
    elif discount_fijo > 0:
        base = max(0.0, base - discount_fijo)

    # Per-cuota breakdown (only when this is a credit-card percentage
    # surcharge with installments >= 1). Regla actual: las N cuotas
    # son uniformes — todas cargan el mismo `interes` (el `value` del
    # catálogo, p.ej. 9) y el mismo `monto` (total / N). El total
    # ya incluye el recargo (N × value%) porque la `base` pasada
    # arriba es el subtotal+traslado-descuento previo al catálogo.
    installment_detail: list = []
    if pm.type == "SURCHARGE" and pm.is_percentage and installments >= 1:
        n = max(1, installments)
        total_with_surcharge = base * ratio
        per_cuota = round(total_with_surcharge / n, 2) if total_with_surcharge > 0 else 0.0
        for i in range(1, int(n) + 1):
            installment_detail.append(
                {
                    "cuota": i,
                    "interes": value,
                    "monto": per_cuota,
                }
            )

    if pm.type == "SURCHARGE":
        if pm.is_percentage:
            # Round headline % to 2dp so floating point noise
            # (1.09 → 9.000000000000007) doesn't leak into the PDF.
            headline_pct = round((ratio - 1) * 100, 2)
            surcharge_amount = round(base * (ratio - 1))
            return {
                "catalogue_surcharge_percentage": headline_pct,
                "catalogue_surcharge_amount": float(surcharge_amount),
                "catalogue_discount_percentage": 0,
                "catalogue_discount_amount": 0.0,
                "catalogue_method_label": pm.label or pm.name,
                "catalogue_method_name": pm.name,
                "installments": installments,
                "catalogue_installment_detail": installment_detail,
            }
        # Fixed ARS surcharge
        return {
            "catalogue_surcharge_percentage": 0,
            "catalogue_surcharge_amount": value,
            "catalogue_discount_percentage": 0,
            "catalogue_discount_amount": 0.0,
            "catalogue_method_label": pm.label or pm.name,
            "catalogue_method_name": pm.name,
            "installments": installments,
            "catalogue_installment_detail": installment_detail,
        }
    # pm.type == "DISCOUNT"
    if pm.is_percentage:
        discount_amount = round(base * (1 - ratio))
        return {
            "catalogue_surcharge_percentage": 0,
            "catalogue_surcharge_amount": 0.0,
            "catalogue_discount_percentage": round((1 - ratio) * 100, 2),
            "catalogue_discount_amount": float(discount_amount),
            "catalogue_method_label": pm.label or pm.name,
            "catalogue_method_name": pm.name,
            "installments": installments,
            "catalogue_installment_detail": [],
        }
    # Fixed ARS discount
    return {
        "catalogue_surcharge_percentage": 0,
        "catalogue_surcharge_amount": 0.0,
        "catalogue_discount_percentage": 0,
        "catalogue_discount_amount": value,
        "catalogue_method_label": pm.label or pm.name,
        "catalogue_method_name": pm.name,
        "installments": installments,
        "catalogue_installment_detail": [],
    }


def build_budget_pdf_data(budget_data: dict, client_dict: dict, company: dict, terms: dict, db=None) -> dict:
    from app.services.budget_calculator import filter_main_materials, parse_materials_data

    materiales_raw = parse_materials_data(budget_data.get("materials_data"))
    main_materials = filter_main_materials(materiales_raw)
    alternatives = [m for m in materiales_raw if m.get("is_alternative") or m.get("es_alternativa")]

    fabrication_details = _parse_fabrication_details(budget_data.get("fabrication_details"))
    materials = _build_materials_pdf(main_materials, alternatives)
    pools = _build_pools_pdf(parse_materials_data(budget_data.get("pools_data")) or [])

    subtotal_ars = float(budget_data.get("subtotal") or 0)
    transport = float(budget_data.get("transport") or 0)
    desc_pct = float(budget_data.get("discount_percentage") or 0)
    desc_fijo = float(budget_data.get("discount_fixed_amount") or 0)
    total_ars = float(budget_data.get("total") or 0)
    total_usd_val = float(budget_data.get("total_usd") or 0)
    sena = float(budget_data.get("deposit_received") or 0)
    saldo = max(0, float(budget_data.get("balance_due") or (total_ars - sena)))

    important_obs = budget_data.get("important_observations") or ""
    status = budget_data.get("status", "")

    return {
        # Header
        "title": "PRESUPUESTO",
        "number": budget_data.get("number", ""),
        "doc_sub": _STATUS_SUB_MAP.get(status, ""),
        "date": _format_date(budget_data.get("date", "")),

        # Client
        "client_name": client_dict.get("name", ""),
        "client_phone": client_dict.get("phone", ""),
        "client_address": client_dict.get("address", ""),
        "client_email": client_dict.get("email", ""),

        # Material specs
        "material_color": budget_data.get("color", ""),
        "material_thickness": budget_data.get("thickness", ""),
        "material_finish": budget_data.get("finish", ""),
        "delivery_date": _format_date(budget_data.get("delivery_date", "")),

        # Fabrication details (English field names)
        "fabrication_details": fabrication_details,

        # Materials (English field names with computed m2/subtotal)
        "materials": materials,

        # Pools (English field names with computed subtotal)
        "pools": pools,

        # Financial
        "subtotal": subtotal_ars,
        "transport": transport,
        "discount_percentage": desc_pct,
        "discount_fixed_amount": desc_fijo,
        "deposit_received": sena,
        "balance_due": saldo,
        "total": total_ars,
        "total_usd": total_usd_val,
        "payment_method": budget_data.get("payment_method", ""),
        "installments": budget_data.get("installments", 1),

        # Catalogue-driven surcharge / discount (see
        # `_resolve_catalogue_adjustment`). Without these the PDF only
        # shows the operator-typed manual discount; the surcharge or
        # discount that came from the `payment_methods` catalogue is
        # silently absorbed into the TOTAL line.
        **(
            _resolve_catalogue_adjustment(db, budget_data)
            if db is not None
            else {
                "catalogue_surcharge_percentage": 0,
                "catalogue_surcharge_amount": 0.0,
                "catalogue_discount_percentage": 0,
                "catalogue_discount_amount": 0.0,
                "catalogue_method_label": "",
                "catalogue_method_name": "",
                "installments": budget_data.get("installments", 1),
                "catalogue_installment_detail": [],
            }
        ),

        # Observations
        "notes": budget_data.get("notes") or "",
        "important_observations": important_obs,
        "important_observations_list": _split_terms(important_obs),

        # Terms
        "document_type": "budget",
        "budget_terms_list": _split_terms((terms or {}).get("budget_terms") or ""),
        "warranty_terms_list": _split_terms((terms or {}).get("warranty_text") or ""),

        # Validity
        "validity_days": budget_data.get("validity_days", 15),
        "estimated_date": _format_date(budget_data.get("estimated_date", "")),

        # Sketch (raw data, converted to PNG by generate_budget_pdf)
        "sketch_elements": budget_data.get("sketch_elements"),

        # Company
        "company_name": company.get("company_name", "AFAMAR"),
        "company_tagline": company.get("company_tagline", "MÁRMOLES & GRANITOS"),
        "company_address": company.get("company_address", ""),
        "company_phone": company.get("company_phone", ""),
        "company_email": company.get("company_email", ""),
        "pdf_footer": company.get("pdf_footer", ""),
    }


def _parse_raw_list(raw):
    """Parse a JSON array (string or list) into a list of dicts, else []."""
    if not raw:
        return []
    import json as _json
    try:
        parsed = _json.loads(raw) if isinstance(raw, str) else raw
        return parsed if isinstance(parsed, list) else []
    except (_json.JSONDecodeError, TypeError):
        return []


def _build_measurement_comparison(
    materiales_raw: list,
    usd_rate: float = 0,
    fabrication_raw: str = None,
    additional_raw: str = None,
) -> list[dict]:
    """Build "COMPARATIVA DE MEDICIÓN" rows from `materials_data`.

    One primary row per main material with its M² Real (length × width ×
    quantity), M² Presupuestado (the snapshot `m2_budgeted` taken at
    conversion time) and their Diferencia. Only main materials participate
    (alternatives are filtered out upstream by `filter_main_materials`).

    Each primary row carries a monetary DIFERENCIA subtotal (ARS + USD): the
    price of the m² delta `(real − budgeted) × price/m²` in the material's
    native currency, converted to both currencies with `usd_rate` — i.e. the
    material's own delta ONLY.

    Directly below each material, linked zócalo/frente rows are emitted as
    indented detail rows (`is_detail=True`) showing only their own monetary
    delta (ARS + USD, signed) — one line per linked row from BOTH sources
    (fabrication_details + additional_works_data) whose `material` /
    `materialName` matches the material's name. A linked row's delta is
    `subtotal − total_*_budgeted` (snapshot taken at conversion), capturing
    measure (M²/ML) and material re-assignment changes. Global / unmatched
    rows are ignored.
    """

    def _delta(actual, budgeted):
        return 0 if budgeted is None else actual - budgeted

    def _signed(value):
        return f"{'+' if value > 0 else ''}{_fmt_money(value)}"

    def _measure_str(value, unit, sign=False):
        if value is None or not unit:
            return None
        body = f"{'+' if sign and value > 0 else ''}{_fmt_num(value)}"
        return f"{body} {unit}"

    _FAB_M2_CONCEPTS = {"LENGTH", "BASEBOARD", "FRONT", "LARGO", "ZOCALOS", "FRENTE"}
    _FAB_LINEAR_CONCEPTS = {"TERMINACION"}

    _FAB_LABELS = {
        "BASEBOARD": "Zócalo",
        "ZOCALOS": "Zócalo",
        "FRONT": "Frente",
        "FRENTE": "Frente",
        "LENGTH": "Longitud",
        "TERMINACION": "Terminación",
    }

    fabrication_items = _parse_raw_list(fabrication_raw)
    additional_items = _parse_raw_list(additional_raw)

    rows = []
    for mat in materiales_raw or []:
        if not isinstance(mat, dict):
            continue
        length = float(mat.get("length") or mat.get("largo") or 0)
        width = float(mat.get("width") or mat.get("ancho") or 0)
        quantity = float(mat.get("quantity") or mat.get("cantidad") or 1)
        m2_real = length * width * quantity
        m2_budgeted = float(mat.get("m2_budgeted") or 0)
        delta = m2_real - m2_budgeted
        currency = "USD" if str(mat.get("currency") or "").upper() == "USD" else "ARS"
        price_m2 = (
            float(mat.get("price_m2_usd") or mat.get("precio_m2_usd") or 0)
            if currency == "USD"
            else float(mat.get("price_m2") or mat.get("precio_m2") or 0)
        )
        delta_native = delta * price_m2
        subtotal_ars = delta_native if currency == "ARS" else (delta_native * usd_rate if usd_rate > 0 else 0)
        subtotal_usd = delta_native if currency == "USD" else (delta_native / usd_rate if usd_rate > 0 else 0)
        name = mat.get("name") or mat.get("nombre") or ""

        if m2_real > 0 or m2_budgeted > 0:
            rows.append({
                "name": name,
                "is_detail": False,
                "m2_budgeted_str": _fmt_num(m2_budgeted) if m2_budgeted else None,
                "m2_real_str": _fmt_num(m2_real),
                "delta_str": f"{'+' if delta > 0 else ''}{_fmt_num(delta)}" if m2_budgeted else None,
                "subtotal_ars_str": _signed(subtotal_ars) if m2_budgeted else None,
                "subtotal_usd_str": _signed(subtotal_usd) if m2_budgeted else None,
                "subtotal_ars": subtotal_ars,
                "subtotal_usd": subtotal_usd,
            })

        # Indented detail rows — zócalo/frente from the fabrication table.
        for d in fabrication_items:
            mat_name = (d.get("material") or d.get("material_name") or "").strip()
            if not mat_name or mat_name != name:
                continue
            d_currency = "USD" if str(d.get("currency") or "").upper() == "USD" else "ARS"
            line_total = float(d.get("price") or d.get("precio") or 0) * float(d.get("quantity") or d.get("cantidad") or 1)
            line_ars = line_total if d_currency == "ARS" else (line_total * usd_rate if usd_rate > 0 else 0)
            line_usd = line_total if d_currency == "USD" else (line_total / usd_rate if usd_rate > 0 else 0)
            d_ars = _delta(line_ars, d.get("total_ars_budgeted"))
            d_usd = _delta(line_usd, d.get("total_usd_budgeted"))
            concept_code = str(d.get("concept") or d.get("concepto") or "").strip().upper()
            label = f"{_FAB_LABELS.get(concept_code, concept_code or 'Trabajo de fabricación')} {name}".strip()
            # Measure unit follows the concept: m² for zócalos/frentes, ml for
            # linear work. Budgeted = the `m2_budgeted` / `linear_meters_budgeted`
            # snapshot taken at conversion; legacy rows without it show '—'.
            fd_length = float(d.get("length") or d.get("largo") or 0)
            fd_width = float(d.get("width") or d.get("ancho") or 0)
            fd_qty = float(d.get("quantity") or d.get("cantidad") or 1)
            if concept_code in _FAB_M2_CONCEPTS:
                unit = "m²"
                real = fd_length * fd_width * fd_qty
                budgeted = d.get("m2_budgeted")
                budgeted = None if budgeted is None else float(budgeted)
            elif concept_code in _FAB_LINEAR_CONCEPTS:
                unit = "ml"
                real = fd_length * fd_qty
                budgeted = d.get("linear_meters_budgeted")
                budgeted = None if budgeted is None else float(budgeted)
            else:
                unit = None
                real = None
                budgeted = None
            d_delta = None if (budgeted is None or real is None) else real - budgeted
            rows.append({
                "name": label,
                "is_detail": True,
                "m2_budgeted_str": None,
                "m2_real_str": None,
                "delta_str": None,
                "measure_budgeted": budgeted,
                "measure_real": real,
                "measure_delta": d_delta,
                "measure_unit": unit,
                "measure_budgeted_str": _measure_str(budgeted, unit),
                "measure_real_str": _measure_str(real, unit),
                "measure_delta_str": _measure_str(d_delta, unit, sign=True),
                "subtotal_ars_str": _signed(d_ars),
                "subtotal_usd_str": _signed(d_usd),
                "subtotal_ars": d_ars,
                "subtotal_usd": d_usd,
            })

        # Indented detail rows — frentes/adicionales from the catalogue,
        # assigned to this material (globals are shown separately).
        for r in additional_items:
            raw_mat = str(r.get("materialName") or r.get("material_name") or "")
            if not raw_mat or raw_mat == "POOL_MATERIAL_GLOBAL":
                continue
            if raw_mat.startswith("__ALT__:"):
                raw_mat = raw_mat[len("__ALT__:"):]
            if raw_mat != name:
                continue
            r_currency = "USD" if str(r.get("currency") or "").upper() == "USD" else "ARS"
            price = float(r.get("price") or 0)
            quantity = float(r.get("quantity") or 1)
            total_src = float(r.get("total") or price * quantity)
            line_ars = total_src if r_currency == "ARS" else (total_src * usd_rate if usd_rate > 0 else 0)
            line_usd = total_src if r_currency == "USD" else (total_src / usd_rate if usd_rate > 0 else 0)
            d_ars = _delta(line_ars, r.get("total_ars_budgeted"))
            d_usd = _delta(line_usd, r.get("total_usd_budgeted"))
            label = str(r.get("name") or "Trabajo adicional")
            # Frentes are measured in ml (snapshot `linear_meters_budgeted`);
            # flat works carry no measure at all.
            is_frente = str(r.get("type") or "").lower() == "frente"
            if is_frente:
                unit = "ml"
                real = None if r.get("linear_meters") is None else float(r.get("linear_meters"))
                budgeted = r.get("linear_meters_budgeted")
                budgeted = None if budgeted is None else float(budgeted)
            else:
                unit = None
                real = None
                budgeted = None
            r_delta = None if (budgeted is None or real is None) else real - budgeted
            rows.append({
                "name": label,
                "is_detail": True,
                "m2_budgeted_str": None,
                "m2_real_str": None,
                "delta_str": None,
                "measure_budgeted": budgeted,
                "measure_real": real,
                "measure_delta": r_delta,
                "measure_unit": unit,
                "measure_budgeted_str": _measure_str(budgeted, unit),
                "measure_real_str": _measure_str(real, unit),
                "measure_delta_str": _measure_str(r_delta, unit, sign=True),
                "subtotal_ars_str": _signed(d_ars),
                "subtotal_usd_str": _signed(d_usd),
                "subtotal_ars": d_ars,
                "subtotal_usd": d_usd,
            })
    return rows


def build_work_order_pdf_data(order_data: dict, client_dict: dict, company: dict, terms: dict, db=None) -> dict:
    from app.services.budget_calculator import filter_main_materials, parse_materials_data

    materiales_raw = parse_materials_data(order_data.get("materials_data"))
    main_materials = filter_main_materials(materiales_raw)

    fabrication_details = _parse_fabrication_details(order_data.get("fabrication_details"))
    materials = _build_materials_pdf(main_materials, [])
    pools = _build_pools_pdf(parse_materials_data(order_data.get("pools_data")) or [])

    total_ars = float(order_data.get("total") or 0)
    total_usd_val = float(order_data.get("total_usd") or 0)
    sena = float(order_data.get("deposit_received") or 0)
    deposit_usd = float(order_data.get("deposit_usd") or 0)
    deposit_currency = (order_data.get("deposit_currency") or "ARS").upper()
    # The Seña row mirrors the frontend preview: it always shows the
    # native amount (USD when `deposit_currency == 'USD'`, ARS otherwise)
    # alongside its converted equivalent so the customer has both on
    # paper. Derived server-side because the legacy xhtml2pdf template
    # can't compute.
    usd_rate_for_pdf = float(order_data.get("usd_rate") or settings.DEFAULT_USD_RATE)
    deposit_ars_equivalent = (
        deposit_usd * usd_rate_for_pdf if deposit_currency == "USD" and usd_rate_for_pdf > 0
        else sena
    )
    deposit_usd_equivalent = (
        sena / usd_rate_for_pdf if deposit_currency != "USD" and usd_rate_for_pdf > 0
        else deposit_usd
    )
    saldo = max(0, float(order_data.get("balance_due") or (total_ars - sena)))

    important_obs = order_data.get("important_observations") or ""
    status = order_data.get("status", "")

    # COMPARATIVA DE MEDICIÓN — only for work orders, and only when the
    # per-order flag is true (toggled in the form; defaults to on). Rows
    # are always computed from `materials_data` so the template can render
    # them without further parsing. Only main materials participate
    # (alternatives are filtered out by `filter_main_materials`), matching
    # the form's table.
    include_comparison = bool(order_data.get("include_measurement_comparison_in_pdf", True))
    usd_rate_value = float(order_data.get("usd_rate") or 0) or settings.DEFAULT_USD_RATE
    measurement_comparison = (
        _build_measurement_comparison(
            main_materials,
            usd_rate_value,
            order_data.get("fabrication_details"),
            order_data.get("additional_works_data"),
        )
        if include_comparison
        else []
    )

    return {
        # Header
        "title": "ORDEN DE TRABAJO",
        "number": order_data.get("number", ""),
        "doc_sub": _STATUS_SUB_MAP.get(status, ""),
        "date": _format_date(order_data.get("date", "")),

        # Client
        "client_name": client_dict.get("name", ""),
        "client_phone": client_dict.get("phone", ""),
        "client_address": client_dict.get("address", ""),
        "client_email": client_dict.get("email", ""),

        # Material specs
        "material_color": order_data.get("color", ""),
        "material_thickness": order_data.get("thickness", ""),
        "material_finish": order_data.get("finish", ""),
        "delivery_date": _format_date(order_data.get("delivery_date", "")),

        # Fabrication details (English field names)
        "fabrication_details": fabrication_details,

        # Materials (English field names with computed m2/subtotal)
        "materials": materials,

        # COMPARATIVA DE MEDICIÓN (Concepto | M² Real | M² Presupuestado |
        # Diferencia). Empty when the per-order flag is off.
        "measurement_comparison": measurement_comparison,
        "measurement_comparison_total_ars": (
            f"{'+' if (t := sum(r['subtotal_ars'] for r in measurement_comparison)) > 0 else ''}{_fmt_money(t)}"
            if measurement_comparison else ""
        ),
        "measurement_comparison_total_usd": (
            f"{'+' if (t := sum(r['subtotal_usd'] for r in measurement_comparison)) > 0 else ''}{_fmt_money(t)}"
            if measurement_comparison else ""
        ),

        # Pools (English field names with computed subtotal)
        "pools": pools,

        # Financial
        "subtotal": float(order_data.get("subtotal") or 0),
        "transport": float(order_data.get("transport") or 0),
        "discount_percentage": float(order_data.get("discount_percentage") or 0),
        "discount_fixed_amount": float(order_data.get("discount_fixed_amount") or 0),
        "deposit_received": sena,
        "deposit_usd": deposit_usd,
        "deposit_currency": deposit_currency,
        "deposit_ars_equivalent": deposit_ars_equivalent,
        "deposit_usd_equivalent": deposit_usd_equivalent,
        "balance_due": saldo,
        "total": total_ars,
        "total_usd": total_usd_val,
        "payment_method": order_data.get("payment_method", ""),
        "installments": order_data.get("installments", 1),

        # Catalogue-driven surcharge / discount (see
        # `_resolve_catalogue_adjustment`). When `db` is None (legacy
        # call site) the template gets 0s and behaves as before.
        **(
            _resolve_catalogue_adjustment(db, order_data)
            if db is not None
            else {
                "catalogue_surcharge_percentage": 0,
                "catalogue_surcharge_amount": 0.0,
                "catalogue_discount_percentage": 0,
                "catalogue_discount_amount": 0.0,
                "catalogue_method_label": "",
                "catalogue_method_name": "",
                "installments": order_data.get("installments", 1),
                "catalogue_installment_detail": [],
            }
        ),

        # Observations
        "notes": order_data.get("notes", ""),
        "important_observations": important_obs,
        "important_observations_list": _split_terms(important_obs),

        # Terms
        "document_type": "work_order",
        "delivery_terms_list": _split_terms((terms or {}).get("delivery_terms") or ""),
        "warranty_terms_list": _split_terms((terms or {}).get("warranty_text") or ""),

        # Validity (work orders don't have these, use defaults)
        "validity_days": order_data.get("validity_days", 15),
        "estimated_date": _format_date(order_data.get("estimated_date", "")),

        # Sketch (raw data, converted to PNG by generate_work_order_pdf).
        # Prefer the dedicated `sketch_elements` column (populated by
        # `WorkOrderService.create_from_budget`); fall back to the legacy
        # `budgeted_details` stash for WOs that pre-date the new column.
        "sketch_elements": order_data.get("sketch_elements") or order_data.get("budgeted_details"),

        # Company
        "company_name": company.get("company_name", "AFAMAR"),
        "company_tagline": company.get("company_tagline", "MÁRMOLES & GRANITOS"),
        "company_address": company.get("company_address", ""),
        "company_phone": company.get("company_phone", ""),
        "company_email": company.get("company_email", ""),
        "pdf_footer": company.get("pdf_footer", ""),
    }
