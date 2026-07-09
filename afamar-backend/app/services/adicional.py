from typing import List, Optional

from sqlalchemy.orm import Session

from app.core.exceptions import ValidationError
from app.models.adicional import Adicional
from app.models.reference import Currency
from app.repositories.adicional import AdicionalRepository


def _resolve_currency_id(db: Session, code: str) -> int:
    """Translate a 3-letter currency code into the matching
    `currencies.id`. Raises `ValidationError` if the code doesn't
    exist (so the API returns 422 with a clear message rather than a
    500 IntegrityError on a dangling FK). Same helper used by
    `MaterialService` and `PoolStockService`."""
    if not code:
        return 1  # default to ARS (id=1 by the seeder order)
    cur = db.query(Currency).filter(Currency.code == code.upper()).first()
    if not cur:
        raise ValidationError(
            f"Moneda desconocida: {code!r}. Las monedas válidas se configuran en `currencies`."
        )
    return cur.id


class AdicionalService:
    def __init__(self, db: Session):
        self.repo = AdicionalRepository(db)

    def get_all(self, skip: int = 0, limit: int = 100) -> List[Adicional]:
        return self.repo.get_all(skip=skip, limit=limit)

    def get_by_id(self, adicional_id: int) -> Optional[Adicional]:
        return self.repo.get_by_id(adicional_id)

    def create(self, data: dict) -> Adicional:
        if "currency" in data:
            data["currency_id"] = _resolve_currency_id(self.repo.db, data.pop("currency"))
        adicional = self.repo.create(data)
        self.repo.db.commit()
        return adicional

    def update(self, adicional_id: int, data: dict) -> Optional[Adicional]:
        adicional = self.repo.get_by_id(adicional_id)
        if not adicional:
            return None
        if "currency" in data:
            data["currency_id"] = _resolve_currency_id(self.repo.db, data.pop("currency"))
        result = self.repo.update(adicional, data)
        self.repo.db.commit()
        return result

    def delete(self, adicional_id: int) -> bool:
        adicional = self.repo.get_by_id(adicional_id)
        if not adicional:
            return False
        self.repo.delete(adicional)
        self.repo.db.commit()
        return True
