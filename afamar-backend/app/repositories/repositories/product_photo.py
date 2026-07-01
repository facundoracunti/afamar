from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.product_photo import ProductPhoto
from app.repositories.base import BaseRepository


class ProductPhotoRepository(BaseRepository):
    model = ProductPhoto

    def __init__(self, db: Session):
        super().__init__(db)

    def get_by_id(self, photo_id: int) -> Optional[ProductPhoto]:
        return self.db.query(ProductPhoto).filter(ProductPhoto.id == photo_id).first()

    def get_all(self, skip: int = 0, limit: int = 100) -> List[ProductPhoto]:
        return self.db.query(ProductPhoto).order_by(ProductPhoto.created_at.desc()).offset(skip).limit(limit).all()

    def get_latest(self, limit: int = 12) -> List[ProductPhoto]:
        return self.db.query(ProductPhoto).order_by(ProductPhoto.created_at.desc()).limit(limit).all()

    def create(self, data: dict) -> ProductPhoto:
        return self.save(ProductPhoto(**data))

    def update(self, photo: ProductPhoto, data: dict) -> ProductPhoto:
        for key, value in data.items():
            if value is not None:
                setattr(photo, key, value)
        return self.save(photo)

    def delete(self, photo: ProductPhoto) -> None:
        super().delete(photo)
