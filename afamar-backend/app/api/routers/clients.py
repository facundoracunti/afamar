from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.core.exceptions import NotFoundError
from app.utils.responses import created, success
from app.schemas.client import ClientCreate, ClientUpdate
from app.services.client import ClientService
from app.utils.pagination import paginate

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("")
def list_clients(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    service = ClientService(db)
    query = service.repo.db.query(service.repo.model)
    page = paginate(db, query, skip, limit)
    return success(page.items, page.pagination)


@router.get("/search")
def search_clients(q: str, db: Session = Depends(get_db)):
    service = ClientService(db)
    return success(service.search(q))


@router.get("/{client_id}")
def get_client(client_id: int, db: Session = Depends(get_db)):
    service = ClientService(db)
    client = service.get_by_id(client_id)
    if not client:
        raise NotFoundError("Client")
    return success(client)


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
    if not service.delete(client_id):
        raise NotFoundError("Client")
