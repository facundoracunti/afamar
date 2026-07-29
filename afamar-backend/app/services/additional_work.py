from typing import List, Optional

from sqlalchemy.orm import Session

from app.core.exceptions import ValidationError
from app.models.additional_work import AdditionalWork
from app.repositories.additional_work import AdditionalWorkRepository
from app.services.base import BaseService
from app.utils.currency import resolve_currency_id


class AdditionalWorkService(BaseService[AdditionalWork]):
    def __init__(self, db: Session):
        self.repo = AdditionalWorkRepository(db)
        super().__init__(db)

    def create(self, data: dict) -> AdditionalWork:
        if "currency" in data:
            data["currency_id"] = resolve_currency_id(self.repo.db, data.pop("currency"))
        additional_work = self.repo.create(data)
        self.repo.db.commit()
        return additional_work

    def update(self, additional_work_id: int, data: dict) -> Optional[AdditionalWork]:
        additional_work = self.repo.get_by_id(additional_work_id)
        if not additional_work:
            return None
        if "currency" in data:
            data["currency_id"] = resolve_currency_id(self.repo.db, data.pop("currency"))
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
