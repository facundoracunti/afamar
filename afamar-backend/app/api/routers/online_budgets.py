from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.core.exceptions import NotFoundError
from app.utils.responses import created, success
from app.schemas.online_budget import OnlineBudgetCreate, OnlineBudgetUpdate
from app.services.online_budget import OnlineBudgetService
from app.services.whatsapp import build_online_budget_message, send_whatsapp
from app.utils.pagination import paginate

router = APIRouter()


@router.get("", dependencies=[Depends(get_current_user)])
def list_online_budgets(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    service = OnlineBudgetService(db)
    query = service.repo.db.query(service.repo.model).order_by(service.repo.model.created_at.desc())
    page = paginate(db, query, skip, limit)
    return success(page.items, page.pagination)


@router.get("/{budget_id}", dependencies=[Depends(get_current_user)])
def get_online_budget(budget_id: int, db: Session = Depends(get_db)):
    service = OnlineBudgetService(db)
    budget = service.get_by_id(budget_id)
    if not budget:
        raise NotFoundError("Online budget")
    return success(budget)


@router.post("", status_code=201)
def create_online_budget(data: OnlineBudgetCreate, db: Session = Depends(get_db)):
    service = OnlineBudgetService(db)
    return created(service.create(data.model_dump()))


@router.put("/{budget_id}", dependencies=[Depends(get_current_user)])
def update_online_budget(budget_id: int, data: OnlineBudgetUpdate, db: Session = Depends(get_db)):
    service = OnlineBudgetService(db)
    budget = service.update(budget_id, data.model_dump(exclude_unset=True))
    if not budget:
        raise NotFoundError("Online budget")
    return success(budget)


class SendOnlineBudgetWhatsAppRequest(BaseModel):
    phone: str


@router.post("/{budget_id}/convert-to-work-order", status_code=201, dependencies=[Depends(get_current_user)])
def convert_online_budget_to_work_order(budget_id: int, db: Session = Depends(get_db)):
    service = OnlineBudgetService(db)
    try:
        work_order = service.convert_to_work_order(budget_id)
    except ValueError as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=str(e))
    return created(work_order)


@router.post("/{budget_id}/send-whatsapp", dependencies=[Depends(get_current_user)])
def send_online_budget_whatsapp(
    budget_id: int,
    data: SendOnlineBudgetWhatsAppRequest,
    db: Session = Depends(get_db),
):
    service = OnlineBudgetService(db)
    online_budget = service.get_by_id(budget_id)
    if not online_budget:
        raise NotFoundError("Online budget")

    client_name = online_budget.client_name or "cliente"
    msg = build_online_budget_message(
        online_budget.number,
        client_name,
        online_budget.total_net_ars,
        online_budget.total_net_usd,
    )
    result = send_whatsapp(data.phone, msg)
    return success(result)


@router.delete("/{budget_id}", status_code=204, dependencies=[Depends(get_current_user)])
def delete_online_budget(budget_id: int, db: Session = Depends(get_db)):
    service = OnlineBudgetService(db)
    if not service.delete(budget_id):
        raise NotFoundError("Online budget")
