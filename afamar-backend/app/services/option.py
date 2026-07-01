from typing import Any

from sqlalchemy.orm import Session

from app.repositories.option import OptionRepository


class AppOptionService:
    def __init__(self, db: Session):
        self.repo = OptionRepository(db)

    def get_all(self):
        return self.repo.get_all()

    def get_by_category(self, category: str):
        return self.repo.get_by_category(category)

    def get_by_id(self, option_id: int):
        return self.repo.get_by_id(option_id)

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
