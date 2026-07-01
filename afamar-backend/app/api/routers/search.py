from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.utils.responses import success
from app.services.budget import BudgetService
from app.services.client import ClientService
from app.services.work_order import WorkOrderService

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("")
def unified_search(q: str = Query(min_length=1), db: Session = Depends(get_db)):
    clients = ClientService(db).search(q)
    budgets = BudgetService(db).search(q)
    work_orders = WorkOrderService(db).search(q)
    return success({
        "clients": clients,
        "budgets": budgets,
        "work_orders": work_orders,
    })
