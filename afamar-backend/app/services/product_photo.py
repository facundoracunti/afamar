import os
from io import BytesIO
from typing import List, Optional
from uuid import uuid4

from PIL import Image
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.settings import settings
from app.models.product_photo import ProductPhoto
from app.repositories.product_photo import ProductPhotoRepository

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


class ProductPhotoService:
    def __init__(self, db: Session):
        self.repo = ProductPhotoRepository(db)

    def get_all(self, skip: int = 0, limit: int = 100) -> List[ProductPhoto]:
        return self.repo.get_all(skip, limit)

    def get_by_id(self, photo_id: int) -> Optional[ProductPhoto]:
        return self.repo.get_by_id(photo_id)

    def get_latest(self, limit: int = 12) -> List[ProductPhoto]:
        return self.repo.get_latest(limit)

    def create(self, file_data: bytes, filename: str, title: str = "", description: str = "") -> ProductPhoto:
        ext = os.path.splitext(filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"Formato no permitido: {ext}. Usá JPG, PNG o WebP.")

        if len(file_data) > settings.MAX_UPLOAD_FILE_SIZE:
            raise HTTPException(status_code=400, detail="La imagen supera los 30MB.")

        upload_dir = settings.product_photos_abs_dir
        os.makedirs(upload_dir, exist_ok=True)
        stored_name = f"{uuid4().hex}.webp"
        file_path = upload_dir / stored_name

        img = Image.open(BytesIO(file_data))
        img = img.convert("RGB")
        if max(img.width, img.height) > settings.MAX_UPLOAD_DIMENSION:
            ratio = settings.MAX_UPLOAD_DIMENSION / max(img.width, img.height)
            new_size = (int(img.width * ratio), int(img.height * ratio))
            img = img.resize(new_size, Image.LANCZOS)

        img.save(file_path, "WEBP", quality=85, optimize=True)

        relative_path = f"/{settings.PRODUCT_PHOTOS_DIR}/{stored_name}"
        photo = self.repo.create({"file_path": relative_path, "title": title, "description": description})
        self.repo.db.commit()
        self.repo.db.refresh(photo)
        return photo

    def update(self, photo_id: int, data: dict) -> Optional[ProductPhoto]:
        photo = self.repo.get_by_id(photo_id)
        if not photo:
            return None
        result = self.repo.update(photo, data)
        self.repo.db.commit()
        self.repo.db.refresh(result)
        return result

    def delete(self, photo_id: int) -> bool:
        photo = self.repo.get_by_id(photo_id)
        if not photo:
            return False
        stored_name = photo.file_path.rsplit("/", 1)[-1]
        full_path = settings.product_photos_abs_dir / stored_name
        if full_path.exists():
            os.remove(full_path)
        self.repo.delete(photo)
        self.repo.db.commit()
        return True
