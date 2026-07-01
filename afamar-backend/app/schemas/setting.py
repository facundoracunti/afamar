from pydantic import BaseModel


class SettingUpdate(BaseModel):
    company_name: str = ""
    company_address: str = ""
    company_phone: str = ""
    company_email: str = ""
    company_logo: str = ""
    pdf_footer: str = ""
    budget_terms: str = ""
    delivery_terms: str = ""
    warranty_text: str = ""
    observaciones_automaticas: str = ""
