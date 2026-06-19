import os
from typing import Optional, List
from fastapi import UploadFile
from sqlalchemy.orm import Session
from app.repositories.configuracion import ConfiguracionRepository
from app.services.exceptions import NotFoundError
from app.config import get_settings


class ConfiguracionService:
    def __init__(self, db: Session):
        self.repo = ConfiguracionRepository(db)

    def listar(self) -> list:
        return self.repo.get_all(limit=500)

    def obtener(self, key: str):
        cfg = self.repo.get_by_key(key)
        if not cfg:
            return None
        return cfg

    def actualizar(self, key: str, value: str):
        return self.repo.set(key, value)

    def upload_logo(self, file: UploadFile) -> str:
        settings = get_settings()
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        file_path = os.path.join(settings.UPLOAD_DIR, "logo.png")
        content = file.file.read()
        with open(file_path, "wb") as f:
            f.write(content)
        self.repo.set("logo", file_path)
        return file_path
