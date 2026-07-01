from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.utils.responses import success
from app.services.report import ReportService

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    service = ReportService(db)
    return success(service.dashboard_stats())


@router.get("/budgets-by-status")
def budgets_by_status(
    status: str,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
):
    service = ReportService(db)
    return success(service.budgets_by_status(status, date_from, date_to))


@router.get("/work-orders-by-status")
def work_orders_by_status(
    status: str,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
):
    service = ReportService(db)
    return success(service.work_orders_by_status(status, date_from, date_to))


@router.get("/monthly-sales")
def monthly_sales(
    year: int = Query(default=None),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
):
    year = year or datetime.now().year
    service = ReportService(db)
    return success(service.monthly_sales(year, date_from, date_to))


@router.get("/most-used-materials")
def most_used_materials(limit: int = 10, db: Session = Depends(get_db)):
    service = ReportService(db)
    return success(service.most_used_materials(limit))
