import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.configuracion import Configuracion
from app.schemas.configuracion import ConfiguracionCreate, ConfiguracionUpdate, Configuracion as ConfiguracionSchema
from app.config import get_settings

router = APIRouter()

@router.get("/", response_model=List[ConfiguracionSchema])
def listar_configuracion(db: Session = Depends(get_db)):
    return db.query(Configuracion).all()

@router.get("/{key}", response_model=ConfiguracionSchema)
def obtener_config(key: str, db: Session = Depends(get_db)):
    config = db.query(Configuracion).filter(Configuracion.key == key).first()
    if not config:
        raise HTTPException(404, "Configuración no encontrada")
    return config

@router.post("/", response_model=ConfiguracionSchema, status_code=201)
def crear_config(data: ConfiguracionCreate, db: Session = Depends(get_db)):
    existente = db.query(Configuracion).filter(Configuracion.key == data.key).first()
    if existente:
        raise HTTPException(400, "La clave ya existe")
    config = Configuracion(**data.model_dump())
    db.add(config)
    db.commit()
    db.refresh(config)
    return config

@router.put("/{key}", response_model=ConfiguracionSchema)
def actualizar_config(key: str, data: ConfiguracionUpdate, db: Session = Depends(get_db)):
    config = db.query(Configuracion).filter(Configuracion.key == key).first()
    if not config:
        config = Configuracion(key=key, value=data.value)
        db.add(config)
    else:
        config.value = data.value
    db.commit()
    db.refresh(config)
    return config

@router.post("/upload-logo")
async def upload_logo(file: UploadFile = File(...), db: Session = Depends(get_db)):
    settings = get_settings()
    upload_dir = settings.UPLOAD_DIR
    os.makedirs(upload_dir, exist_ok=True)

    file_path = os.path.join(upload_dir, "logo.png")
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    config = db.query(Configuracion).filter(Configuracion.key == "logo").first()
    if config:
        config.value = f"{upload_dir}/logo.png"
    else:
        config = Configuracion(key="logo", value=f"{upload_dir}/logo.png")
        db.add(config)
    db.commit()

    return {"message": "Logo subido correctamente", "path": f"{upload_dir}/logo.png"}
