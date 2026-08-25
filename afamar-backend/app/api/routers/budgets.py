import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.api.dependencies import get_current_user, get_db
from app.core.exceptions import NotFoundError
from app.utils.responses import PaginationInfo, created, success
from app.models.client import Client
from app.models.setting import Setting
from app.schemas.budget import BudgetCreate, BudgetResponse, BudgetUpdate
from app.services.budget import BudgetService
from app.services.email import send_budget_email
from app.services.pdf_helpers import COMPANY_KEYS, TERMS_KEYS, build_company_and_terms, has_terms, load_settings, split_or_default
from app.services.pdf_html import build_budget_pdf_data, generate_budget_pdf

logger = logging.getLogger(__name__)


def _email_budget_background(budget_id: int) -> None:
    db = SessionLocal()
    try:
        service = BudgetService(db)
        budget = service.get_by_id(budget_id)
        if not budget or not budget.client or not budget.client.email:
            logger.warning("Budget %s or client email not found for background email", budget_id)
            return
        budget_data, client_dict, company, terms = _prepare_budget_payload(budget, db)
        pdf_data = build_budget_pdf_data(budget_data, client_dict, company, terms, db=db)
        pdf_bytes = generate_budget_pdf(pdf_data, logo_path=company.get("company_logo")).read()
        company_name = company.get("company_name") or "AFAMAR"
        send_budget_email(budget.client.email, pdf_bytes, budget.number, company_name=company_name)
    except Exception:
        logger.exception("Background email failed for budget %s", budget_id)
    finally:
        db.close()

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("")
def list_budgets(
    skip: int = 0,
    limit: int = 100,
    status: str | None = None,
    client_id: int | None = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    search: str | None = None,
    db: Session = Depends(get_db),
):
    service = BudgetService(db)
    items = service.list_filtered(status, client_id, date_from, date_to, search, skip, limit)
    total = service.repo.list_filtered_count(status, client_id, date_from, date_to, search)
    return success(items, PaginationInfo(total=total, skip=skip, limit=limit))


@router.get("/search")
def search_budgets(q: str = Query(min_length=1), db: Session = Depends(get_db)):
    service = BudgetService(db)
    return success(service.search(q))


@router.get("/unified")
def list_unified_budgets(
    search: str | None = Query(None),
    status: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    from sqlalchemy import select
    from app.models.client import Client
    from app.models.budget import Budget
    from app.repositories.budget import _eager_query
    from app.services.budget import BudgetService

    service = BudgetService(db)
    query = _eager_query(service.repo.db)

    if status == "ALL":
        pass  # explicit "no filter": include CONVERTED_TO_OT too
    elif status:
        query = query.filter(Budget.status == status)
    else:
        # Default landing page: hide converted work orders (they live in
        # /admin/work-orders). APPROVED is shown so the user can still click
        # "Convertir a OT" from the list.
        query = query.filter(Budget.status != "CONVERTED_TO_OT")

    if search:
        pattern = f"%{search}%"
        client_id_subquery = (
            select(Client.id).where(
                Client.name.ilike(pattern) | Client.phone.ilike(pattern)
            )
        )
        query = query.filter(
            Budget.number.ilike(pattern)
            | Budget.client_id.in_(client_id_subquery)
            | Budget.material.ilike(pattern)
        )

    total = query.count()
    items = query.order_by(Budget.id.desc()).offset(skip).limit(limit).all()

    result = []
    for p in items:
        c = p.client
        result.append({
            "id": p.id,
            "tipo": "local",
            "number": p.number,
            "date": str(p.date) if p.date else None,
            "client_name": c.name if c else None,
            "client_phone": c.phone if c else None,
            "material": p.material,
            "total": p.total or 0,
            "total_usd": p.total_usd or 0,
            "status": p.status,
            "work_order_number": p.work_order.number if p.work_order else None,
            "created_at": str(p.created_at),
            "deposit_received": p.deposit_received or 0,
            "balance_due": p.balance_due or 0,
            "design_observations": p.design_observations or "",
        })
    return success(result, pagination={"total": total, "skip": skip, "limit": limit})


@router.get("/next-number")
def next_budget_number(db: Session = Depends(get_db)):
    from app.services.budget import BudgetService
    service = BudgetService(db)
    last = service.repo.get_last_number()
    from app.utils.numbering import generate_budget_number
    return success({"number": generate_budget_number(last)})


@router.get("/{budget_id}")
def get_budget(budget_id: int, db: Session = Depends(get_db)):
    service = BudgetService(db)
    budget = service.get_by_id(budget_id)
    if not budget:
        raise NotFoundError("Budget")
    return success(BudgetResponse.from_orm_with_client(budget).model_dump())


@router.post("", status_code=201)
def create_budget(data: BudgetCreate, db: Session = Depends(get_db)):
    service = BudgetService(db)
    budget = service.create(data.model_dump())
    return created(BudgetResponse.from_orm_with_client(budget).model_dump())


@router.put("/{budget_id}")
def update_budget(budget_id: int, data: BudgetUpdate, db: Session = Depends(get_db)):
    service = BudgetService(db)
    budget = service.update(budget_id, data.model_dump(exclude_unset=True))
    if not budget:
        raise NotFoundError("Budget")
    return success(BudgetResponse.from_orm_with_client(budget).model_dump())


@router.delete("/{budget_id}", status_code=204)
def delete_budget(budget_id: int, db: Session = Depends(get_db)):
    service = BudgetService(db)
    if not service.delete(budget_id):
        raise NotFoundError("Budget")


def _prepare_budget_payload(budget, db: Session) -> tuple[dict, dict, dict, dict]:
    budget_data = BudgetResponse.from_orm_with_client(budget).model_dump(mode="json")
    client = budget.client
    client_dict = {
        "name": client.name,
        "phone": client.phone,
        "email": client.email,
        "address": client.address,
    }
    settings_data = load_settings(db)
    overrides = {
        "budget_terms_override": getattr(budget, "budget_terms_override", None),
        "warranty_override": getattr(budget, "warranty_override", None),
    }
    company, terms = build_company_and_terms(settings_data, "budget_terms_override", overrides)
    return budget_data, client_dict, company, terms


@router.post("/{budget_id}/alternatives/{idx}/convert-to-work-order", status_code=201)
def convert_alternative_to_work_order(budget_id: int, idx: int, db: Session = Depends(get_db)):
    service = BudgetService(db)
    work_order = service.convert_alternative_to_work_order(budget_id, idx)
    return created(work_order)


@router.get("/{budget_id}/pdf")
def download_budget_pdf(budget_id: int, db: Session = Depends(get_db)):
    service = BudgetService(db)
    budget = service.get_by_id(budget_id)
    if not budget:
        raise NotFoundError("Budget")

    budget_data, client_dict, company, terms = _prepare_budget_payload(budget, db)
    pdf_data = build_budget_pdf_data(budget_data, client_dict, company, terms, db=db)
    pdf_bytes = generate_budget_pdf(pdf_data, logo_path=company.get("company_logo")).read()

    return Response(
        pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="presupuesto_{budget.number}.pdf"'},
    )


@router.post("/{budget_id}/send-email")
def email_budget(budget_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    service = BudgetService(db)
    budget = service.get_by_id(budget_id)
    if not budget:
        raise NotFoundError("Budget")

    client = budget.client
    if not client.email:
        raise HTTPException(status_code=400, detail="El cliente no tiene email registrado")

    background_tasks.add_task(_email_budget_background, budget_id)
    return success({"message": "Enviando email en segundo plano"})

