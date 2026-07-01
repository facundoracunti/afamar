import base64
import io
import json

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    HRFlowable,
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

PAGE_W, PAGE_H = A4
RED = colors.HexColor("#c0392b")
DARK = colors.HexColor("#1a1a1a")
GRAY = colors.HexColor("#64748b")
MED_GRAY = colors.HexColor("#bdc3c7")
LIGHT_GRAY = colors.HexColor("#e2e8f0")
CARD_BG = colors.HexColor("#f8f9fa")
RED_BG = colors.HexColor("#fff9f9")
RED_BORDER = colors.HexColor("#f5c6cb")
WHITE = colors.white


def _fmt_ars(v):
    try:
        return f"$ {float(v):,.2f}"
    except (ValueError, TypeError):
        return "$ 0.00"


def _fmt_usd(v):
    try:
        return f"USD {float(v):,.2f}"
    except (ValueError, TypeError):
        return "USD 0.00"


def _build_styles():
    s = getSampleStyleSheet()
    return {
        "n": ParagraphStyle("n", parent=s["Normal"], fontSize=9, leading=13, fontName="Helvetica"),
        "b": ParagraphStyle("b", parent=s["Normal"], fontSize=9, leading=13, fontName="Helvetica-Bold"),
        "s": ParagraphStyle("s", parent=s["Normal"], fontSize=8, leading=10, textColor=GRAY, fontName="Helvetica"),
        "label": ParagraphStyle("lbl", fontName="Helvetica", fontSize=8.5, textColor=GRAY, alignment=TA_CENTER),
        "value": ParagraphStyle("val", fontName="Helvetica-Bold", fontSize=8.5, textColor=DARK, alignment=TA_CENTER),
        "card_title": ParagraphStyle("ct", fontName="Helvetica-Bold", fontSize=9, textColor=DARK, spaceAfter=4),
        "serif": ParagraphStyle("serif", fontName="Times-Bold", fontSize=22, textColor=DARK),
        "red_title": ParagraphStyle("rt", fontName="Helvetica-Bold", fontSize=13, textColor=RED, alignment=TA_CENTER),
        "total_ars": ParagraphStyle("ta", fontName="Helvetica-Bold", fontSize=12, textColor=RED),
        "note": ParagraphStyle("note", fontName="Helvetica", fontSize=8, leading=12, textColor=RED),
        "small": ParagraphStyle("sm", fontName="Helvetica", fontSize=8, leading=10, textColor=DARK),
        "pill": ParagraphStyle("pill", fontName="Helvetica-Bold", fontSize=8, textColor=colors.HexColor("#2c3e50")),
    }


def _divider():
    return HRFlowable(width="100%", thickness=0.5, color=LIGHT_GRAY, spaceBefore=6, spaceAfter=6)


def _card(title, rows, st):
    card_elements = []
    card_elements.append(Paragraph(title, st["card_title"]))
    card_elements.append(HRFlowable(width="100%", thickness=1.5, color=RED, spaceBefore=2, spaceAfter=6))
    card_data = []
    for label, value in rows:
        card_data.append([
            Paragraph(label, st["label"]),
            Paragraph(str(value), st["value"]),
        ])
    t = Table(card_data, colWidths=[55, 90])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    card_elements.append(t)
    return card_elements


def _pill(text):
    st = _build_styles()
    p = Paragraph(text, st["pill"])
    t = Table([[p]], colWidths=[None])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CARD_BG),
        ("BOX", (0, 0), (-1, -1), 1, MED_GRAY),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
    ]))
    return t


def _load_image_from_base64(data_url: str, max_width=140, max_height=50):
    if not data_url or "," not in data_url:
        return None
    try:
        b64_str = data_url.split(",", 1)[1]
        raw = base64.b64decode(b64_str)
        buf = io.BytesIO(raw)
        img = Image(buf, width=max_width, height=max_height)
        img._restrictSize(max_width, max_height)
        return img
    except Exception:
        return None


def generate_budget_pdf(
    budget_data: dict,
    client_data: dict,
    company: dict | None = None,
    terms: dict | None = None,
) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        topMargin=22 * mm, bottomMargin=22 * mm,
        leftMargin=18 * mm, rightMargin=18 * mm,
    )
    st = _build_styles()
    E = []

    company_name = (company or {}).get("company_name") or "AFAMAR"
    company_addr = (company or {}).get("company_address") or ""
    company_phone = (company or {}).get("company_phone") or ""
    company_email = (company or {}).get("company_email") or ""
    company_logo = (company or {}).get("company_logo") or ""

    # ── HEADER ──
    logo_img = _load_image_from_base64(company_logo) if company_logo else None
    header_left = []
    if logo_img:
        header_left.append(logo_img)
    else:
        header_left.append(Paragraph(
            f"<b>{company_name}</b><br/>"
            f"<font size='7' color='#64748b'>MÁRMOLES & GRANITOS</font>",
            st["serif"],
        ))

    header_right = Paragraph(
        f"PRESUPUESTO N°<br/><font size='16'>{budget_data.get('number', '')}</font>",
        st["red_title"],
    )

    info_lines = []
    if company_addr:
        info_lines.append(company_addr)
    if company_phone:
        info_lines.append(f"Tel: {company_phone}")
    if company_email:
        info_lines.append(company_email)
    header_info = Paragraph("<br/>".join(info_lines) if info_lines else "&nbsp;", st["s"])

    header = Table(
        [[header_left, header_right, header_info]],
        colWidths=[190, 160, 120],
    )
    header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    E.append(header)
    E.append(HRFlowable(width="100%", thickness=1, color=RED, spaceBefore=2, spaceAfter=10))

    # ── CLIENTE ──
    client_name = client_data.get("name") or budget_data.get("snapshot_name", "")
    client_phone = client_data.get("phone") or budget_data.get("snapshot_phone", "")
    client_email = client_data.get("email") or budget_data.get("snapshot_email", "")
    client_addr = client_data.get("address") or budget_data.get("snapshot_address", "")

    E.append(Table([
        [
            Paragraph(f"<b>Cliente:</b> {client_name or '-'}", st["n"]),
            Paragraph(f"<b>Teléfono:</b> {client_phone or '-'}", st["n"]),
        ],
        [
            Paragraph(f"<b>Dirección:</b> {client_addr or '-'}", st["n"]),
            Paragraph(f"<b>Email:</b> {client_email or '-'}", st["n"]),
        ],
    ], colWidths=[250, 220]))
    E.append(_divider())

    # ── 3 CARDS (Specs, Fabrication, Financial) ──
    spec_rows = [
        ("Material", budget_data.get("material", "-")),
        ("Color", budget_data.get("color", "-")),
        ("Espesor", budget_data.get("thickness", "-")),
        ("Terminación", budget_data.get("finish", "-")),
        ("Bacha", budget_data.get("bacha", "-")),
        ("Anafe", budget_data.get("anafe", "No incluye")),
        ("Perforaciones", budget_data.get("perforations", "-")),
    ]
    spec_rows = [(label, v) for label, v in spec_rows if v and v != "-" or label in ("Anafe",)]

    # Fabrication details / items
    items = budget_data.get("items", [])
    fab_rows = []
    for item in items:
        desc = item.get("description", item.get("sector", ""))
        m2 = item.get("m2", 0)
        qty = item.get("quantity", 1)
        if desc:
            label = desc[:40] + "..." if len(desc) > 40 else desc
            fab_rows.append((label, f"{m2:.4f} m²" if m2 else f"x{qty}"))

    fab_detail = budget_data.get("fabrication_details", "")
    if fab_detail and not fab_rows:
        for line in fab_detail.split("\n"):
            line = line.strip()
            if line:
                fab_rows.append((line[:40], ""))

    if not fab_rows:
        fab_rows.append(("-", "-"))

    # Financial
    subtotal = budget_data.get("subtotal", 0)
    transport = budget_data.get("transport", 0)
    installation = budget_data.get("installation", 0)
    discount = budget_data.get("discount", 0)
    total = budget_data.get("total", 0)
    total_usd = budget_data.get("total_usd", 0)
    usd_rate = budget_data.get("usd_rate", 0)

    eco_rows = [
        ("Subtotal ARS", _fmt_ars(subtotal)),
    ]
    if transport:
        eco_rows.append(("Transporte ARS", _fmt_ars(transport)))
    if installation:
        eco_rows.append(("Instalación ARS", _fmt_ars(installation)))
    if discount:
        eco_rows.append(("Descuento ARS", _fmt_ars(discount)))

    col1 = _card("ESPECIFICACIONES", spec_rows, st)
    col2 = _card("DET. FABRICACIÓN", fab_rows, st)
    col3 = _card("RES. ECONÓMICO", eco_rows, st)
    col3.append(Spacer(1, 6))
    col3.append(Paragraph(f"<b>TOTAL ARS:</b>  {_fmt_ars(total)}", st["total_ars"]))

    if total_usd:
        col3.append(Spacer(1, 4))
        col3.append(Paragraph(f"<b>TOTAL USD:</b>  {_fmt_usd(total_usd)}", st["total_ars"]))

    if usd_rate:
        col3.append(Spacer(1, 4))
        col3.append(Paragraph(f"<b>T.C. USD:</b> $ {usd_rate:.2f}", st["label"]))

    pool_price = budget_data.get("pool_price", 0)
    if pool_price:
        pool_currency = budget_data.get("pool_currency", "ARS")
        sym = "US$" if pool_currency == "USD" else "$"
        col3.append(Spacer(1, 4))
        col3.append(Paragraph(f"<b>Pool (bacha):</b> {sym} {pool_price:.2f}", st["label"]))

    max_h = max(len(col1), len(col2), len(col3))
    while len(col1) < max_h:
        col1.append(Spacer(1, 12))
    while len(col2) < max_h:
        col2.append(Spacer(1, 12))
    while len(col3) < max_h:
        col3.append(Spacer(1, 12))

    def _wrap_card(content):
        t = Table([[content]], colWidths=[153])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), WHITE),
            ("BOX", (0, 0), (-1, -1), 1, LIGHT_GRAY),
            ("TOPPADDING", (0, 0), (-1, -1), 14),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
            ("LEFTPADDING", (0, 0), (-1, -1), 14),
            ("RIGHTPADDING", (0, 0), (-1, -1), 14),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        return t

    w1, w2, w3 = _wrap_card(col1), _wrap_card(col2), _wrap_card(col3)
    gap = 14
    grid = Table([[w1, "", w2, "", w3]], colWidths=[153, gap, 153, gap, 153])
    grid.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    E.append(grid)

    # ── ADICIONALES TABLE ──
    adicionales = budget_data.get("adicionales", [])
    if adicionales:
        E.append(Spacer(1, 16))
        E.append(Paragraph("<b>ADICIONALES</b>", st["card_title"]))
        E.append(HRFlowable(width="100%", thickness=1.5, color=RED, spaceBefore=2, spaceAfter=6))
        add_header = [["Concepto", "Detalle", "Cant.", "P/U", "Total"]]
        add_rows = []
        for a in adicionales:
            add_rows.append([
                Paragraph(a.get("concept", "") or "", st["n"]),
                Paragraph(a.get("detail", "") or "", st["n"]),
                str(a.get("quantity", 1)),
                _fmt_ars(a.get("unit_price", 0)),
                _fmt_ars(a.get("total", 0)),
            ])
        add_table = Table(add_header + add_rows, colWidths=[3 * cm, 5 * cm, 1.5 * cm, 2.5 * cm, 2.5 * cm])
        add_table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("BACKGROUND", (0, 0), (-1, 0), colors.Color(0.9, 0.9, 0.9)),
            ("ALIGN", (2, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        E.append(add_table)

    # ── SKETCH REFERENCE ──
    sketch_elements = budget_data.get("sketch_elements", [])
    if sketch_elements:
        E.append(Spacer(1, 12))
        cb = Table([
            [Paragraph("CROQUIS / DISEÑO", st["card_title"])],
            [Paragraph("(El presupuesto incluye un croquis digital asociado)", st["s"])],
        ], colWidths=[470])
        cb.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), CARD_BG),
            ("BOX", (0, 0), (-1, -1), 1, LIGHT_GRAY),
            ("TOPPADDING", (0, 0), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ]))
        E.append(cb)

    # ── OBSERVACIONES ──
    obs_lines = []
    design_obs = budget_data.get("design_observations", "")
    important_obs = budget_data.get("important_observations", "")
    notes = budget_data.get("notes", "")
    auto_obs = (terms or {}).get("observaciones_automaticas", "")

    if design_obs:
        obs_lines.append(("Observaciones de diseño:", design_obs))
    if important_obs:
        obs_lines.append(("Observaciones importantes:", important_obs))
    if notes:
        obs_lines.append(("Notas:", notes))
    if auto_obs:
        for line in auto_obs.split("\n"):
            line = line.strip()
            if line:
                obs_lines.append(("", f"✓ {line}"))

    if obs_lines:
        E.append(Spacer(1, 28))
        obs_els = [[Paragraph("OBSERVACIONES", st["card_title"])]]
        for label, text in obs_lines:
            content = f"<b>{label}</b> {text}" if label else text
            obs_els.append([Paragraph(content, st["note"])])
        ot = Table(obs_els, colWidths=[470])
        ot.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), RED_BG),
            ("BOX", (0, 0), (-1, -1), 1, RED_BORDER),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 16),
        ]))
        E.append(ot)

    # ── PAGO PILLS + VALIDEZ ──
    E.append(Spacer(1, 24))
    pills = Table([[
        _pill("Efectivo"),
        _pill("Transferencia"),
        _pill("Tarjeta"),
    ]], colWidths=[None, None, None])
    pills.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (1, 0), (1, 0), 8),
        ("RIGHTPADDING", (2, 0), (2, 0), 8),
    ]))
    E.append(pills)

    E.append(Spacer(1, 10))

    validity = budget_data.get("validity_days", 15)
    estimated = budget_data.get("estimated_delivery") or budget_data.get("estimated_date") or "a convenir"
    payment_method = budget_data.get("payment_method", "")
    installments = budget_data.get("installments", 1)

    info_parts = [f"<b>Validez:</b> {validity} días"]
    if estimated:
        info_parts.append(f"<b>Entrega estimada:</b> {estimated}")
    if payment_method:
        info_parts.append(f"<b>Forma de pago:</b> {payment_method}")
    if installments > 1:
        info_parts.append(f"<b>Cuotas:</b> {installments}")

    E.append(Table([
        [Paragraph(" &nbsp;|&nbsp; ".join(info_parts), st["n"])],
    ], colWidths=[470]))

    # ── DEPOSIT / BALANCE ──
    deposit = budget_data.get("deposit_received", 0)
    balance = budget_data.get("balance_due", 0)
    deposit_usd = budget_data.get("deposit_usd", 0)
    balance_usd = budget_data.get("balance_due_usd", 0)

    if deposit or balance or deposit_usd or balance_usd:
        E.append(Spacer(1, 8))
        bal_parts = []
        if deposit:
            bal_parts.append(f"Seña ARS: {_fmt_ars(deposit)}")
        if balance:
            bal_parts.append(f"Saldo ARS: {_fmt_ars(balance)}")
        if deposit_usd:
            bal_parts.append(f"Seña USD: {_fmt_usd(deposit_usd)}")
        if balance_usd:
            bal_parts.append(f"Saldo USD: {_fmt_usd(balance_usd)}")
        if bal_parts:
            E.append(Paragraph(" | ".join(bal_parts), st["n"]))

    # ── CLIENT SIGNATURE (digital) ──
    digital_sig = budget_data.get("digital_signature", "")
    sig_img = _load_image_from_base64(digital_sig, max_width=120, max_height=40) if digital_sig else None

    # ── FIRMAS ──
    E.append(Spacer(1, 30))
    sig_left = Paragraph("_" * 48, st["n"])
    sig_right = Paragraph("_" * 48, st["n"])

    if sig_img:
        sig_cols = [
            [sig_left, sig_img],
            [
                Paragraph("<b>AFAMAR</b><br/>Responsable", ParagraphStyle("sf", parent=st["small"], alignment=TA_CENTER)),
                Paragraph("<b>CLIENTE CONFORME</b><br/>Firma digital", ParagraphStyle("sc", parent=st["small"], alignment=TA_CENTER)),
            ],
        ]
        sig_table = Table(sig_cols, colWidths=[235, 235])
    else:
        sig_cols = [
            [sig_left, sig_right],
            [
                Paragraph("<b>AFAMAR</b><br/>Responsable", ParagraphStyle("sf", parent=st["small"], alignment=TA_CENTER)),
                Paragraph("<b>CLIENTE CONFORME</b><br/>Firma y aclaración", ParagraphStyle("sc", parent=st["small"], alignment=TA_CENTER)),
            ],
        ]
        sig_table = Table(sig_cols, colWidths=[235, 235])

    sig_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
    ]))
    E.append(sig_table)

    # ── FOOTER TERMS ──
    footer_texts = []
    if terms:
        for key, label in [("budget_terms", "Términos"), ("delivery_terms", "Entrega"), ("warranty_text", "Garantía")]:
            val = terms.get(key)
            if val:
                footer_texts.append(f"<b>{label}:</b> {val}")
    if footer_texts:
        E.append(Spacer(1, 0.5 * cm))
        E.append(HRFlowable(width="100%", color=colors.grey, thickness=0.5))
        for t in footer_texts:
            E.append(Paragraph(t, st["small"]))
        E.append(Spacer(1, 0.2 * cm))

    pdf_footer = (company or {}).get("pdf_footer") or ""
    if pdf_footer:
        E.append(Paragraph(pdf_footer, st["small"]))

    doc.build(E)
    return buffer.getvalue()


def generate_work_order_pdf(
    order_data: dict,
    client_data: dict,
    company: dict | None = None,
    terms: dict | None = None,
) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2 * cm, bottomMargin=2 * cm)
    styles = getSampleStyleSheet()
    elements = []

    title_style = ParagraphStyle("Title2", parent=styles["Title"], fontSize=18, spaceAfter=4)
    normal = styles["Normal"]
    small = ParagraphStyle("Small", parent=normal, fontSize=8, textColor=colors.grey)
    bold_style = ParagraphStyle("Bold", parent=normal, fontSize=10, fontName="Helvetica-Bold")
    body_style = ParagraphStyle("Body", parent=normal, fontSize=10)

    company_name = (company or {}).get("company_name") or "AFAMAR"
    company_addr = (company or {}).get("company_address") or ""
    company_phone = (company or {}).get("company_phone") or ""
    company_email = (company or {}).get("company_email") or ""

    header_lines = [f"<b>{company_name}</b>"]
    if company_addr:
        header_lines.append(company_addr)
    if company_phone:
        header_lines.append(f"Tel: {company_phone}")
    if company_email:
        header_lines.append(company_email)
    elements.append(Paragraph("<br/>".join(header_lines), small))
    elements.append(Spacer(1, 0.3 * cm))

    elements.append(Paragraph(f"Orden de Trabajo N°: {order_data['number']}", title_style))
    elements.append(HRFlowable(width="100%", color=colors.grey, thickness=0.5))
    elements.append(Spacer(1, 0.4 * cm))

    status_labels = {
        "MEASUREMENT": "Medición",
        "WORKSHOP": "En Taller",
        "FINISHED": "Terminada",
        "DELIVERED": "Entregada",
        "CANCELLED": "Cancelada",
    }
    status_label = status_labels.get(order_data.get("status", ""), order_data.get("status", ""))
    elements.append(Paragraph(f"<b>Estado:</b> {status_label}", normal))
    elements.append(Spacer(1, 0.2 * cm))

    client_name = client_data.get("name") or order_data.get("snapshot_name", "")
    client_phone = client_data.get("phone") or order_data.get("snapshot_phone", "")
    client_email = client_data.get("email") or order_data.get("snapshot_email", "")
    client_addr = client_data.get("address") or order_data.get("snapshot_address", "")

    elements.append(Paragraph(f"<b>Cliente:</b> {client_name}", normal))
    if client_phone:
        elements.append(Paragraph(f"<b>Teléfono:</b> {client_phone}", normal))
    if client_email:
        elements.append(Paragraph(f"<b>Email:</b> {client_email}", normal))
    if client_addr:
        elements.append(Paragraph(f"<b>Dirección:</b> {client_addr}", normal))
    elements.append(Spacer(1, 0.3 * cm))

    if order_data.get("priority"):
        elements.append(Paragraph(f"<b>Prioridad:</b> {order_data['priority']}", normal))
    dd = order_data.get("delivery_date")
    if dd:
        if not isinstance(dd, str):
            dd = str(dd)
        elements.append(Paragraph(f"<b>Fecha de entrega:</b> {dd}", normal))
    elements.append(Spacer(1, 0.3 * cm))

    spec_data = [
        ["Material", order_data.get("material", "")],
        ["Color", order_data.get("color", "")],
        ["Espesor", order_data.get("thickness", "")],
        ["Terminación", order_data.get("finish", "")],
        ["Bacha", order_data.get("bacha", "")],
        ["Anafe", order_data.get("anafe", "")],
    ]
    spec_data = [[k, v] for k, v in spec_data if v]
    if spec_data:
        elements.append(Paragraph("<b>Especificaciones:</b>", bold_style))
        elements.append(Spacer(1, 0.1 * cm))
        spec_table = Table(spec_data, colWidths=[4 * cm, 10 * cm])
        spec_table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("BACKGROUND", (0, 0), (0, -1), colors.Color(0.9, 0.9, 0.9)),
        ]))
        elements.append(spec_table)
        elements.append(Spacer(1, 0.3 * cm))

    items = order_data.get("items", [])
    if not items:
        try:
            md = order_data.get("materials_data")
            if md:
                parsed = json.loads(md) if isinstance(md, str) else md
                if isinstance(parsed, list):
                    items = parsed
                elif isinstance(parsed, dict):
                    items = parsed.get("items", [])
        except (json.JSONDecodeError, TypeError):
            pass

    if items:
        elements.append(Paragraph("<b>Items:</b>", bold_style))
        elements.append(Spacer(1, 0.1 * cm))
        header = [["#", "Descripción", "Cant.", "P/U", "Total"]]
        rows = []
        for i, item in enumerate(items, 1):
            rows.append([
                str(i),
                item.get("description", ""),
                str(item.get("quantity", 1)),
                f"$ {item.get('unit_price', 0):.2f}",
                f"$ {item.get('total', 0):.2f}",
            ])
        t = Table(header + rows, colWidths=[1.5 * cm, 9 * cm, 2 * cm, 3 * cm, 3 * cm])
        t.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("BACKGROUND", (0, 0), (-1, 0), colors.Color(0.9, 0.9, 0.9)),
            ("ALIGN", (2, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 0.3 * cm))

    if order_data.get("fabrication_details"):
        elements.append(Paragraph("<b>Detalles de fabricación:</b>", bold_style))
        elements.append(Paragraph(order_data["fabrication_details"], body_style))
        elements.append(Spacer(1, 0.3 * cm))

    ars_rows = [
        ["Subtotal ARS", f"$ {order_data.get('subtotal', 0):.2f}"],
    ]
    if order_data.get("transport", 0) > 0:
        ars_rows.append(["Transporte ARS", f"$ {order_data['transport']:.2f}"])
    if order_data.get("installation", 0) > 0:
        ars_rows.append(["Instalación ARS", f"$ {order_data['installation']:.2f}"])
    if order_data.get("discount", 0) > 0:
        ars_rows.append(["Descuento ARS", f"$ {order_data['discount']:.2f}"])
    if order_data.get("deposit_received", 0) > 0:
        ars_rows.append(["Seña ARS", f"$ {order_data['deposit_received']:.2f}"])
    if order_data.get("balance_due", 0) > 0:
        ars_rows.append(["Saldo ARS", f"$ {order_data['balance_due']:.2f}"])
    ars_rows.append(["Total ARS", f"$ {order_data.get('total', 0):.2f}"])
    ars_tbl = Table(ars_rows, colWidths=[5 * cm, 4 * cm])
    ars_tbl.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("BACKGROUND", (0, 0), (0, -1), colors.Color(0.9, 0.9, 0.9)),
        ("BACKGROUND", (0, -1), (-1, -1), colors.Color(0.8, 0.8, 0.8)),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
    ]))
    elements.append(ars_tbl)
    elements.append(Spacer(1, 0.2 * cm))

    if order_data.get("total_usd", 0) > 0:
        usd_rows = [
            ["Subtotal USD", f"US$ {order_data.get('subtotal_usd', 0):.2f}"],
        ]
        if order_data.get("transport_usd", 0) > 0:
            usd_rows.append(["Transporte USD", f"US$ {order_data['transport_usd']:.2f}"])
        if order_data.get("deposit_usd", 0) > 0:
            usd_rows.append(["Seña USD", f"US$ {order_data['deposit_usd']:.2f}"])
        if order_data.get("balance_due_usd", 0) > 0:
            usd_rows.append(["Saldo USD", f"US$ {order_data['balance_due_usd']:.2f}"])
        usd_rows.append(["Total USD", f"US$ {order_data.get('total_usd', 0):.2f}"])
        usd_tbl = Table(usd_rows, colWidths=[5 * cm, 4 * cm])
        usd_tbl.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("BACKGROUND", (0, 0), (0, -1), colors.Color(0.9, 0.9, 0.9)),
            ("BACKGROUND", (0, -1), (-1, -1), colors.Color(0.8, 0.8, 0.8)),
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ]))
        elements.append(usd_tbl)
        elements.append(Spacer(1, 0.2 * cm))

    usd_rate = order_data.get("usd_rate", 0)
    if usd_rate:
        elements.append(Paragraph(f"<b>Tipo de cambio USD:</b> $ {usd_rate:.2f}", normal))
        elements.append(Spacer(1, 0.2 * cm))

    if order_data.get("payment_method"):
        elements.append(Paragraph(f"<b>Forma de pago:</b> {order_data['payment_method']}", normal))
    if order_data.get("installments", 1) > 1:
        elements.append(Paragraph(f"<b>Cuotas:</b> {order_data['installments']}", normal))

    if order_data.get("pool_price", 0) > 0:
        sym = "US$" if order_data.get("pool_currency") == "USD" else "$"
        elements.append(Paragraph(f"<b>Pool (bacha):</b> {sym} {order_data['pool_price']:.2f}", normal))
        elements.append(Spacer(1, 0.2 * cm))

    if order_data.get("design_observations"):
        elements.append(Spacer(1, 0.2 * cm))
        elements.append(Paragraph("<b>Observaciones de diseño:</b>", bold_style))
        elements.append(Paragraph(order_data["design_observations"], body_style))
    if order_data.get("important_observations"):
        elements.append(Spacer(1, 0.2 * cm))
        elements.append(Paragraph("<b>Observaciones importantes:</b>", bold_style))
        elements.append(Paragraph(order_data["important_observations"], body_style))
    if order_data.get("notes"):
        elements.append(Spacer(1, 0.2 * cm))
        elements.append(Paragraph(f"<b>Notas:</b><br/>{order_data['notes']}", normal))

    footer_texts = []
    if terms:
        for key, label in [("budget_terms", "Términos"), ("delivery_terms", "Entrega"), ("warranty_text", "Garantía")]:
            val = terms.get(key)
            if val:
                footer_texts.append(f"<b>{label}:</b> {val}")
    if footer_texts:
        elements.append(Spacer(1, 0.5 * cm))
        elements.append(HRFlowable(width="100%", color=colors.grey, thickness=0.5))
        for t in footer_texts:
            elements.append(Paragraph(t, small))
        elements.append(Spacer(1, 0.2 * cm))

    elements.append(Spacer(1, 1 * cm))
    sig_table = Table([
        ["Firma del Cliente", "Firma AFAMAR"],
        ["Aclaración", "Aclaración"],
    ], colWidths=[8 * cm, 8 * cm])
    sig_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("LINEABOVE", (0, 0), (0, 0), 0.5, colors.black),
        ("LINEABOVE", (1, 0), (1, 0), 0.5, colors.black),
        ("LINEABOVE", (0, 1), (0, 1), 0.5, colors.black),
        ("LINEABOVE", (1, 1), (1, 1), 0.5, colors.black),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 20),
    ]))
    elements.append(sig_table)

    pdf_footer = (company or {}).get("pdf_footer") or ""
    if pdf_footer:
        elements.append(Spacer(1, 0.3 * cm))
        elements.append(Paragraph(pdf_footer, small))

    doc.build(elements)
    return buffer.getvalue()
