import json as _json

from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.setting import Setting
from app.schemas.budget import BudgetResponse
from app.schemas.work_order import WorkOrderResponse

COMPANY_KEYS = ["company_name", "company_tagline", "company_address", "company_phone", "company_email", "company_logo", "pdf_footer", "budget_validity_text"]
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


def prepare_work_order_payload(order, db: Session) -> tuple[dict, dict, dict, dict]:
    """Build the (data, client, company, terms) payload that feeds
    `build_work_order_pdf_data` + `generate_work_order_pdf`, mirroring the
    authenticated `/work-orders/{id}/pdf` endpoint. Shared by the private
    router and the public signed-token router so both render identically."""
    order_data = WorkOrderResponse.from_orm_with_client(order).model_dump(mode="json")
    items = []
    if order.materials_data:
        try:
            parsed = _json.loads(order.materials_data) if isinstance(order.materials_data, str) else order.materials_data
            if isinstance(parsed, list):
                items = parsed
            elif isinstance(parsed, dict):
                items = parsed.get("items", [])
        except (ValueError, TypeError):
            pass
    order_data["items"] = items
    client_dict = {"name": "", "phone": "", "email": "", "address": ""}
    if order.client:
        client_dict["name"] = order.client.name or ""
        client_dict["phone"] = order.client.phone or ""
        client_dict["email"] = order.client.email or ""
        client_dict["address"] = order.client.address or ""
    settings_data = load_settings(db)
    overrides = {
        "delivery_terms_override": getattr(order, "delivery_terms_override", None),
        "warranty_override": getattr(order, "warranty_override", None),
    }
    company, terms = build_company_and_terms(settings_data, "budget_terms_override", overrides)
    return order_data, client_dict, company, terms


def prepare_budget_payload(budget, db: Session) -> tuple[dict, dict, dict, dict]:
    """Build the (data, client, company, terms) payload that feeds
    `build_budget_pdf_data` + `generate_budget_pdf`. Shared by the private
    router and the public signed-token router so both render identically."""
    budget_data = BudgetResponse.from_orm_with_client(budget).model_dump(mode="json")
    client = budget.client
    client_dict = {
        "name": client.name or "",
        "phone": client.phone or "",
        "email": client.email or "",
        "address": client.address or "",
    }
    settings_data = load_settings(db)
    overrides = {
        "budget_terms_override": getattr(budget, "budget_terms_override", None),
        "warranty_override": getattr(budget, "warranty_override", None),
    }
    company, terms = build_company_and_terms(settings_data, "budget_terms_override", overrides)
    return budget_data, client_dict, company, terms
