import os
import shutil

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.utils.responses import success
from app.models.setting import Setting
from app.schemas.setting import SettingUpdate


UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

router = APIRouter(dependencies=[Depends(get_current_user)])

DEFAULT_KEYS = {
    "company_name": "AFAMAR",
    "company_address": "",
    "company_phone": "",
    "company_email": "",
    "pdf_footer": "",
    "budget_terms": "",
    "delivery_terms": "",
    "warranty_text": "",
    "observaciones_automaticas": "",
}


@router.get("")
def get_settings(db: Session = Depends(get_db)):
    rows = db.query(Setting).all()
    data = {row.key: row.value for row in rows}
    for k, v in DEFAULT_KEYS.items():
        data.setdefault(k, v)
    return success(data)


@router.put("")
def update_settings(data: SettingUpdate, db: Session = Depends(get_db)):
    for key, value in data.model_dump().items():
        if key in DEFAULT_KEYS:
            db.merge(Setting(key=key, value=value))
    db.commit()
    return get_settings(db)


@router.post("/upload-logo")
def upload_logo(file: UploadFile = File(...), db: Session = Depends(get_db)):
    file_ext = os.path.splitext(file.filename or "logo.png")[1] or ".png"
    dest = os.path.join(UPLOAD_DIR, f"logo{file_ext}")
    with open(dest, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    setting = db.query(Setting).filter(Setting.key == "company_logo").first()
    if setting:
        setting.value = f"/uploads/logo{file_ext}"
    else:
        db.add(Setting(key="company_logo", value=f"/uploads/logo{file_ext}"))
    db.commit()
    return success({"path": f"/uploads/logo{file_ext}"})
