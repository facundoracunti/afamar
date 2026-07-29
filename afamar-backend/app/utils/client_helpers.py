from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.exceptions import ValidationError
from app.models.client import Client


def resolve_client_id(db: Session, data: dict, error_message: str) -> int:
    """Look up an existing client by name or create a new one from the
    `client_name`/`client_phone`/`client_email`/`client_address` keys in
    `data`.  Returns the resolved `client_id` and mutates `data` by
    removing the serialized `client_*` keys so they don't leak into the
    ORM model (which has no such columns).

    Called by BudgetService.create and WorkOrderService.create where the
    frontend may send a client name instead of an existing client_id (the
    typeahead is free-text — users can type a new name).
    """
    client_id = data.get("client_id")
    if client_id:
        data.pop("client_name", None)
        data.pop("client_phone", None)
        data.pop("client_email", None)
        data.pop("client_address", None)
        return client_id

    client_name = (data.get("client_name") or "").strip()
    if not client_name:
        raise ValidationError(error_message)

    client = (
        db.query(Client)
        .filter(func.lower(Client.name) == client_name.lower())
        .first()
    )
    if not client:
        client = Client(
            name=client_name,
            phone=(data.get("client_phone") or "").strip() or None,
            email=(data.get("client_email") or "").strip() or None,
            address=(data.get("client_address") or "").strip() or None,
        )
        db.add(client)
        db.flush()

    data.pop("client_name", None)
    data.pop("client_phone", None)
    data.pop("client_email", None)
    data.pop("client_address", None)
    return client.id
