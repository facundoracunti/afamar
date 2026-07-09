from typing import List, Optional

from sqlalchemy.orm import Session

from app.core.exceptions import ValidationError
from app.models.additional_work import AdditionalWork
from app.models.reference import Currency
from app.repositories.additional_work import AdditionalWorkRepository


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


class AdditionalWorkService:
    def __init__(self, db: Session):
        self.repo = AdditionalWorkRepository(db)

    def get_all(self, skip: int = 0, limit: int = 100) -> List[AdditionalWork]:
        return self.repo.get_all(skip=skip, limit=limit)

    def get_by_id(self, additional_work_id: int) -> Optional[AdditionalWork]:
        return self.repo.get_by_id(additional_work_id)

    def create(self, data: dict) -> AdditionalWork:
        if "currency" in data:
            data["currency_id"] = _resolve_currency_id(self.repo.db, data.pop("currency"))
        additional_work = self.repo.create(data)
        self.repo.db.commit()
        return additional_work

    def update(self, additional_work_id: int, data: dict) -> Optional[AdditionalWork]:
        additional_work = self.repo.get_by_id(additional_work_id)
        if not additional_work:
            return None
        if "currency" in data:
            data["currency_id"] = _resolve_currency_id(self.repo.db, data.pop("currency"))
        result = self.repo.update(additional_work, data)
        self.repo.db.commit()
        return result

    def delete(self, additional_work_id: int) -> bool:
        additional_work = self.repo.get_by_id(additional_work_id)
        if not additional_work:
            return False
        self.repo.delete(additional_work)
        self.repo.db.commit()
        return True
