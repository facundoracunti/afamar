from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.core.exceptions import NotFoundError
from app.schemas.client_address import (
    ClientAddressCreate,
    ClientAddressResponse,
    ClientAddressUpdate,
)
from app.services.client_address import ClientAddressService
from app.utils.responses import created, success


router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/clients/{client_id}/addresses", response_model=None)
def list_client_addresses(client_id: int, db: Session = Depends(get_db)):
    service = ClientAddressService(db)
    return success(
        [
            ClientAddressResponse.model_validate(a).model_dump(mode="json")
            for a in service.list_by_client(client_id)
        ]
    )


@router.post("/clients/{client_id}/addresses", status_code=201, response_model=None)
def create_client_address(client_id: int, data: ClientAddressCreate, db: Session = Depends(get_db)):
    service = ClientAddressService(db)
    address = service.create(client_id, data.model_dump())
    return created(ClientAddressResponse.model_validate(address).model_dump(mode="json"))


@router.put("/clients/{client_id}/addresses/{address_id}", response_model=None)
def update_client_address(
    client_id: int,
    address_id: int,
    data: ClientAddressUpdate,
    db: Session = Depends(get_db),
):
    service = ClientAddressService(db)
    address = service.update(address_id, data.model_dump(exclude_unset=True))
    if not address:
        raise NotFoundError("ClientAddress")
    return success(ClientAddressResponse.model_validate(address).model_dump(mode="json"))


@router.delete("/clients/{client_id}/addresses/{address_id}", status_code=204)
def delete_client_address(client_id: int, address_id: int, db: Session = Depends(get_db)):
    service = ClientAddressService(db)
    if not service.delete(address_id):
        raise NotFoundError("ClientAddress")
