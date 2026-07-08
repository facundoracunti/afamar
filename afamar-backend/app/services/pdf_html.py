import base64
import os
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Optional

from jinja2 import Environment, FileSystemLoader, select_autoescape
from PIL import Image as PILImage, ImageDraw
from xhtml2pdf import pisa

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


def _fmt_num(value, decimals: int = 2) -> str:
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
    return f"{n:,.{decimals}f}"


def _fmt_money(value) -> str:
    """Format an ARS/USD amount for the PDF (no currency symbol — the
    template renders `$ ` separately to keep right-aligned numbers tidy)."""
    try:
        n = float(value or 0)
    except (TypeError, ValueError):
        n = 0.0
    return f"{n:,.2f}"


def _fmt_unit(value, decimals: int = 2, suffix: str = "") -> str:
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
        m2_value = round(length * width * quantity, 4) if is_m2 else None

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


def build_budget_pdf_data(budget_data: dict, client_dict: dict, company: dict, terms: dict) -> dict:
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


def build_work_order_pdf_data(order_data: dict, client_dict: dict, company: dict, terms: dict) -> dict:
    from app.services.budget_calculator import filter_main_materials, parse_materials_data

    materiales_raw = parse_materials_data(order_data.get("materials_data"))
    main_materials = filter_main_materials(materiales_raw)

    fabrication_details = _parse_fabrication_details(order_data.get("fabrication_details"))
    materials = _build_materials_pdf(main_materials, [])
    pools = _build_pools_pdf(parse_materials_data(order_data.get("pools_data")) or [])

    total_ars = float(order_data.get("total") or 0)
    total_usd_val = float(order_data.get("total_usd") or 0)
    sena = float(order_data.get("deposit_received") or 0)
    saldo = max(0, float(order_data.get("balance_due") or (total_ars - sena)))

    important_obs = order_data.get("important_observations") or ""
    status = order_data.get("status", "")

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

        # Pools (English field names with computed subtotal)
        "pools": pools,

        # Financial
        "subtotal": float(order_data.get("subtotal") or 0),
        "transport": float(order_data.get("transport") or 0),
        "discount_percentage": float(order_data.get("discount_percentage") or 0),
        "discount_fixed_amount": float(order_data.get("discount_fixed_amount") or 0),
        "deposit_received": sena,
        "balance_due": saldo,
        "total": total_ars,
        "total_usd": total_usd_val,
        "payment_method": order_data.get("payment_method", ""),
        "installments": order_data.get("installments", 1),

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
