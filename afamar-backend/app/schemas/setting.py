from pydantic import BaseModel, Field


class SettingUpdate(BaseModel):
    company_name: str = ""
    company_tagline: str = ""
    company_address: str = ""
    company_phone: str = ""
    company_email: str = ""
    company_logo: str = ""
    pdf_footer: str = ""
    # Terms are stored as JSON list-of-strings in the DB (edit on /admin/configuration).
    # Plain text coming from legacy entries is auto-split into a list on read
    # (see _read_settings_term_list in app/api/routers/settings.py).
    budget_terms: list[str] = Field(default_factory=list)
    delivery_terms: list[str] = Field(default_factory=list)
    warranty_text: list[str] = Field(default_factory=list)
    observaciones_automaticas: str = ""
