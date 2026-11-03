from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.exceptions import ValidationError
from app.models.client import Client
from app.models.client_address import ClientAddress


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
        client = db.query(Client).filter(Client.id == client_id).first()
        if client is None:
            raise ValidationError("El cliente seleccionado no existe.")
        validate_delivery_address(db, data, client.id)
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
    validate_delivery_address(db, data, client.id)
    return client.id


def validate_delivery_address(db: Session, data: dict, client_id: int) -> None:
    """Ensure a selected delivery address belongs to the selected client."""
    address_id = data.get("delivery_address_id")
    if address_id is None:
        return
    address = (
        db.query(ClientAddress)
        .filter(ClientAddress.id == address_id, ClientAddress.client_id == client_id)
        .first()
    )
    if address is None:
        raise ValidationError("El domicilio seleccionado no pertenece al cliente.")


def apply_client_update(
    db: Session,
    data: dict,
    current_client_id: int,
    error_message: str,
) -> None:
    """Apply an explicit client FK update without trusting display fields.

    ``client_id`` is intentionally presence-sensitive: absent means the caller
    did not request a client change. A null FK is not allowed by the current
    budget/work-order schema, so clearing a form without selecting a replacement
    is rejected instead of silently retaining the old client.
    """
    has_client_update = "client_id" in data
    requested_client_id = data.get("client_id")

    if has_client_update:
        if requested_client_id is None:
            raise ValidationError(error_message)
        client = db.query(Client).filter(Client.id == requested_client_id).first()
        if client is None:
            raise ValidationError("El cliente seleccionado no existe.")
        if requested_client_id != current_client_id:
            # An address from the previous client must never travel with the
            # new association. Keep only an address that belongs to the new
            # client; otherwise clear the stale selection.
            address_id = data.get("delivery_address_id")
            if address_id is not None:
                belongs_to_client = (
                    db.query(ClientAddress)
                    .filter(
                        ClientAddress.id == address_id,
                        ClientAddress.client_id == client.id,
                    )
                    .first()
                    is not None
                )
                if not belongs_to_client:
                    data["delivery_address_id"] = None
        validate_delivery_address(db, data, client.id)

    # These are response/display fields, not ORM columns. In particular, an old
    # client_name must never override an explicit client_id.
    for key in ("client_name", "client_phone", "client_email", "client_address"):
        data.pop(key, None)
