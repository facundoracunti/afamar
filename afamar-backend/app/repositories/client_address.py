from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.client_address import ClientAddress
from app.repositories.base import BaseRepository


class ClientAddressRepository(BaseRepository):
    model = ClientAddress

    def __init__(self, db: Session):
        super().__init__(db)

    def list_by_client(self, client_id: int) -> List[ClientAddress]:
        return (
            self.db.query(ClientAddress)
            .filter(ClientAddress.client_id == client_id)
            .order_by(ClientAddress.is_default.desc(), ClientAddress.id.asc())
            .all()
        )

    def get_default(self, client_id: int) -> Optional[ClientAddress]:
        return (
            self.db.query(ClientAddress)
            .filter(ClientAddress.client_id == client_id, ClientAddress.is_default.is_(True))
            .first()
        )
