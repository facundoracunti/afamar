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
from app.models.online_budget import OnlineBudget
from app.models.setting import Setting
from app.schemas.budget import BudgetCreate, BudgetResponse, BudgetUpdate
from app.services.budget import BudgetService
from app.services.email import send_budget_email
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
        pdf_data = build_budget_pdf_data(budget_data, client_dict, company, terms)
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
    db: Session = Depends(get_db),
):
    service = BudgetService(db)
    items = service.list_filtered(status, client_id, date_from, date_to, skip, limit)
    total = service.repo.list_filtered_count(status, client_id, date_from, date_to)
    return success(items, PaginationInfo(total=total, skip=skip, limit=limit))


@router.get("/search")
def search_budgets(q: str = Query(min_length=1), db: Session = Depends(get_db)):
    service = BudgetService(db)
    return success(service.search(q))


@router.get("/unified")
def list_unified_budgets(
    q: str | None = Query(None),
    status: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    from app.models.client import Client
    from app.services.budget import BudgetService

    service = BudgetService(db)
    locales = service.repo.db.query(service.repo.model)
    onlines = db.query(OnlineBudget).all()

    if status == "ALL":
        pass  # explicit "no filter": include CONVERTED_TO_OT too
    elif status:
        locales = locales.filter(service.repo.model.status == status)
        onlines = [o for o in onlines if (o.status or "ONLINE") == status]
    else:
        # Default landing page: hide converted work orders (they live in
        # /admin/work-orders). APPROVED is shown so the user can still click
        # "Convertir a OT" from the list.
        locales = locales.filter(service.repo.model.status != "CONVERTED_TO_OT")
        onlines = [o for o in onlines if (o.status or "ONLINE") != "CONVERTED_TO_OT"]

    if q:
        locales = locales.outerjoin(Client).filter(
            service.repo.model.number.ilike(f"%{q}%")
            | Client.name.ilike(f"%{q}%")
            | Client.phone.ilike(f"%{q}%")
            | service.repo.model.snapshot_name.ilike(f"%{q}%")
            | service.repo.model.material.ilike(f"%{q}%")
        )
        onlines = [
            o for o in onlines
            if q.lower() in (o.number or "").lower()
            or q.lower() in (o.client_name or "").lower()
        ]

    locales = locales.order_by(service.repo.model.id.desc()).all()
    locales = list({p.id: p for p in locales}.values())

    result = []
    for p in locales:
        c = p.client
        result.append({
            "id": p.id,
            "tipo": "local",
            "number": p.number,
            "date": str(p.date) if p.date else None,
            "client_name": p.snapshot_name or (c.name if c else None),
            "client_phone": p.snapshot_phone or (c.phone if c else None),
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
    for o in onlines:
        result.append({
            "id": o.id,
            "tipo": "online",
            "number": o.number,
            "date": str(o.date) if o.date else None,
            "client_name": o.client_name,
            "client_phone": None,
            "material": None,
            "total": o.total_net_ars or 0,
            "total_usd": o.total_net_usd or 0,
            "status": o.status or "ONLINE",
            "work_order_number": None,
            "created_at": str(o.created_at),
            "deposit_received": 0,
            "balance_due": 0,
            "design_observations": "",
        })
    result.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    total = len(result)
    page_items = result[skip:skip + limit]
    return success(page_items, pagination={"total": total, "skip": skip, "limit": limit})


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
    return success(BudgetResponse.model_validate(budget).model_dump())


@router.post("", status_code=201)
def create_budget(data: BudgetCreate, db: Session = Depends(get_db)):
    service = BudgetService(db)
    budget = service.create(data.model_dump())
    return created(BudgetResponse.model_validate(budget).model_dump())


@router.put("/{budget_id}")
def update_budget(budget_id: int, data: BudgetUpdate, db: Session = Depends(get_db)):
    service = BudgetService(db)
    budget = service.update(budget_id, data.model_dump(exclude_unset=True))
    if not budget:
        raise NotFoundError("Budget")
    return success(BudgetResponse.model_validate(budget).model_dump())


@router.delete("/{budget_id}", status_code=204)
def delete_budget(budget_id: int, db: Session = Depends(get_db)):
    service = BudgetService(db)
    if not service.delete(budget_id):
        raise NotFoundError("Budget")


def _load_settings(db: Session) -> dict:
    rows = db.query(Setting).all()
    return {row.key: row.value for row in rows}


_COMPANY_KEYS = ["company_name", "company_tagline", "company_address", "company_phone", "company_email", "company_logo", "pdf_footer"]
_TERMS_KEYS = ["budget_terms", "delivery_terms", "warranty_text", "observaciones_automaticas"]


def _split_or_default(value, default_global_terms) -> list[str]:
    """Return terms from `value` (per-budget override) if it has any,
    otherwise from `default_global_terms` (loaded via /admin/configuration).

    Accepts override values that may be: JSON list (already decoded), str (JSON or
    legacy plain text), None. Matches the helper in pdf_html.py but lives here
    so routers can decide whether a budget/work-order overrides config.
    """
    import json as _json
    if value is None or value == "":
        return default_global_terms or []
    if isinstance(value, list):
        return [str(t) for t in value if str(t).strip()]
    raw = str(value).strip()
    if not raw:
        return default_global_terms or []
    try:
        parsed = _json.loads(raw)
        if isinstance(parsed, list):
            return [str(t) for t in parsed if str(t).strip()]
    except (ValueError, TypeError):
        pass
    # Legacy plain-text: split on newlines
    return [t for t in (line.strip() for line in raw.splitlines()) if t]


def _build_company_and_terms(settings_data: dict, overrides: dict | None = None) -> tuple[dict, dict]:
    """Build the `company` and `terms` dicts for the PDF.

    `overrides` is an optional dict with per-budget keys (budget_terms_override,
    warranty_override) — when present and non-empty, they REPLACE the global
    values from settings_data at the same key.
    Empty JSON arrays (`"[]"`) from the frontend mean "no per-entity override",
    so the global config terms are kept.
    """
    company = {k: settings_data.get(k, "") for k in _COMPANY_KEYS}
    overrides = overrides or {}
    terms = {k: settings_data.get(k, "") for k in _TERMS_KEYS}
    if _has_terms(overrides.get("budget_terms_override")):
        terms["budget_terms"] = overrides["budget_terms_override"]
    if _has_terms(overrides.get("warranty_override")):
        terms["warranty_text"] = overrides["warranty_override"]
    return company, terms


def _has_terms(value) -> bool:
    """Return True if `value` is a non-empty terms override (not None, not `"[]"`)."""
    if not value:
        return False
    s = str(value).strip()
    return s not in ("", "[]")


def _prepare_budget_payload(budget, db: Session) -> tuple[dict, dict, dict, dict]:
    budget_data = BudgetResponse.model_validate(budget).model_dump(mode="json")
    client = budget.client
    client_dict = {
        "name": client.name,
        "phone": client.phone,
        "email": client.email,
        "address": client.address,
    }
    settings_data = _load_settings(db)
    # Per-budget overrides win over the global config terms.
    overrides = {
        "budget_terms_override": getattr(budget, "budget_terms_override", None),
        "warranty_override": getattr(budget, "warranty_override", None),
    }
    company, terms = _build_company_and_terms(settings_data, overrides)
    return budget_data, client_dict, company, terms


@router.post("/{budget_id}/alternatives/{idx}/convert-to-work-order", status_code=201)
def convert_alternative_to_work_order(budget_id: int, idx: int, db: Session = Depends(get_db)):
    service = BudgetService(db)
    try:
        work_order = service.convert_alternative_to_work_order(budget_id, idx)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return created(work_order)


@router.post("/preview-pdf")
def preview_budget_pdf(data: dict = Body(...), db: Session = Depends(get_db)):
    """Generate a budget PDF preview without saving."""
    import traceback
    from app.models.budget import Budget
    from app.utils.numbering import generate_budget_number

    try:
        last = db.query(Budget.number).order_by(Budget.id.desc()).first()
        budget_data = dict(data)
        budget_data["number"] = generate_budget_number(last[0] if last else None)

        budget_data["items"] = budget_data.get("items") or budget_data.get("materials_data") or []
        budget_data["adicionales"] = budget_data.get("adicionales") or budget_data.get("adicionales_data") or []

        client_name = data.get("client_name") or ""
        client_phone = data.get("client_phone") or ""
        client_email = data.get("client_email") or ""
        client_address = data.get("client_address") or ""
        if (not client_name or not client_phone) and data.get("client_id"):
            client = db.query(Client).filter(Client.id == int(data["client_id"])).first()
            if client:
                if not client_name: client_name = client.name
                if not client_phone: client_phone = client.phone or ""
                if not client_email: client_email = client.email or ""
                if not client_address: client_address = client.address or ""
        client_dict = {"name": client_name, "phone": client_phone, "email": client_email, "address": client_address}

        settings_data = _load_settings(db)
        overrides = {
            "budget_terms_override": data.get("budget_terms_override"),
            "warranty_override": data.get("warranty_override"),
        }
        company, terms = _build_company_and_terms(settings_data, overrides)

        pdf_data = build_budget_pdf_data(budget_data, client_dict, company, terms)
        pdf_bytes = generate_budget_pdf(pdf_data, logo_path=company.get("company_logo")).read()

        return Response(pdf_bytes, media_type="application/pdf")
    except Exception as exc:
        tb = traceback.format_exc()
        logger.error("preview_budget_pdf failed: %s\n%s", exc, tb)
        return Response(
            f"Error generando PDF: {type(exc).__name__}: {exc}",
            status_code=500,
            media_type="text/plain",
        )


@router.get("/{budget_id}/pdf")
def download_budget_pdf(budget_id: int, db: Session = Depends(get_db)):
    service = BudgetService(db)
    budget = service.get_by_id(budget_id)
    if not budget:
        raise NotFoundError("Budget")

    budget_data, client_dict, company, terms = _prepare_budget_payload(budget, db)
    pdf_data = build_budget_pdf_data(budget_data, client_dict, company, terms)
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
