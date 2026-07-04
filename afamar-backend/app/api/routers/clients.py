from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.core.exceptions import ConflictError, NotFoundError
from app.utils.pagination import Page
from app.utils.responses import PaginationInfo, created, success
from app.schemas.client import ClientCreate, ClientUpdate
from app.services.client import ClientService

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("")
def list_clients(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    service = ClientService(db)
    total = service.repo.db.query(service.repo.model).count() or 0
    items = service.list_with_stats(skip, limit)
    page = Page(items=items, pagination=PaginationInfo(total=total, skip=skip, limit=limit))
    return success(page.items, page.pagination)


@router.get("/search")
def search_clients(q: str, db: Session = Depends(get_db)):
    service = ClientService(db)
    return success(service.search(q))


@router.get("/{client_id}")
def get_client(client_id: int, db: Session = Depends(get_db)):
    service = ClientService(db)
    data = service.get_with_history(client_id)
    if not data:
        raise NotFoundError("Client")
    return success(data)


@router.get("/{client_id}/history")
def get_client_history(client_id: int, db: Session = Depends(get_db)):
    service = ClientService(db)
    client = service.get_by_id(client_id)
    if not client:
        raise NotFoundError("Client")
    return success(service.get_history(client_id))


@router.post("", status_code=201)
def create_client(data: ClientCreate, db: Session = Depends(get_db)):
    service = ClientService(db)
    return created(service.create(data.model_dump()))


@router.put("/{client_id}")
def update_client(client_id: int, data: ClientUpdate, db: Session = Depends(get_db)):
    service = ClientService(db)
    client = service.update(client_id, data.model_dump(exclude_unset=True))
    if not client:
        raise NotFoundError("Client")
    return success(client)


@router.delete("/{client_id}", status_code=204)
def delete_client(client_id: int, db: Session = Depends(get_db)):
    service = ClientService(db)
    client = service.get_by_id(client_id)
    if not client:
        raise NotFoundError("Client")
    counts = service.count_dependent_records(client_id)
    if counts["budgets"] or counts["work_orders"]:
        parts = []
        if counts["budgets"]:
            n = counts["budgets"]
            parts.append(f"{n} presupuesto{'s' if n != 1 else ''} asociado{'s' if n != 1 else ''}")
        if counts["work_orders"]:
            n = counts["work_orders"]
            base = "orden de trabajo" if n == 1 else "ordenes de trabajo"
            parts.append(f"{n} {base} asociada{'s' if n != 1 else ''}")
        detail = (
            "No se puede eliminar el cliente porque tiene "
            + " y ".join(parts)
            + ". Eliminá o reasigná esos registros primero."
        )
        raise ConflictError(detail)
    service.delete(client_id)
