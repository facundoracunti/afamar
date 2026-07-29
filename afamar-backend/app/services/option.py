from typing import Any

from sqlalchemy.orm import Session

from app.models.options import AppOption
from app.repositories.option import OptionRepository
from app.services.base import BaseService


class AppOptionService(BaseService[AppOption]):
    def __init__(self, db: Session):
        self.repo = OptionRepository(db)
        super().__init__(db)

    def get_by_category(self, category: str):
        return self.repo.get_by_category(category)

    def create(self, data: dict[str, Any]):
        option = self.repo.create(data)
        self.repo.db.commit()
        self.repo.db.refresh(option)
        return option

    def delete(self, option_id: int) -> bool:
        opt = self.repo.get_by_id(option_id)
        if not opt:
            return False
        self.repo.delete(opt)
        self.repo.db.commit()
        return True
