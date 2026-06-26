import os
import uuid
from typing import Optional, List
from sqlalchemy.orm import Session
from fastapi import UploadFile
from app.repositories.trabajo_realizado import TrabajoRealizadoRepository
from app.services.exceptions import NotFoundError, ValidationError
from app.config import get_settings

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}


class TrabajoRealizadoService:
    def __init__(self, db: Session):
        self.repo = TrabajoRealizadoRepository(db)

    def listar(self, skip=0, limit=100) -> list:
        return self.repo.list_all(skip, limit)

    def obtener(self, trabajo_id: int):
        trabajo = self.repo.get(trabajo_id)
        if not trabajo:
            raise NotFoundError("TrabajoRealizado", trabajo_id)
        return trabajo

    def crear(self, data: dict):
        return self.repo.create(**data)

    def actualizar(self, trabajo_id: int, data: dict):
        trabajo = self.repo.get(trabajo_id)
        if not trabajo:
            raise NotFoundError("TrabajoRealizado", trabajo_id)
        for key, value in data.items():
            if value is not None:
                setattr(trabajo, key, value)
        self.repo.db.commit()
        self.repo.db.refresh(trabajo)
        return trabajo

    def eliminar(self, trabajo_id: int):
        if not self.repo.delete(trabajo_id):
            raise NotFoundError("TrabajoRealizado", trabajo_id)

    def upload_foto(self, trabajo_id: int, file: UploadFile) -> str:
        if file.content_type not in ALLOWED_MIME_TYPES:
            raise ValidationError("Formato de archivo no permitido. Use jpg, png o webp.")

        trabajo = self.repo.get(trabajo_id)
        if not trabajo:
            raise NotFoundError("TrabajoRealizado", trabajo_id)

        if trabajo.foto:
            old_path = os.path.join(
                get_settings().UPLOAD_DIR, "productos", os.path.basename(trabajo.foto)
            )
            if os.path.exists(old_path):
                os.remove(old_path)

        target_dir = os.path.join(get_settings().UPLOAD_DIR, "productos")
        os.makedirs(target_dir, exist_ok=True)

        ext = os.path.splitext(file.filename or "foto.jpg")[1]
        unique_name = f"trabajo_{trabajo_id}_{uuid.uuid4().hex[:8]}{ext}"
        relative_path = f"uploads/productos/{unique_name}"

        content = file.file.read()
        with open(os.path.join(get_settings().UPLOAD_DIR, "productos", unique_name), "wb") as f:
            f.write(content)

        trabajo.foto = relative_path
        self.repo.db.commit()
        self.repo.db.refresh(trabajo)
        return relative_path
