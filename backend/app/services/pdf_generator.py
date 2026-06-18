from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from io import BytesIO
from datetime import datetime

PAGE_W, PAGE_H = A4
RED = colors.HexColor('#c0392b')
DARK = colors.HexColor('#1a1a1a')
GRAY = colors.HexColor('#64748b')
MED_GRAY = colors.HexColor('#bdc3c7')
LIGHT_GRAY = colors.HexColor('#e2e8f0')
CARD_BG = colors.HexColor('#f8f9fa')
RED_BG = colors.HexColor('#fff9f9')
RED_BORDER = colors.HexColor('#f5c6cb')
WHITE = colors.white
GREEN = colors.HexColor('#059669')


def fmt_ars(v):
    try: return f"$ {float(v):,.2f}"
    except: return "$ 0.00"

def fmt_usd(v):
    try: return f"USD {float(v):,.2f}"
    except: return "USD 0.00"


class PDFGenerator:

    @staticmethod
    def _styles():
        s = getSampleStyleSheet()
        return {
            'n': ParagraphStyle('n', parent=s['Normal'], fontSize=9, leading=13, fontName='Helvetica'),
            'b': ParagraphStyle('b', parent=s['Normal'], fontSize=9, leading=13, fontName='Helvetica-Bold'),
            's': ParagraphStyle('s', parent=s['Normal'], fontSize=8, leading=10, textColor=GRAY, fontName='Helvetica'),
            'label': ParagraphStyle('lbl', fontName='Helvetica', fontSize=8.5, textColor=GRAY, alignment=TA_LEFT),
            'value': ParagraphStyle('val', fontName='Helvetica-Bold', fontSize=8.5, textColor=DARK, alignment=TA_RIGHT),
            'card_title': ParagraphStyle('ct', fontName='Helvetica-Bold', fontSize=9, textColor=DARK, spaceAfter=4),
            'serif': ParagraphStyle('serif', fontName='Times-Bold', fontSize=22, textColor=DARK),
            'red_title': ParagraphStyle('rt', fontName='Helvetica-Bold', fontSize=13, textColor=RED, alignment=TA_CENTER),
            'total_ars': ParagraphStyle('ta', fontName='Helvetica-Bold', fontSize=12, textColor=RED),
            'note': ParagraphStyle('note', fontName='Helvetica', fontSize=8, leading=12, textColor=RED),
            'small': ParagraphStyle('sm', fontName='Helvetica', fontSize=8, leading=10, textColor=DARK),
            'pill': ParagraphStyle('pill', fontName='Helvetica-Bold', fontSize=8, textColor=colors.HexColor('#2c3e50')),
        }

    @staticmethod
    def _divider():
        return HRFlowable(width="100%", thickness=0.5, color=LIGHT_GRAY, spaceBefore=6, spaceAfter=6)

    @staticmethod
    def _card(title, rows, st):
        """Card with label/value alignment"""
        card_elements = []
        card_elements.append(Paragraph(title, st['card_title']))
        card_elements.append(HRFlowable(width="100%", thickness=1.5, color=RED, spaceBefore=2, spaceAfter=6))
        card_data = []
        for label, value in rows:
            card_data.append([
                Paragraph(label, st['label']),
                Paragraph(str(value), st['value']),
            ])
        t = Table(card_data, colWidths=[55, 70])
        t.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ]))
        card_elements.append(t)
        return card_elements

    @staticmethod
    def _pill(text):
        """Styled payment badge pill"""
        p = Paragraph(text, PDFGenerator._styles()['pill'])
        t = Table([[p]], colWidths=[None])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), CARD_BG),
            ('BOX', (0, 0), (-1, -1), 1, MED_GRAY),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 14),
            ('RIGHTPADDING', (0, 0), (-1, -1), 14),
        ]))
        return t

    @staticmethod
    def generar_presupuesto(data: dict, logo_path: str = None) -> BytesIO:
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4,
                                topMargin=22*mm, bottomMargin=22*mm,
                                leftMargin=18*mm, rightMargin=18*mm)
        st = PDFGenerator._styles()
        E = []

        # ===== HEADER =====
        header = Table([
            [
                Paragraph("afamar<br/><font size='7' color='#64748b'>MÁRMOLES & GRANITOS</font>", st['serif']),
                Paragraph(f"PRESUPUESTO N°<br/><font size='16'>{data.get('numero', '')}</font>", st['red_title']),
                Paragraph("LA PLATA, BS. AS.<br/>info@afamar.com.ar<br/>Tel: (0221) 15-000-0000", st['s']),
            ]
        ], colWidths=[190, 160, 120])
        header.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ]))
        E.append(header)
        E.append(HRFlowable(width="100%", thickness=1, color=RED, spaceBefore=2, spaceAfter=10))

        # ===== CLIENTE =====
        E.append(Table([
            [
                Paragraph("<b>Cliente:</b> " + (data.get('cliente_nombre') or '-'), st['n']),
                Paragraph("<b>Teléfono:</b> " + (data.get('cliente_telefono') or '-'), st['n']),
            ],
            [
                Paragraph("<b>Domicilio:</b> " + (data.get('cliente_direccion') or '-'), st['n']),
                Paragraph("<b>Email:</b> " + (data.get('cliente_email') or '-'), st['n']),
            ],
        ], colWidths=[250, 220]))
        E.append(PDFGenerator._divider())

        # ===== CROQUIS =====
        croquis = data.get('croquis') or []
        if croquis and len(croquis) > 0:
            cb = Table([
                [Paragraph("CROQUIS / DISEÑO", st['card_title'])],
                [Paragraph("(Vista esquemática — cotas de referencia)", st['s'])],
            ], colWidths=[470])
            cb.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), CARD_BG),
                ('BOX', (0, 0), (-1, -1), 1, LIGHT_GRAY),
                ('TOPPADDING', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                ('LEFTPADDING', (0, 0), (-1, -1), 14),
            ]))
            E.append(cb)
            E.append(Spacer(1, 8))

        # ===== 3 CARDS (with gap) =====
        spec_rows = [
            ("Material", data.get('material', '-')),
            ("Color", data.get('color_tipo', '-')),
            ("Espesor", data.get('espesor', '-')),
            ("Acabado", data.get('acabado', '-')),
            ("Bacha", data.get('bacha', '-')),
            ("Anafe", data.get('anafe', 'No incluye')),
        ]

        detalles = data.get('detalles_fabricacion') or data.get('items') or []
        fab_rows = []
        for d in detalles:
            c = d.get('concepto', d.get('sector', ''))
            m = d.get('m2', 0)
            if c:
                fab_rows.append((c, f"{m:.4f} m²" if m else "-"))

        total = data.get('total', 0)
        subtotal = data.get('subtotal', 0) or data.get('subtotal_materiales', 0)
        traslado = data.get('traslado', 0)
        total_usd = data.get('total_usd', 0)
        eco_rows = [
            ("Subtotal", fmt_ars(subtotal)),
            ("Traslado", fmt_ars(traslado)),
            ("Ref. USD", fmt_usd(total_usd)),
        ]

        col1 = PDFGenerator._card("ESPECIFICACIONES", spec_rows, st)
        col2 = PDFGenerator._card("DET. FABRICACIÓN", fab_rows if fab_rows else [("-", "-")], st)
        col3 = PDFGenerator._card("RES. ECONÓMICO", eco_rows, st)
        col3.append(Spacer(1, 6))
        col3.append(Paragraph(f"<b>TOTAL:</b>  {fmt_ars(total)}", st['total_ars']))

        # Equalize heights
        max_h = max(len(col1), len(col2), len(col3))
        while len(col1) < max_h: col1.append(Spacer(1, 12))
        while len(col2) < max_h: col2.append(Spacer(1, 12))
        while len(col3) < max_h: col3.append(Spacer(1, 12))

        # Wrap each card with padding
        def wrap_card(content):
            t = Table([[content]], colWidths=[146])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), WHITE),
                ('BOX', (0, 0), (-1, -1), 1, LIGHT_GRAY),
                ('TOPPADDING', (0, 0), (-1, -1), 14),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 14),
                ('LEFTPADDING', (0, 0), (-1, -1), 14),
                ('RIGHTPADDING', (0, 0), (-1, -1), 14),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ]))
            return t

        w1, w2, w3 = wrap_card(col1), wrap_card(col2), wrap_card(col3)

        # Gap between cards = 14pt via empty spacer column
        gap = 14
        grid = Table([[w1, '', w2, '', w3]], colWidths=[146, gap, 146, gap, 146])
        grid.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ]))
        E.append(grid)

        # ===== OBSERVACIONES =====
        E.append(Spacer(1, 28))
        notas = [
            "✓ No se realizan instalaciones.",
            "✓ No se realizan entregas con lluvia.",
            "✓ La descarga se realiza al pie del camión.",
            "✓ Debe haber personas para descargar.",
        ]
        obs = [[Paragraph("OBSERVACIONES IMPORTANTES", st['card_title'])]]
        for n in notas:
            obs.append([Paragraph(n, st['note'])])
        ot = Table(obs, colWidths=[470])
        ot.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), RED_BG),
            ('BOX', (0, 0), (-1, -1), 1, RED_BORDER),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 16),
        ]))
        E.append(ot)

        # ===== PAGO PILLS + VALIDEZ =====
        E.append(Spacer(1, 24))
        pills = Table([[
            PDFGenerator._pill("EFECTIVO"),
            PDFGenerator._pill("TRANSFERENCIA"),
            PDFGenerator._pill("TARJETA"),
        ]], colWidths=[None, None, None])
        pills.setStyle(TableStyle([
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (1, 0), (1, 0), 8),
            ('RIGHTPADDING', (2, 0), (2, 0), 8),
        ]))
        E.append(pills)

        E.append(Spacer(1, 10))
        E.append(Table([
            [
                Paragraph(
                    f"<b>Validez:</b> {data.get('validez', '7 días')}  &nbsp;|&nbsp;  "
                    f"<b>Entrega estimada:</b> {data.get('entrega_aproximada', '7 a 10 días hábiles')}",
                    st['n']
                ),
            ],
        ], colWidths=[470]))

        # ===== FIRMAS =====
        E.append(Spacer(1, 30))
        sig = Table([
            [Paragraph("_" * 48, st['n']), Paragraph("_" * 48, st['n'])],
            [Paragraph("<b>AFAMAR</b><br/>Responsable", ParagraphStyle('sf', parent=st['small'], alignment=TA_CENTER)),
             Paragraph("<b>CLIENTE CONFORME</b><br/>Firma y aclaración", ParagraphStyle('sc', parent=st['small'], alignment=TA_CENTER))],
        ], colWidths=[235, 235])
        sig.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
        ]))
        E.append(sig)

        doc.build(E)
        buffer.seek(0)
        return buffer

    @staticmethod
    def generar_orden(orden_data: dict, logo_path: str = None) -> BytesIO:
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4,
                                topMargin=22*mm, bottomMargin=22*mm,
                                leftMargin=18*mm, rightMargin=18*mm)
        st = PDFGenerator._styles()
        E = []

        # HEADER
        header = Table([
            [
                Paragraph("afamar<br/><font size='7' color='#64748b'>MÁRMOLES & GRANITOS</font>", st['serif']),
                Paragraph(f"ORDEN N°<br/><font size='16'>{orden_data.get('numero', '')}</font>", st['red_title']),
                Paragraph("LA PLATA, BS. AS.<br/>info@afamar.com.ar<br/>Tel: (0221) 15-000-0000", st['s']),
            ]
        ], colWidths=[190, 160, 120])
        header.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BOTTOMPADDING', (0, 0), (-1, -1), 10)]))
        E.append(header)
        E.append(HRFlowable(width="100%", thickness=1, color=RED, spaceBefore=2, spaceAfter=4))

        E.append(Paragraph(
            f"<b>Estado:</b> {orden_data.get('estado', '')} &nbsp;|&nbsp; "
            f"<b>Fecha:</b> {datetime.now().strftime('%d/%m/%Y')}", st['b']))
        E.append(Spacer(1, 6))

        # CLIENTE
        E.append(Table([
            [
                Paragraph("<b>Cliente:</b> " + (orden_data.get('cliente_nombre') or '-'), st['n']),
                Paragraph("<b>Teléfono:</b> " + (orden_data.get('cliente_telefono') or '-'), st['n']),
            ],
            [
                Paragraph("<b>Domicilio:</b> " + (orden_data.get('domicilio') or '-'), st['n']),
                Paragraph("<b>Email:</b> " + (orden_data.get('email') or '-'), st['n']),
            ],
        ], colWidths=[250, 220]))
        E.append(PDFGenerator._divider())

        # 3 CARDS
        spec_rows = [
            ("Material", orden_data.get('material', '-')),
            ("Color", orden_data.get('color_tipo', '-')),
            ("Espesor", orden_data.get('espesor', '-')),
            ("Acabado", orden_data.get('acabado', '-')),
            ("Bacha", orden_data.get('bacha', '-')),
            ("Anafe", orden_data.get('anafe', 'No incluye')),
            ("Prioridad", orden_data.get('prioridad', 'Normal')),
        ]

        detalles = orden_data.get('detalles_fabricacion') or []
        fab_rows = []
        for d in detalles:
            c = d.get('concepto', '')
            m = d.get('m2', 0)
            if c: fab_rows.append((c, f"{m:.4f} m²" if m else "-"))

        total = orden_data.get('total', 0)
        subtotal = orden_data.get('subtotal', 0)
        traslado = orden_data.get('traslado', 0)
        total_usd = orden_data.get('total_usd', 0)
        sena = orden_data.get('sena_recibida', 0)
        saldo = orden_data.get('saldo_pendiente', 0)

        eco_rows = [
            ("Subtotal", fmt_ars(subtotal)),
            ("Traslado", fmt_ars(traslado)),
            ("Seña", fmt_ars(sena)),
            ("Saldo pend.", fmt_ars(saldo)),
            ("Ref. USD", fmt_usd(total_usd)),
        ]

        col1 = PDFGenerator._card("ESPECIFICACIONES", spec_rows, st)
        col2 = PDFGenerator._card("DET. FABRICACIÓN", fab_rows if fab_rows else [("-", "-")], st)
        col3 = PDFGenerator._card("RES. ECONÓMICO", eco_rows, st)

        if orden_data.get('pileta_id'):
            col3.append(Paragraph(
                f"<b>Pileta:</b> {fmt_ars(orden_data.get('pileta_precio', 0))}"
                f" ({orden_data.get('pileta_moneda', 'ARS')})",
                st['label']
            ))

        col3.append(Spacer(1, 6))
        col3.append(Paragraph(f"<b>TOTAL:</b>  {fmt_ars(total)}", st['total_ars']))

        max_h = max(len(col1), len(col2), len(col3))
        while len(col1) < max_h: col1.append(Spacer(1, 12))
        while len(col2) < max_h: col2.append(Spacer(1, 12))
        while len(col3) < max_h: col3.append(Spacer(1, 12))

        def wrap_card(content):
            t = Table([[content]], colWidths=[146])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), WHITE),
                ('BOX', (0, 0), (-1, -1), 1, LIGHT_GRAY),
                ('TOPPADDING', (0, 0), (-1, -1), 14),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 14),
                ('LEFTPADDING', (0, 0), (-1, -1), 14),
                ('RIGHTPADDING', (0, 0), (-1, -1), 14),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ]))
            return t

        w1, w2, w3 = wrap_card(col1), wrap_card(col2), wrap_card(col3)
        gap = 14
        grid = Table([[w1, '', w2, '', w3]], colWidths=[146, gap, 146, gap, 146])
        grid.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ]))
        E.append(grid)

        # OBSERVACIONES
        E.append(Spacer(1, 28))
        obs = [[Paragraph("OBSERVACIONES IMPORTANTES", st['card_title'])]]
        for n in [
            "✓ No se realizan instalaciones.",
            "✓ No se realizan entregas con lluvia.",
            "✓ La descarga se realiza al pie del camión.",
            "✓ Debe haber personas para descargar.",
        ]:
            obs.append([Paragraph(n, st['note'])])
        ot = Table(obs, colWidths=[470])
        ot.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), RED_BG),
            ('BOX', (0, 0), (-1, -1), 1, RED_BORDER),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 16),
        ]))
        E.append(ot)

        # FIRMAS
        E.append(Spacer(1, 30))
        sig = Table([
            [Paragraph("_" * 48, st['n']), Paragraph("_" * 48, st['n'])],
            [Paragraph("<b>AFAMAR</b><br/>Responsable", ParagraphStyle('sf2', parent=st['small'], alignment=TA_CENTER)),
             Paragraph("<b>CLIENTE CONFORME</b><br/>Firma y aclaración", ParagraphStyle('sc2', parent=st['small'], alignment=TA_CENTER))],
        ], colWidths=[235, 235])
        sig.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER'), ('TOPPADDING', (0, 0), (-1, -1), 8)]))
        E.append(sig)

        doc.build(E)
        buffer.seek(0)
        return buffer
