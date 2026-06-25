from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.schemas.configuracion import ConfiguracionCreate, ConfiguracionUpdate, Configuracion as ConfiguracionSchema
from app.services.configuracion_service import ConfiguracionService

router = APIRouter()


def _get_service(db: Session = Depends(get_db)):
    return ConfiguracionService(db)


@router.get("", response_model=List[ConfiguracionSchema])
def listar_config(service: ConfiguracionService = Depends(_get_service)):
    return service.listar()


@router.get("/{key}", response_model=ConfiguracionSchema)
def obtener_config(key: str, service: ConfiguracionService = Depends(_get_service)):
    cfg = service.obtener(key)
    if not cfg:
        raise HTTPException(404, f"Configuración '{key}' no encontrada")
    return cfg


@router.post("", response_model=ConfiguracionSchema, status_code=201)
def crear_config(
    data: ConfiguracionCreate,
    service: ConfiguracionService = Depends(_get_service),
):
    return service.actualizar(data.key, data.value)


@router.put("/{key}", response_model=ConfiguracionSchema)
def actualizar_config(
    key: str, data: ConfiguracionUpdate,
    service: ConfiguracionService = Depends(_get_service),
):
    return service.actualizar(key, data.value)


@router.post("/upload-logo")
def upload_logo(file: UploadFile = File(...), service: ConfiguracionService = Depends(_get_service)):
    file_path = service.upload_logo(file)
    return {"message": "Logo subido correctamente", "path": file_path}
