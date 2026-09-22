"""Tests for the public signed-PDF-token flow.

Context (2026-09-*): the WhatsApp share message links to the budget / work
order PDF, but previously the link hit the AUTHENTICATED `/work-orders/{id}/pdf`
endpoint — a client without an admin login got 401 on the "Ver PDF" link.

The fix: a signed, no-auth `GET /api/v1/public/{budgets,work-orders}/pdf?token=…`
endpoint. Tokens are minted server-side (`…/{id}/public-token`, HMAC-SHA256 +
expiry) so the signing secret never leaves the backend.

What we cover:
1. `public_pdf_tokens`: roundtrip, expiry, tamper detection, wrong doc type.
2. Mint endpoint returns a token + expiry metadata.
3. Public PDF endpoint: valid token → PDF; expired → 410 with the friendly
   client message; tampered/malformed → 400; cross doc-type token → 400.
"""
from datetime import datetime, timedelta, timezone
from io import BytesIO

import pytest

from app.models.client import Client
from app.models.reference import PaymentMethod
from app.models.setting import Setting
from app.models.work_order import WorkOrder
from app.api.routers import public as public_router
from app.services.public_pdf_tokens import (
    PublicTokenExpiredError,
    PublicTokenInvalidError,
    create_public_pdf_token,
    decode_public_pdf_token,
)

from tests.conftest import TestingSessionLocal

FRIENDLY_EXPIRED = "El enlace ha expirado. Solicite un nuevo presupuesto/orden a AFAMAR."
FRIENDLY_INVALID = "El enlace es inválido. Solicite un nuevo presupuesto/orden a AFAMAR."


@pytest.fixture
def seeded_wo():
    """Session with one Client + one WorkOrder (MEDICION)."""
    db = TestingSessionLocal()
    try:
        db.add(PaymentMethod(
            id=1, name="EFECTIVO", label="Efectivo",
            is_active=True, sort_order=10,
            type="NONE", value=0.0, is_percentage=False, applies_to_installments=False,
        ))
        db.add(Client(
            id=1, name="Test Client", phone="+54 11 0000-0000",
            address="Calle Test 123", email="test@test.com",
        ))
        order = WorkOrder(
            id=1,
            number="A-000001",
            client_id=1,
            status="MEASUREMENT",
            origin="Budget",
            currency="ARS",
            usd_rate=1000.0,
            subtotal=0.0, total=0.0,
            subtotal_usd=0.0, total_usd=0.0,
            balance_due=0.0, balance_due_usd=0.0,
            material="Test Material",
            material_price_m2=1000.0,
            materials_data=None,
            fabrication_details=None,
            pools_data=None,
            additional_works_data=None,
            payment_method="EFECTIVO",
            installments=1,
        )
        db.add(order)
        db.commit()
        yield db
    finally:
        db.close()


def _patch_pdf_generation(monkeypatch):
    marker = b"%PDF-1.4 mock"
    monkeypatch.setattr(public_router, "generate_work_order_pdf", lambda *a, **k: BytesIO(marker))
    monkeypatch.setattr(public_router, "generate_budget_pdf", lambda *a, **k: BytesIO(marker))
    return marker


@pytest.fixture
def seeded_wo_rich():
    """A *realistically populated* WorkOrder (card 3 cuotas, depósito USD,
    materiales, zócalo, frente, pileta, croquis y comparativa activa) that
    exercises the full xhtml2pdf render path through the public endpoint."""
    import json as _json

    db = TestingSessionLocal()
    try:
        db.add(PaymentMethod(
            id=1, name="EFECTIVO", label="Efectivo",
            is_active=True, sort_order=10,
            type="NONE", value=0.0, is_percentage=False, applies_to_installments=False,
        ))
        db.add(PaymentMethod(
            id=2, name="TARJETA DE CRÉDITO", label="Tarjeta de crédito",
            is_active=True, sort_order=30,
            type="SURCHARGE", value=9.0, is_percentage=True, applies_to_installments=True,
        ))
        db.add(Client(
            id=1, name="Juan Pérez", phone="+54 9 11 5555-1234",
            address="Av. Siempre Viva 742, CABA", email="juan@example.com",
        ))
        for key, value in {
            "company_name": "AFAMAR",
            "company_tagline": "MÁRMOLES & GRANITOS",
            "company_address": "Av. Principal 1234, Buenos Aires",
            "company_phone": "+54 11 4000-0000",
            "pdf_footer": "AFAMAR - MÁRMOLES & GRANITOS",
        }.items():
            db.add(Setting(key=key, value=value))

        usd_rate = 1535.0
        subtotal = 1150000.0
        transport = 50000.0
        base = subtotal + transport
        total = base * 1.27  # 3 cuotas × 9% = 27% de recargo
        deposit_usd = 200.0
        deposit_ars_equivalent = round(deposit_usd * usd_rate, 2)
        saldo = max(0.0, round(total - deposit_ars_equivalent, 2))

        order = WorkOrder(
            id=1,
            number="A-000001",
            client_id=1,
            status="MEASUREMENT",
            origin="Budget",
            currency="ARS",
            usd_rate=usd_rate,
            subtotal=subtotal, transport=transport, total=total,
            subtotal_usd=round(subtotal / usd_rate, 2), total_usd=round(total / usd_rate, 2),
            deposit_received=0.0, deposit_currency="USD", deposit_usd=deposit_usd,
            balance_due=saldo, balance_due_usd=round(saldo / usd_rate, 2),
            payment_method="TARJETA DE CRÉDITO", payment_method_id=2, installments=3,
            material="NEGRO BRASIL", material_price_m2=150000.0,
            materials_data=_json.dumps([
                {
                    "name": "NEGRO BRASIL", "price_m2": 150000.0, "price_m2_usd": 0.0,
                    "currency": "ARS", "color": "Negro", "thickness": "2cm", "finish": "Pulido",
                    "is_alternative": False, "length": 2.1, "width": 0.6, "quantity": 2,
                    "m2_budgeted": 2.52,
                },
                {
                    "name": "GRIS MARA", "price_m2": 0.0, "price_m2_usd": 220.0,
                    "currency": "USD", "color": "Gris", "is_alternative": True,
                    "length": 1.5, "width": 0.5, "quantity": 1, "m2_budgeted": 0.8,
                },
            ]),
            pools_data=_json.dumps([
                {
                    "marca": "JOHNSON", "modelo": "SIGNATURE AXIS 55 B",
                    "price": 936000.0, "price_usd": 0.0, "currency": "ARS", "quantity": 1,
                },
            ]),
            fabrication_details=_json.dumps([
                {
                    "concept": "ZOCALOS", "custom_concept": "", "detail": "Zócalo 80",
                    "material": "NEGRO BRASIL", "length": 0.34, "width": 0.1, "quantity": 2,
                    "price": 150000.0, "currency": "ARS",
                    "m2_budgeted": 0.068,
                    "total_ars_budgeted": round(0.068 * 2 * 150000.0, 2),
                },
            ]),
            additional_works_data=_json.dumps([
                {
                    "additional_work_id": 1, "name": "Traforo de Pileta", "type": "flat",
                    "price": 60000.0, "quantity": 1, "total": 60000.0,
                    "currency": "ARS", "materialName": "__GLOBAL__",
                },
                {
                    "additional_work_id": 2, "name": "Frente Ingletetado 45°", "type": "frente",
                    "price": 0.0, "quantity": 1, "total": 402521.15, "currency": "ARS",
                    "materialName": "NEGRO BRASIL",
                    "linear_meters": 3.3, "linear_meters_budgeted": 3.3,
                    "total_ars_budgeted": 402521.15, "total_usd_budgeted": 262.23,
                },
            ]),
            sketch_elements=_json.dumps([
                {
                    "pagina_id": 1, "name": "Mesada 1", "material": "NEGRO BRASIL",
                    "dibujo": [
                        {"type": "rect", "order": 0, "data": _json.dumps(
                            {"x": 40, "y": 40, "w": 300, "h": 180,
                             "color": "#1e40af", "fill": "none", "lineWidth": 2})},
                        {"type": "measure", "order": 1, "data": _json.dumps(
                            {"x1": 40, "y1": 40, "x2": 340, "y2": 40,
                             "label": "2,10 m", "color": "#2563eb"})},
                        {"type": "text", "order": 2, "data": _json.dumps(
                            {"x": 60, "y": 240, "text": "M1", "color": "#1e40af"})},
                    ],
                },
            ]),
            include_measurement_comparison_in_pdf=True,
            notes="Observación de prueba para el cliente.",
            important_observations="No pintar las uniones.",
            delivery_terms_override='["Entrega a coordinar.", "Instalación NO incluida."]',
            warranty_override="Garantía de 5 años.",
            date=datetime(2026, 9, 21, 10, 0, 0),
            delivery_date=datetime(2026, 10, 2).date(),
        )
        db.add(order)
        db.commit()
        yield db
    finally:
        db.close()


# ────────────────────────────────────────────────────────────────────
# Token service
# ────────────────────────────────────────────────────────────────────


def test_token_roundtrip():
    token = create_public_pdf_token("work_order", 42)
    assert decode_public_pdf_token(token)["typ"] == "work_order"
    assert decode_public_pdf_token(token)["id"] == 42


def test_token_expiry_detected():
    now = datetime.now(timezone.utc)
    expired = create_public_pdf_token("work_order", 1, now=now, ttl_days=-1)
    with pytest.raises(PublicTokenExpiredError):
        decode_public_pdf_token(expired, now=now)


def test_token_tampering_detected():
    token = create_public_pdf_token("work_order", 1)
    # Flip one char in the payload half — signature no longer matches.
    payload_b64, _ = token.split(".", 1)
    tampered = ("A" + payload_b64[1:]) + "." + token.split(".", 1)[1]
    with pytest.raises(PublicTokenInvalidError):
        decode_public_pdf_token(tampered)


def test_token_malformed_b64_rejected():
    with pytest.raises(PublicTokenInvalidError):
        decode_public_pdf_token("not.a-token")


# ────────────────────────────────────────────────────────────────────
# Mint endpoint (authenticated)
# ────────────────────────────────────────────────────────────────────


def test_mint_public_token(client, seeded_wo):
    resp = client.get("/api/v1/work-orders/1/public-token")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    data = body["data"]
    assert data["token"]
    assert data["expires_in_days"] == 30
    # Token decodes to the right doc + id.
    payload = decode_public_pdf_token(data["token"])
    assert payload["typ"] == "work_order"
    assert payload["id"] == 1


def test_mint_public_token_404_when_missing(client):
    resp = client.get("/api/v1/work-orders/9999/public-token")
    assert resp.status_code in (400, 404)


# ────────────────────────────────────────────────────────────────────
# Public PDF endpoint (no auth)
# ────────────────────────────────────────────────────────────────────


def test_public_pdf_valid_token(public_client, seeded_wo, monkeypatch):
    marker = _patch_pdf_generation(monkeypatch)
    token = create_public_pdf_token("work_order", 1)
    resp = public_client.get(f"/api/v1/public/work-orders/pdf?token={token}")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/pdf")
    assert resp.content == marker
    assert "A-000001" in resp.headers["content-disposition"]


def test_public_pdf_work_order_renders_real_pdf(public_client, seeded_wo_rich):
    """Integration: the full xhtml2pdf render path must not 500 on a
    realistically-populated work order (recargo 3 cuotas 27%, depósito USD,
    materiales + alternativa, zócalo, frente con snapshot ml, pileta, croquis
    y comparativa de medición activa). Regression sentinel for the HTTP 500
    observed in production on `GET /api/v1/public/work-orders/pdf?token=…`."""
    token = create_public_pdf_token("work_order", 1)
    resp = public_client.get(f"/api/v1/public/work-orders/pdf?token={token}")
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"].startswith("application/pdf")
    assert resp.content.startswith(b"%PDF")
    assert b"%%EOF" in resp.content
    assert "A-000001" in resp.headers["content-disposition"]


def test_public_pdf_minimal_work_order_does_not_500(public_client, seeded_wo):
    """Regression for the real prod crash: a work order with NO color /
    espesor / acabado loaded leaves the template's `info-grid` table with a
    `<tr>` that has zero `<td>` cells, and xhtml2pdf raises
    "PmlTable must have at least a row and column" → 500. Same class of bug
    for the client second row when address/email/delivery date are all empty.
    Both `<tr>`s are now skipped entirely when empty, so the render must
    succeed with a valid PDF."""
    token = create_public_pdf_token("work_order", 1)
    resp = public_client.get(f"/api/v1/public/work-orders/pdf?token={token}")
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"].startswith("application/pdf")
    assert resp.content.startswith(b"%PDF")
    assert b"%%EOF" in resp.content


def test_public_pdf_expired_token_410(public_client, seeded_wo, monkeypatch):
    _patch_pdf_generation(monkeypatch)
    now = datetime.now(timezone.utc)
    expired = create_public_pdf_token("work_order", 1, now=now, ttl_days=-1)
    resp = public_client.get(f"/api/v1/public/work-orders/pdf?token={expired}")
    assert resp.status_code == 410
    assert resp.json()["success"] is False
    assert FRIENDLY_EXPIRED in resp.json()["error"]


def test_public_pdf_tampered_token_400(public_client, seeded_wo, monkeypatch):
    _patch_pdf_generation(monkeypatch)
    token = create_public_pdf_token("work_order", 1)
    payload_b64, sig = token.split(".", 1)
    tampered = ("B" + payload_b64[1:]) + "." + sig
    resp = public_client.get(f"/api/v1/public/work-orders/pdf?token={tampered}")
    assert resp.status_code == 400
    assert FRIENDLY_INVALID in resp.json()["error"]


def test_public_pdf_wrong_doc_type_token_400(public_client, seeded_wo, monkeypatch):
    _patch_pdf_generation(monkeypatch)
    budget_token = create_public_pdf_token("budget", 1)
    resp = public_client.get(f"/api/v1/public/work-orders/pdf?token={budget_token}")
    assert resp.status_code == 400
    assert FRIENDLY_INVALID in resp.json()["error"]


def test_public_pdf_missing_token_422(public_client):
    resp = public_client.get("/api/v1/public/work-orders/pdf")
    assert resp.status_code == 422


def test_public_pdf_unknown_order_404(public_client, seeded_wo, monkeypatch):
    _patch_pdf_generation(monkeypatch)
    token = create_public_pdf_token("work_order", 9999)
    resp = public_client.get(f"/api/v1/public/work-orders/pdf?token={token}")
    assert resp.status_code == 404