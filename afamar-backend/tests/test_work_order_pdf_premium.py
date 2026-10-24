"""Regression tests for the presentation-only premium OT PDF layout."""
import json
from io import BytesIO

from pypdf import PdfReader

from app.services.pdf_html import (
    _env,
    build_budget_pdf_data,
    build_work_order_pdf_data,
    generate_work_order_pdf,
)


def _piece(name: str, pool_price: float = 0) -> dict:
    return {
        "id": name.lower().replace(" ", "-"),
        "name": name,
        "mainMaterial": {
            "name": "CALACATTA",
            "color": "Blanco",
            "currency": "USD",
            "price_m2": 0,
            "price_m2_usd": 1000,
            "length": 2,
            "width": 1,
            "quantity": 1,
            "is_alternative": False,
        },
        "mainMaterialRows": [],
        "alternativeMaterials": [],
        "fabrication_details": [{
            "concept": "BASEBOARD",
            "detail": "Zócalo",
            "material": "CALACATTA",
            "length": 2,
            "width": 0.1,
            "quantity": 1,
            "price": 50,
            "currency": "USD",
        }],
        "additional_works_data": json.dumps([{
            "name": "Traforo de Pileta",
            "detail": "Apertura",
            "price": 60000,
            "quantity": 1,
            "total": 60000,
            "currency": "ARS",
            "type": "flat",
        }]),
        "pools": ([{
            "brand": "JOHNSON",
            "model": "LUXOR",
            "price": pool_price,
            "currency": "ARS",
            "quantity": 1,
        }] if pool_price else []),
    }


def _company() -> dict:
    return {
        "company_name": "AFAMAR",
        "company_tagline": "MÁRMOLES & GRANITOS",
        "company_address": "Av. Principal 123",
        "company_phone": "+54 11 4000-0000",
        "company_email": "info@afamar.com",
        "company_logo": "",
        "pdf_footer": "AFAMAR",
    }


def _order_data(pieces: list[dict]) -> dict:
    return {
        "id": 1,
        "number": "A-000001",
        "date": "2026-10-24T10:00:00",
        "usd_rate": 1555,
        "subtotal": 3600275.20,
        "total": 3600275.20,
        "subtotal_usd": 2315.29,
        "total_usd": 2135.23,
        "transport": 0,
        "discount_percentage": 0,
        "discount_fixed_amount": 0,
        "deposit_received": 500000,
        "deposit_usd": 0,
        "deposit_currency": "ARS",
        "payment_method": "EFECTIVO",
        "installments": 1,
        "materials_data": "[]",
        "fabrication_details": "[]",
        "additional_works_data": "[]",
        "pools_data": "[]",
        "pieces_data": json.dumps(pieces),
        "include_measurement_comparison_in_pdf": False,
        "notes": "Observación extensa de prueba.",
        "important_observations": "No modificar las uniones.",
        "delivery_date": "2026-11-01",
    }


def test_work_order_builder_exposes_piece_cards_without_changing_financial_values():
    data = build_work_order_pdf_data(
        _order_data([_piece("Mesada 1", 280000), _piece("Mesada 2")]),
        {"name": "Cliente", "phone": "", "email": "", "address": ""},
        _company(),
        {"delivery_terms": "", "warranty_text": ""},
    )

    assert [piece["name"] for piece in data["work_order_pieces"]] == ["Mesada 1", "Mesada 2"]
    assert data["work_order_pieces"][0]["pools"][0]["model"] == "LUXOR"
    assert data["work_order_pieces"][0]["additional"][0]["name"] == "Traforo de Pileta"
    assert data["subtotal"] == 3600275.20
    assert data["total"] == 3600275.20
    assert data["total_usd"] == 2135.23
    assert data["usd_rate"] == 1555
    assert data["balance_due"] == 3100275.20


def test_work_order_premium_template_renders_real_xhtml2pdf_with_piece_cards():
    data = build_work_order_pdf_data(
        _order_data([_piece("Mesada 1", 280000)]),
        {"name": "Cliente", "phone": "", "email": "", "address": ""},
        _company(),
        {"delivery_terms": "Condición", "warranty_text": "Garantía"},
    )
    pdf = generate_work_order_pdf(data).read()

    assert pdf.startswith(b"%PDF")
    assert pdf.rstrip().endswith(b"%%EOF")
    assert len(pdf) > 1000


def test_work_order_totals_and_payment_blocks_render_without_compression():
    order = _order_data([_piece("Mesada 1", 280000)])
    order.update({
        "total": 987654321.99,
        "total_usd": 635147.15,
        "deposit_received": 125000000.00,
        "balance_due": 862654321.99,
        "payment_method": "TARJETA DE CRÉDITO",
    })
    data = build_work_order_pdf_data(
        order,
        {"name": "Cliente", "phone": "", "email": "", "address": ""},
        _company(),
        {"delivery_terms": "Condición", "warranty_text": "Garantía"},
    )
    data["payment_methods_catalogue"] = ["EFECTIVO", "TRANSFERENCIA BANCARIA", "TARJETA DE CRÉDITO"]
    pdf = generate_work_order_pdf(data).read()
    text = "\n".join(page.extract_text() or "" for page in PdfReader(BytesIO(pdf)).pages)

    assert "TOTAL" in text
    assert "ARS" in text
    assert "987,654,321.99" in text
    assert "USD" in text
    assert "635,147.15" in text
    assert "Metodo de pago" in text
    assert "TARJETA DE CRÉDITO" in text
    assert "Saldo pendiente" in text


def test_work_order_long_piece_document_has_no_empty_pages():
    pieces = [_piece(f"Mesada {index}", 280000) for index in range(1, 13)]
    data = build_work_order_pdf_data(
        _order_data(pieces),
        {"name": "Cliente", "phone": "", "email": "", "address": ""},
        _company(),
        {"delivery_terms": "Condición", "warranty_text": "Garantía"},
    )
    pdf = generate_work_order_pdf(data).read()
    pages = PdfReader(BytesIO(pdf)).pages
    texts = [page.extract_text() or "" for page in pages]

    assert len(pages) > 1
    assert all(text.strip() for text in texts)
    assert any("Saldo pendiente" in text for text in texts)


def test_budget_template_does_not_receive_or_render_work_order_piece_layout():
    data = build_budget_pdf_data(
        {
            "number": "P-000001",
            "date": "2026-10-24T10:00:00",
            "usd_rate": 1555,
            "subtotal": 100000,
            "total": 100000,
            "total_usd": 64.31,
            "materials_data": "[]",
            "fabrication_details": "[]",
            "pools_data": "[]",
            "additional_works_data": "[]",
        },
        {"name": "Cliente", "phone": "", "email": "", "address": ""},
        _company(),
        {"budget_terms": "", "warranty_text": ""},
    )
    html = _env.get_template("document_pdf.html").render(
        **data,
        logo_base64="",
        croquis_images=[],
    )

    assert data.get("work_order_pieces") is None
    assert '<body class="">' in html
    assert "Piezas / Mesadas" not in html
