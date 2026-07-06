from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.core.exceptions import NotFoundError
from app.utils.responses import error, success
from app.services.budget import BudgetService
from app.services.whatsapp import build_budget_message, build_work_order_message, send_whatsapp
from app.services.work_order import WorkOrderService

router = APIRouter(dependencies=[Depends(get_current_user)])


class SendBudgetWhatsAppRequest(BaseModel):
    phone: str | None = None


class SendMessageRequest(BaseModel):
    phone: str
    message: str


@router.post("/send-budget/{budget_id}")
def send_budget_whatsapp(budget_id: int, data: SendBudgetWhatsAppRequest, db: Session = Depends(get_db)):
    service = BudgetService(db)
    budget = service.get_by_id(budget_id)
    if not budget:
        raise NotFoundError("Budget")

    phone = data.phone or (budget.client.phone if budget.client else "")
    if not phone:
        return error("No se pudo determinar el número de teléfono", 400)

    client_name = (budget.client.name if budget.client else "") or "cliente"
    msg = build_budget_message(budget.number, client_name, budget.total, budget.total_usd)
    result = send_whatsapp(phone, msg)
    return success(result)


@router.post("/send-work-order/{order_id}")
def send_work_order_whatsapp(order_id: int, data: SendBudgetWhatsAppRequest, db: Session = Depends(get_db)):
    service = WorkOrderService(db)
    order = service.get_by_id(order_id)
    if not order:
        raise NotFoundError("Work order")

    phone = data.phone or (order.client.phone if order.client else "")
    if not phone:
        return error("No se pudo determinar el número de teléfono", 400)

    client_name = (order.client.name if order.client else "") or "cliente"
    msg = build_work_order_message(order.number, client_name, order.status, order.total, order.total_usd)
    result = send_whatsapp(phone, msg)
    return success(result)


@router.post("/send-message")
def send_custom_message(data: SendMessageRequest):
    result = send_whatsapp(data.phone, data.message)
    return success(result)
