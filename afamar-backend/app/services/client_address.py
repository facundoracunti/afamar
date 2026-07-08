from typing import List, Optional

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError, ValidationError
from app.models.client import Client
from app.models.client_address import ClientAddress
from app.repositories.client_address import ClientAddressRepository


class ClientAddressService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = ClientAddressRepository(db)

    def list_by_client(self, client_id: int) -> List[ClientAddress]:
        return self.repo.list_by_client(client_id)

    def get_by_id(self, address_id: int) -> Optional[ClientAddress]:
        return self.repo.get_by_id(address_id)

    def create(self, client_id: int, data: dict) -> ClientAddress:
        client = self.db.query(Client).filter(Client.id == client_id).first()
        if not client:
            raise NotFoundError("Client")
        # If this is the first address for the client, force is_default so
        # the legacy `client.address` mirror always has a source row.
        existing = self.repo.list_by_client(client_id)
        is_first = len(existing) == 0
        if is_first and not data.get("is_default"):
            data["is_default"] = True
        if data.get("is_default"):
            self._clear_default(client_id)
        address = ClientAddress(client_id=client_id, **data)
        self.repo.add(address)
        # Keep `client.address` mirrored to the default row so legacy
        # code paths (PDF, ClientInfoCard, etc.) still work.
        if address.is_default:
            self._sync_client_mirror(client, address.address)
        self.db.commit()
        self.db.refresh(address)
        return address

    def update(self, address_id: int, data: dict) -> Optional[ClientAddress]:
        address = self.repo.get_by_id(address_id)
        if not address:
            return None
        # If we're flipping is_default on, clear the previous default first
        # so there's at most one default per client.
        if data.get("is_default") is True:
            self._clear_default(address.client_id, exclude_id=address_id)
        for key, value in data.items():
            if value is not None:
                setattr(address, key, value)
        self.db.commit()
        self.db.refresh(address)
        if address.is_default:
            client = self.db.query(Client).filter(Client.id == address.client_id).first()
            if client:
                self._sync_client_mirror(client, address.address)
        return address

    def delete(self, address_id: int) -> bool:
        address = self.repo.get_by_id(address_id)
        if not address:
            return False
        # Don't allow deleting the last address — every client must have
        # at least one. Otherwise the legacy `client.address` would be
        # orphaned.
        remaining = [
            a for a in self.repo.list_by_client(address.client_id) if a.id != address_id
        ]
        if not remaining:
            raise ValidationError(
                "El cliente debe tener al menos un domicilio. Agregá uno nuevo antes de eliminar este.",
            )
        was_default = address.is_default
        client_id = address.client_id
        self.repo.delete(address)
        self.db.commit()
        # If we deleted the default, promote the next one.
        if was_default:
            next_default = self.repo.list_by_client(client_id)[0]
            next_default.is_default = True
            self.db.commit()
            client = self.db.query(Client).filter(Client.id == client_id).first()
            if client:
                self._sync_client_mirror(client, next_default.address)
        return True

    # --- internal helpers ---

    def _clear_default(self, client_id: int, exclude_id: int | None = None) -> None:
        for row in self.repo.list_by_client(client_id):
            if row.is_default and row.id != exclude_id:
                row.is_default = False
                self.db.add(row)
        self.db.flush()

    @staticmethod
    def _sync_client_mirror(client: Client, address_text: str) -> None:
        client.address = address_text
        client.updated_at = client.updated_at  # SQLAlchemy onupdate will refresh
