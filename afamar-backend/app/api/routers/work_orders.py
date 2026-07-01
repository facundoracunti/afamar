import json
import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.api.dependencies import get_current_user, get_db
from app.core.exceptions import NotFoundError
from app.utils.responses import created, error, success
from app.models.setting import Setting
from app.schemas.work_order import WorkOrderCreate, WorkOrderResponse, WorkOrderUpdate
from app.services.budget import BudgetService
from app.services.email import send_work_order_email
from app.services.pdf_html import build_work_order_pdf_data, generate_work_order_pdf
from app.services.work_order import WorkOrderService
from app.utils.pagination import paginate

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


_COMPANY_KEYS = ["company_name", "company_address", "company_phone", "company_email", "pdf_footer"]
_TERMS_KEYS = ["budget_terms", "delivery_terms", "warranty_text"]


def _build_company_and_terms(settings_data: dict) -> tuple[dict, dict]:
    company = {k: settings_data.get(k, "") for k in _COMPANY_KEYS}
    terms = {k: settings_data.get(k, "") for k in _TERMS_KEYS}
    return company, terms


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
