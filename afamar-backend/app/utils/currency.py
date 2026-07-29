from sqlalchemy.orm import Session

from app.core.exceptions import ValidationError
from app.models.reference import Currency


def resolve_currency_id(db: Session, code: str) -> int:
    """Translate a 3-letter currency code from the wire payload into
    the matching `currencies.id` row. Raises `ValidationError` if the
    code doesn't exist (so the API returns 422 with a clear message
    rather than a 500 IntegrityError on a dangling FK)."""
    if not code:
        return 1  # default to ARS (id=1 by the seeder order)
    cur = db.query(Currency).filter(Currency.code == code.upper()).first()
    if not cur:
        raise ValidationError(
            f"Moneda desconocida: {code!r}. Las monedas válidas se configuran en `currencies`."
        )
    return cur.id
