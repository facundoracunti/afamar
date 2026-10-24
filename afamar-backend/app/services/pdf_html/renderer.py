"""xhtml2pdf renderer for the legacy PDF documents.

``_render_pdf`` turns an HTML string into a PDF buffer; the two
``generate_*_pdf`` entry points wire the Jinja2 template, the company logo
and the croquis PNGs into it.
"""
from io import BytesIO
from typing import Optional

from app.services.pdf_html.assets import _load_logo_base64, _sketch_to_png_base64_list
from app.services.pdf_html.env import _env


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
