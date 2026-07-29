import json as _json

from sqlalchemy.orm import Session

from app.models.setting import Setting

COMPANY_KEYS = ["company_name", "company_tagline", "company_address", "company_phone", "company_email", "company_logo", "pdf_footer"]
TERMS_KEYS = ["budget_terms", "delivery_terms", "warranty_text", "observaciones_automaticas"]


def load_settings(db: Session) -> dict:
    rows = db.query(Setting).all()
    return {row.key: row.value for row in rows}


def has_terms(value) -> bool:
    if not value:
        return False
    s = str(value).strip()
    return s not in ("", "[]")


def split_or_default(value, default_global_terms) -> list[str]:
    if value is None or value == "":
        return default_global_terms or []
    if isinstance(value, list):
        return [str(t) for t in value if str(t).strip()]
    raw = str(value).strip()
    if not raw:
        return default_global_terms or []
    try:
        parsed = _json.loads(raw)
        if isinstance(parsed, list):
            return [str(t) for t in parsed if str(t).strip()]
    except (ValueError, TypeError):
        pass
    return [t for t in (line.strip() for line in raw.splitlines()) if t]


def build_company_and_terms(settings_data: dict, budget_key: str, overrides: dict | None = None) -> tuple[dict, dict]:
    company = {k: settings_data.get(k, "") for k in COMPANY_KEYS}
    overrides = overrides or {}
    terms = {k: settings_data.get(k, "") for k in TERMS_KEYS}
    if has_terms(overrides.get(budget_key)):
        terms["budget_terms"] = overrides[budget_key]
    if has_terms(overrides.get("warranty_override")):
        terms["warranty_text"] = overrides["warranty_override"]
    return company, terms
