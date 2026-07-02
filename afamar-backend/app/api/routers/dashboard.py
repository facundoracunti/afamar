from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.dependencies import get_current_user, get_db
from app.schemas.dashboard import DashboardData
from app.services.dashboard_service import DashboardService
from app.models.user import User

router = APIRouter(prefix="/dashboard", dependencies=[Depends(get_current_user)])


@router.get("", response_model=DashboardData)
def get_dashboard(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    service = DashboardService(db)
    return service.get_data()