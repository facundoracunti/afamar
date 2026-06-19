from typing import Generic, TypeVar, Type, Optional, List, Dict, Any
from sqlalchemy.orm import Session
from app.database import Base

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    def __init__(self, model: Type[ModelType], db: Session):
        self.model = model
        self.db = db

    def get(self, id: int) -> Optional[ModelType]:
        return self.db.query(self.model).filter(self.model.id == id).first()

    def get_by(self, **kwargs) -> Optional[ModelType]:
        return self.db.query(self.model).filter_by(**kwargs).first()

    def get_all(
        self, skip: int = 0, limit: int = 100, order_by: Optional[Any] = None
    ) -> List[ModelType]:
        query = self.db.query(self.model).offset(skip).limit(limit)
        if order_by is not None:
            query = query.order_by(order_by)
        return query.all()

    def filter(self, **kwargs) -> List[ModelType]:
        return self.db.query(self.model).filter_by(**kwargs).all()

    def create(self, **kwargs) -> ModelType:
        instance = self.model(**kwargs)
        self.db.add(instance)
        self.db.commit()
        self.db.refresh(instance)
        return instance

    def update(self, id: int, **kwargs) -> Optional[ModelType]:
        instance = self.get(id)
        if not instance:
            return None
        for key, value in kwargs.items():
            if value is not None:
                setattr(instance, key, value)
        self.db.commit()
        self.db.refresh(instance)
        return instance

    def delete(self, id: int) -> bool:
        instance = self.get(id)
        if not instance:
            return False
        self.db.delete(instance)
        self.db.commit()
        return True

    def count(self) -> int:
        return self.db.query(self.model).count()

    def exists(self, **kwargs) -> bool:
        return self.db.query(self.model).filter_by(**kwargs).first() is not None
