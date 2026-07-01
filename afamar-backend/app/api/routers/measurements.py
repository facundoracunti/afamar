from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.core.exceptions import NotFoundError
from app.utils.responses import created, success
from app.schemas.measurement import MeasurementCreate, MeasurementUpdate
from app.services.measurement import MeasurementService
from app.utils.pagination import paginate

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("")
def list_measurements(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    service = MeasurementService(db)
    query = service.repo.db.query(service.repo.model).order_by(service.repo.model.scheduled_date.desc(), service.repo.model.id.desc())
    page = paginate(db, query, skip, limit)
    return success(page.items, page.pagination)


@router.get("/{measurement_id}")
def get_measurement(measurement_id: int, db: Session = Depends(get_db)):
    service = MeasurementService(db)
    measurement = service.get_by_id(measurement_id)
    if not measurement:
        raise NotFoundError("Measurement")
    return success(measurement)


@router.post("", status_code=201)
def create_measurement(data: MeasurementCreate, db: Session = Depends(get_db)):
    service = MeasurementService(db)
    return created(service.create(data.model_dump()))


@router.put("/{measurement_id}")
def update_measurement(measurement_id: int, data: MeasurementUpdate, db: Session = Depends(get_db)):
    service = MeasurementService(db)
    measurement = service.update(measurement_id, data.model_dump(exclude_unset=True))
    if not measurement:
        raise NotFoundError("Measurement")
    return success(measurement)


@router.delete("/{measurement_id}", status_code=204)
def delete_measurement(measurement_id: int, db: Session = Depends(get_db)):
    service = MeasurementService(db)
    if not service.delete(measurement_id):
        raise NotFoundError("Measurement")
