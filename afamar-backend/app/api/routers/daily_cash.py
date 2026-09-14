from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.schemas.daily_cash import (
    CashMovementCreate,
    CashMovementResponse,
    CloseCashRequest,
    CloseCashResponse,
    DailyCashResponse,
    OpenCashRequest,
    UpdatePreviousBalance,
)
from app.services.daily_cash import DailyCashService

router = APIRouter(prefix="/cash", tags=["Daily Cash"], dependencies=[Depends(get_current_user)])


@router.get("/current", response_model=DailyCashResponse)
def get_current_cash(db: Session = Depends(get_db)):
    service = DailyCashService(db)
    return service.get_current()


@router.post("/current/open", response_model=DailyCashResponse)
def open_current_cash(data: OpenCashRequest, db: Session = Depends(get_db)):
    service = DailyCashService(db)
    return service.open_cash(data.previous_balance)


@router.put("/current/previous-balance", response_model=DailyCashResponse)
def update_previous_balance(data: UpdatePreviousBalance, db: Session = Depends(get_db)):
    service = DailyCashService(db)
    return service.set_previous_balance(data.previous_balance)


@router.post("/current/close", response_model=CloseCashResponse)
def close_current_cash(data: CloseCashRequest, db: Session = Depends(get_db)):
    service = DailyCashService(db)
    return service.close_cash(data.notes)


@router.post("/movements", response_model=CashMovementResponse)
def create_movement(data: CashMovementCreate, db: Session = Depends(get_db)):
    service = DailyCashService(db)
    return service.create_movement(data.model_dump())


@router.delete("/movements/{movement_id}")
def delete_movement(movement_id: int, db: Session = Depends(get_db)):
    service = DailyCashService(db)
    service.delete_movement(movement_id)
    return {"success": True}


@router.get("/history")
def get_cash_history(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    from app.models.daily_cash import DailyCash
    from app.services.daily_cash import DailyCashService
    from app.utils.pagination import paginate
    from app.utils.responses import success

    service = DailyCashService(db)
    query = (
        db.query(DailyCash)
        .filter(DailyCash.is_closed == True)  # noqa: E712
        .order_by(DailyCash.number.desc())
    )
    page = paginate(db, query, skip, limit)
    payload = []
    for c in page.items:
        item = DailyCashResponse.model_validate(c).model_dump(mode="json")
        item["summary"] = service._build_summary(c)
        payload.append(item)
    return success(payload, page.pagination)
