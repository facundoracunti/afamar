from pydantic import BaseModel
from typing import Optional

class ConfiguracionBase(BaseModel):
    key: str
    value: str

class ConfiguracionCreate(ConfiguracionBase):
    pass

class ConfiguracionUpdate(BaseModel):
    value: str

class Configuracion(ConfiguracionBase):
    id: int

    class Config:
        from_attributes = True
