from typing import Any, Generic, Optional, TypeVar

from sqlalchemy.orm import Session

from app.core.database import Base
from app.repositories.base import BaseRepository

ModelT = TypeVar("ModelT", bound=Base)


class BaseService(Generic[ModelT]):
    repo: BaseRepository

    def __init__(self, db: Session):
        self.db = db

    def get_all(self, skip: int = 0, limit: int = 100) -> list[ModelT]:
        return self.repo.get_all(skip, limit)

    def get_by_id(self, id: int) -> Optional[ModelT]:
        return self.repo.get_by_id(id)

    def create(self, data: dict[str, Any]) -> ModelT:
        return self.repo.create(data)

    def update(self, id: int, data: dict[str, Any]) -> Optional[ModelT]:
        obj = self.repo.get_by_id(id)
        if not obj:
            return None
        return self.repo.update(obj, data)

    def delete(self, id: int) -> bool:
        obj = self.repo.get_by_id(id)
        if not obj:
            return False
        self.repo.delete(obj)
        return True
