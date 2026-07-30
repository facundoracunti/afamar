from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.api.dependencies import get_current_user, get_db
from app.core.exceptions import NotFoundError
from app.utils.pagination import paginate
from app.utils.responses import success, created
from app.schemas.additional_work import AdditionalWorkCreate, AdditionalWorkResponse, AdditionalWorkUpdate
from app.services.additional_work import AdditionalWorkService


router = APIRouter(
    prefix="/additional-works",
    tags=["Additional Works"],
    dependencies=[Depends(get_current_user)],
)


@router.get("")
def list_additional_works(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    from app.models.additional_work import AdditionalWork

    query = db.query(AdditionalWork).options(joinedload(AdditionalWork.currency_obj))
    page = paginate(db, query, skip, limit)
    payload = [AdditionalWorkResponse.model_validate(a).model_dump(mode="json") for a in page.items]
    return success(payload, page.pagination)


@router.get("/{additional_work_id}")
def get_additional_work(additional_work_id: int, db: Session = Depends(get_db)):
    service = AdditionalWorkService(db)
    additional_work = service.get_by_id(additional_work_id)
    if not additional_work:
        raise NotFoundError("AdditionalWork")
    return success(AdditionalWorkResponse.model_validate(additional_work).model_dump(mode="json"))


@router.post("", status_code=201)
def create_additional_work(data: AdditionalWorkCreate, db: Session = Depends(get_db)):
    service = AdditionalWorkService(db)
    additional_work = service.create(data.model_dump())
    return created(AdditionalWorkResponse.model_validate(additional_work).model_dump(mode="json"))


@router.put("/{additional_work_id}")
def update_additional_work(
    additional_work_id: int,
    data: AdditionalWorkUpdate,
    db: Session = Depends(get_db),
):
    service = AdditionalWorkService(db)
    additional_work = service.update(additional_work_id, data.model_dump(exclude_unset=True))
    if not additional_work:
        raise NotFoundError("AdditionalWork")
    return success(AdditionalWorkResponse.model_validate(additional_work).model_dump(mode="json"))


@router.delete("/{additional_work_id}", status_code=204)
def delete_additional_work(additional_work_id: int, db: Session = Depends(get_db)):
    service = AdditionalWorkService(db)
    if not service.delete(additional_work_id):
        raise NotFoundError("AdditionalWork")
