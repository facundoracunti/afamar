import json
import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.api.dependencies import get_current_user, get_db
from app.core.exceptions import NotFoundError
from app.models.client import Client
from app.models.setting import Setting
from app.schemas.work_order import WorkOrderCreate, WorkOrderResponse, WorkOrderUpdate
from app.services.budget import BudgetService
from app.services.email import send_work_order_email
from app.services.pdf_html import build_work_order_pdf_data, generate_work_order_pdf
from app.services.work_order import WorkOrderService
from app.utils.pagination import paginate
from app.utils.responses import created, error, success

logger = logging.getLogger(__name__)


def _email_work_order_background(order_id: int) -> None:
    db = SessionLocal()
    try:
        service = WorkOrderService(db)
        order = service.get_by_id(order_id)
        if not order or not order.client or not order.client.email:
            logger.warning("Order %s or client email not found for background email", order_id)
            return
        order_data, client_dict, company, terms = _prepare_work_order_payload(order, db)
        pdf_data = build_work_order_pdf_data(order_data, client_dict, company, terms)
        pdf_bytes = generate_work_order_pdf(pdf_data, logo_path=company.get("company_logo")).read()
        company_name = company.get("company_name") or "AFAMAR"
        send_work_order_email(order.client.email, pdf_bytes, order.number, company_name=company_name)
    except Exception:
        logger.exception("Background email failed for order %s", order_id)
    finally:
        db.close()

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("")
def list_work_orders(
    skip: int = 0,
    limit: int = 100,
    status: str | None = None,
    client_id: int | None = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
):
    service = WorkOrderService(db)
    query = service.repo.db.query(service.repo.model)
    if status:
        query = query.filter(service.repo.model.status == status)
    if client_id:
        query = query.filter(service.repo.model.client_id == client_id)
    if date_from:
        query = query.filter(service.repo.model.date >= date_from)
    if date_to:
        query = query.filter(service.repo.model.date <= date_to)
    query = query.order_by(service.repo.model.created_at.desc())
    page = paginate(db, query, skip, limit)
    return success(page.items, page.pagination)


@router.get("/next-number")
def next_work_order_number(db: Session = Depends(get_db)):
    from app.services.work_order import WorkOrderService
    service = WorkOrderService(db)
    last = service.repo.get_last_number()
    from app.utils.numbering import generate_work_order_number
    return success({"number": generate_work_order_number(last)})


@router.get("/search")
def search_work_orders(q: str = Query(min_length=1), db: Session = Depends(get_db)):
    service = WorkOrderService(db)
    return success(service.search(q))


@router.get("/{order_id}")
def get_work_order(order_id: int, db: Session = Depends(get_db)):
    service = WorkOrderService(db)
    order = service.get_by_id(order_id)
    if not order:
        raise NotFoundError("Work order")
    return success(order)


@router.post("", status_code=201)
def create_work_order(data: WorkOrderCreate, db: Session = Depends(get_db)):
    service = WorkOrderService(db)
    return created(service.create(data.model_dump()))


@router.post("/from-budget/{budget_id}", status_code=201)
def create_from_budget(budget_id: int, db: Session = Depends(get_db)):
    budget_svc = BudgetService(db)
    budget = budget_svc.get_by_id(budget_id)
    if not budget:
        raise NotFoundError("Budget")
    service = WorkOrderService(db)
    try:
        return created(service.create_from_budget(budget))
    except ValueError as e:
        return error(detail=str(e), status_code=400)


@router.put("/{order_id}")
def update_work_order(order_id: int, data: WorkOrderUpdate, db: Session = Depends(get_db)):
    service = WorkOrderService(db)
    order = service.update(order_id, data.model_dump(exclude_unset=True))
    if not order:
        raise NotFoundError("Work order")
    return success(order)


def _load_settings(db: Session) -> dict:
    rows = db.query(Setting).all()
    return {row.key: row.value for row in rows}


_COMPANY_KEYS = ["company_name", "company_address", "company_phone", "company_email", "company_logo", "pdf_footer"]
_TERMS_KEYS = ["budget_terms", "delivery_terms", "warranty_text"]


def _build_company_and_terms(settings_data: dict) -> tuple[dict, dict]:
    company = {k: settings_data.get(k, "") for k in _COMPANY_KEYS}
    terms = {k: settings_data.get(k, "") for k in _TERMS_KEYS}
    return company, terms


_FIELD_MAP: dict[str, str] = {
    "cliente_nombre": "client_name",
    "cliente_telefono_orden": "client_phone",
    "domicilio": "client_address",
    "email": "client_email",
    "fecha": "date",
    "estado": "status",
    "material": "material",
    "material_precio_m2": "material_price_m2",
    "tipo_cambio": "usd_rate",
    "color_tipo": "color",
    "espesor": "thickness",
    "acabado": "finish",
    "croquis": "sketch_elements",
    "observaciones_diseno": "design_observations",
    "detalles_fabricacion": "fabrication_details",
    "materiales": "materials_data",
    "pileta_id": "pool_id",
    "pileta_precio": "pool_price",
    "pileta_moneda": "pool_currency",
    "pileta_imagen": "pool_image",
    "piletas": "pools_data",
    "subtotal": "subtotal",
    "traslado": "transport",
    "total": "total",
    "sena_recibida": "deposit_received",
    "sena_moneda": "deposit_currency",
    "saldo_pendiente": "balance_due",
    "dolar_dia": "usd_rate",
    "subtotal_usd": "subtotal_usd",
    "traslado_usd": "transport_usd",
    "total_usd": "total_usd",
    "sena_usd": "deposit_usd",
    "saldo_pendiente_usd": "balance_due_usd",
    "forma_pago": "payment_method",
    "cuotas": "installments",
    "fecha_entrega": "delivery_date",
    "firma_cliente": "digital_signature",
    "fecha_aprobacion": "signed_at",
    "observaciones": "notes",
    "observaciones_importantes": "important_observations",
    "descuento_porcentaje": "discount_percentage",
    "descuento_monto_fijo": "discount_fixed_amount",
}


def _map_form_fields(data: dict) -> dict:
    """Map Spanish frontend field names → English backend names."""
    mapped = dict(data)
    for es, en in _FIELD_MAP.items():
        if es in data and en not in mapped:
            mapped[en] = data[es]
    return mapped


def _build_client_dict_from_form(db: Session, data: dict) -> dict:
    name = data.get("client_name") or data.get("cliente_nombre") or ""
    phone = data.get("client_phone") or data.get("cliente_telefono_orden") or ""
    email_val = data.get("client_email") or data.get("email") or ""
    address = data.get("client_address") or data.get("domicilio") or ""
    if (not name or not phone) and data.get("client_id"):
        client = db.query(Client).filter(Client.id == int(data["client_id"])).first()
        if client:
            if not name: name = client.name
            if not phone: phone = client.phone or ""
            if not email_val: email_val = client.email or ""
            if not address: address = client.address or ""
    return {"name": name, "phone": phone, "email": email_val, "address": address}


@router.post("/preview-pdf")
def preview_work_order_pdf(data: dict = Body(...), db: Session = Depends(get_db)):
    """Generate a work order PDF preview without saving to database."""
    import sys
    import traceback
    print("[preview-pdf] HIT", file=sys.stderr, flush=True)
    try:
        from app.services.work_order import WorkOrderService
        from app.utils.numbering import generate_work_order_number

        order_data = _map_form_fields(data)
        service = WorkOrderService(db)
        last = service.repo.get_last_number()
        order_data["number"] = generate_work_order_number(last)

        client_dict = _build_client_dict_from_form(db, data)

        settings_data = _load_settings(db)
        company, terms = _build_company_and_terms(settings_data)

        items = []
        materials_raw = order_data.get("materials_data") or data.get("materiales")
        if materials_raw:
            try:
                parsed = json.loads(materials_raw) if isinstance(materials_raw, str) else materials_raw
                items = parsed if isinstance(parsed, list) else parsed.get("items", []) if isinstance(parsed, dict) else []
            except (json.JSONDecodeError, TypeError):
                pass
        order_data["items"] = items

        pdf_data = build_work_order_pdf_data(order_data, client_dict, company, terms)
        pdf_bytes = generate_work_order_pdf(pdf_data, logo_path=company.get("company_logo")).read()

        return Response(
            pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": 'inline; filename="vista_previa_orden.pdf"'},
        )
    except Exception as exc:
        tb = traceback.format_exc()
        print(f"[preview-pdf] FAILED: {type(exc).__name__}: {exc}\n{tb}", file=sys.stderr, flush=True)
        logger.error("preview_work_order_pdf failed: %s\n%s", exc, tb)
        return Response(
            f"Error generando PDF: {type(exc).__name__}: {exc}",
            status_code=500,
            media_type="text/plain",
        )


def _prepare_work_order_payload(order, db: Session) -> tuple[dict, dict, dict, dict]:
    order_data = WorkOrderResponse.model_validate(order).model_dump(mode="json")
    items = []
    if order.materials_data:
        try:
            parsed = json.loads(order.materials_data) if isinstance(order.materials_data, str) else order.materials_data
            if isinstance(parsed, list):
                items = parsed
            elif isinstance(parsed, dict):
                items = parsed.get("items", [])
        except (json.JSONDecodeError, TypeError):
            pass
    order_data["items"] = items
    client = order.client
    client_dict = {
        "name": client.name,
        "phone": client.phone,
        "email": client.email,
        "address": client.address,
    }
    settings_data = _load_settings(db)
    company, terms = _build_company_and_terms(settings_data)
    return order_data, client_dict, company, terms


@router.get("/{order_id}/pdf")
def download_work_order_pdf(order_id: int, db: Session = Depends(get_db)):
    service = WorkOrderService(db)
    order = service.get_by_id(order_id)
    if not order:
        raise NotFoundError("Work order")

    order_data, client_dict, company, terms = _prepare_work_order_payload(order, db)
    pdf_data = build_work_order_pdf_data(order_data, client_dict, company, terms)
    pdf_bytes = generate_work_order_pdf(pdf_data, logo_path=company.get("company_logo")).read()

    return Response(
        pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="orden_de_trabajo_{order.number}.pdf"'},
    )


@router.post("/{order_id}/send-email")
def email_work_order(order_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    service = WorkOrderService(db)
    order = service.get_by_id(order_id)
    if not order:
        raise NotFoundError("Work order")

    client = order.client
    if not client.email:
        raise HTTPException(status_code=400, detail="El cliente no tiene email registrado")

    background_tasks.add_task(_email_work_order_background, order_id)
    return success({"message": "Enviando email en segundo plano"})


@router.delete("/{order_id}", status_code=204)
def delete_work_order(order_id: int, db: Session = Depends(get_db)):
    service = WorkOrderService(db)
    if not service.delete(order_id):
        raise NotFoundError("Work order")
