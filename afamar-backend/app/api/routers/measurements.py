from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import case, select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.core.exceptions import NotFoundError
from app.models.client import Client
from app.utils.responses import created, success
from app.schemas.measurement import MeasurementCreate, MeasurementResponse, MeasurementUpdate
from app.services.measurement import MeasurementService
from app.utils.pagination import paginate

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("")
def list_measurements(
    skip: int = 0,
    limit: int = 100,
    search: str | None = None,
    status: str | None = None,
    scheduled_date: date | None = None,
    db: Session = Depends(get_db),
):
    """
    List measurements with optional filters.

    - `search` matches `client.name` (case-insensitive substring).
    - `status` exact-matches the measurement status (`PENDING` / `DONE` / `CANCELLED`).
    - `scheduled_date` exact-matches the day portion of `scheduled_date` so the
      frontend can drive an "agenda" view by sending today's local date.
    """
    service = MeasurementService(db)
    Model = service.repo.model
    query = service.repo.db.query(Model)

    if status:
        query = query.filter(Model.status == status)
    if scheduled_date:
        # Match the calendar day in the server's local time. The frontend
        # sends local-date strings (e.g. "2026-07-08") which `date` parses
        # directly. We compare against `scheduled_date::date` so the time
        # portion of the stored datetime doesn't exclude rows scheduled
        # later in the same day.
        query = query.filter(
            Model.scheduled_date >= scheduled_date,
            Model.scheduled_date < date.fromordinal(scheduled_date.toordinal() + 1),
        )
    if search:
        # Match the search string against the joined client's name. We use
        # a subquery so the base query stays simple (no `outerjoin` that
        # would break the lazy-load pattern used by `from_orm_with_client`).
        # Measurements with `client_id IS NULL` won't match — that's
        # expected (no client to search by).
        pattern = f"%{search}%"
        client_ids_subquery = select(Client.id).where(Client.name.ilike(pattern))
        query = query.filter(Model.client_id.in_(client_ids_subquery))

    query = query.order_by(
        case((Model.scheduled_date.is_(None), 1), else_=0),
        Model.scheduled_date.desc(),
        Model.id.desc(),
    )
    page = paginate(db, query, skip, limit)
    serialized = [MeasurementResponse.from_orm_with_client(m) for m in page.items]
    return success([s.model_dump(mode="json") for s in serialized], page.pagination)


@router.get("/{measurement_id}")
def get_measurement(measurement_id: int, db: Session = Depends(get_db)):
    service = MeasurementService(db)
    measurement = service.get_by_id(measurement_id)
    if not measurement:
        raise NotFoundError("Measurement")
    return success(MeasurementResponse.from_orm_with_client(measurement).model_dump(mode="json"))


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
