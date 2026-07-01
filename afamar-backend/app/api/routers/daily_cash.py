from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.schemas.daily_cash import (
    CashMovementCreate,
    CashMovementResponse,
    CloseCashRequest,
    DailyCashResponse,
    UpdatePreviousBalance,
)
from app.services.daily_cash import DailyCashService

router = APIRouter(prefix="/cash", tags=["Daily Cash"], dependencies=[Depends(get_current_user)])


@router.get("/daily", response_model=DailyCashResponse)
def get_daily_cash(query_date: date, db: Session = Depends(get_db)):
    service = DailyCashService(db)
    cash = service.get_or_create(query_date)
    return cash


@router.post("/movements", response_model=CashMovementResponse)
def create_movement(data: CashMovementCreate, db: Session = Depends(get_db)):
    service = DailyCashService(db)
    return service.create_movement(data.model_dump())


@router.delete("/movements/{movement_id}")
def delete_movement(movement_id: int, db: Session = Depends(get_db)):
    service = DailyCashService(db)
    service.delete_movement(movement_id)
    return {"success": True}


@router.put("/previous-balance", response_model=DailyCashResponse)
def update_previous_balance(data: UpdatePreviousBalance, db: Session = Depends(get_db)):
    service = DailyCashService(db)
    return service.update_previous_balance(data.date, data.previous_balance)


@router.post("/daily/close", response_model=DailyCashResponse)
def close_daily_cash(data: CloseCashRequest, db: Session = Depends(get_db)):
    service = DailyCashService(db)
    return service.close_cash(data.date, data.notes)


@router.get("/history", response_model=list[DailyCashResponse])
def get_cash_history(db: Session = Depends(get_db)):
    service = DailyCashService(db)
    return service.get_closed()
