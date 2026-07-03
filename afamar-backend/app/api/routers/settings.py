import json
import os

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.utils.responses import success
from app.models.setting import Setting
from app.schemas.setting import SettingUpdate


UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

router = APIRouter(dependencies=[Depends(get_current_user)])

# List-of-strings settings: stored as JSON array in the DB for structured editing
# in /admin/configuration. The legacy value `""` (single plain-text block) is
# auto-converted to a list on read for backwards compatibility.
TERMS_KEYS = {"budget_terms", "delivery_terms", "warranty_text"}

# Plain-text defaults used when the DB has no row for a given key. Empty for
# terms, so a fresh install gets an empty list and the UI renders the empty
# "Agregar término" state.
DEFAULT_KEYS = {
    "company_name": "AFAMAR",
    "company_tagline": "MÁRMOLES & GRANITOS",
    "company_address": "",
    "company_phone": "",
    "company_email": "",
    "company_logo": "",
    "pdf_footer": "",
    "budget_terms": [],
    "delivery_terms": [],
    "warranty_text": [],
    "observaciones_automaticas": "",
}


def _split_legacy_terms(text: str) -> list[str]:
    """Convert a legacy plain-text value to a list of non-blank lines.

    Used when reading legacy rows from the DB that still have the old plain-text
    schema. Empty input → empty list.
    """
    if not text:
        return []
    return [line.strip() for line in text.splitlines() if line.strip()]


def _normalize_term_value(raw: str) -> list[str]:
    """Return a list[str] from a value that may be JSON, plain text, or empty."""
    if not raw:
        return []
    raw = raw.strip()
    if not raw:
        return []
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return _split_legacy_terms(raw)
    if isinstance(data, list):
        return [str(item) for item in data if str(item).strip()]
    return _split_legacy_terms(raw)


def _serialize_term_value(items: list[str]) -> str:
    """Persist as JSON so the data round-trips cleanly."""
    clean = [str(item).strip() for item in (items or []) if str(item).strip()]
    return json.dumps(clean, ensure_ascii=False)


@router.get("")
def get_settings(db: Session = Depends(get_db)):
    rows = db.query(Setting).all()
    db_data = {row.key: row.value for row in rows}
    data: dict[str, object] = {}
    # Terms: parse to list. Other fields: default if missing.
    for k, default in DEFAULT_KEYS.items():
        if k in TERMS_KEYS:
            raw = db_data.get(k, "")
            if raw:
                data[k] = _normalize_term_value(raw)
            else:
                data[k] = list(default) if isinstance(default, list) else default
        else:
            data.setdefault(k, default)
    # Fill in any term key still missing (shouldn't happen, but safety).
    for k in TERMS_KEYS:
        if k not in data:
            data[k] = []
    # Apply DB-stored values overriding defaults:
    for k, v in db_data.items():
        if k in TERMS_KEYS:
            data[k] = _normalize_term_value(v) if v else []
        elif k in data:
            data[k] = v
    return success(data)


@router.put("")
def update_settings(data: SettingUpdate, db: Session = Depends(get_db)):
    payload = data.model_dump()
    for key, value in payload.items():
        if key not in DEFAULT_KEYS:
            continue
        if key in TERMS_KEYS:
            stored = _serialize_term_value(value if isinstance(value, list) else [])
        else:
            stored = "" if value is None else str(value)
        db.merge(Setting(key=key, value=stored))
    db.commit()
    return get_settings(db)


@router.post("/upload-logo")
def upload_logo(file: UploadFile = File(...), db: Session = Depends(get_db)):
    from PIL import Image
    from io import BytesIO

    contents = file.file.read()
    try:
        img = Image.open(BytesIO(contents))
        img.load()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Archivo no es una imagen válida: {exc}")

    for ext in (".png", ".jpg", ".jpeg", ".webp", ".gif"):
        old = os.path.join(UPLOAD_DIR, f"logo{ext}")
        if os.path.exists(old):
            try:
                os.remove(old)
            except OSError:
                pass

    dest = os.path.join(UPLOAD_DIR, "logo.png")
    if img.mode in ("RGBA", "LA", "P"):
        img.save(dest, format="PNG")
    else:
        img.convert("RGB").save(dest, format="PNG")

    setting = db.query(Setting).filter(Setting.key == "company_logo").first()
    if setting:
        setting.value = "/uploads/logo.png"
    else:
        db.add(Setting(key="company_logo", value="/uploads/logo.png"))
    db.commit()
    return success({"path": "/uploads/logo.png"})
