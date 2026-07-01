from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.core.exceptions import NotFoundError
from app.utils.responses import created, success
from app.schemas.options import AppOptionCreate
from app.services.option import AppOptionService

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("")
def list_options(category: str | None = None, db: Session = Depends(get_db)):
    service = AppOptionService(db)
    if category:
        return success(service.get_by_category(category))
    return success(service.get_all())


@router.post("", status_code=201)
def create_option(data: AppOptionCreate, db: Session = Depends(get_db)):
    service = AppOptionService(db)
    return created(service.create(data.model_dump()))


@router.delete("/{option_id}", status_code=204)
def delete_option(option_id: int, db: Session = Depends(get_db)):
    service = AppOptionService(db)
    if not service.delete(option_id):
        raise NotFoundError("Option")
