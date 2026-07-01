from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Application
    ENVIRONMENT: str = "production"
    APP_NAME: str = "AFAMAR API"
    APP_VERSION: str = "1.1.0"
    APP_DESCRIPTION: str = "API de gestión de documentos"
    DEBUG: bool = False

    # Database
    DB_USER: str = "afamar-project"
    DB_PASSWORD: str = ""
    DB_HOST: str = "mysql-central"
    DB_PORT: str = "3306"
    DB_NAME: str = "afamar-project"
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_ECHO: bool = False

    # SMTP
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""

    # WhatsApp
    WHATSAPP_API_URL: str = ""
    WHATSAPP_API_KEY: str = ""

    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_HOURS: int = 8
    CORS_ALLOW_ORIGINS: str = "*"

    # Frontend
    FRONTEND_URL: str = "http://localhost:3090"

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "text"

    # Rate limiting
    RATE_LIMIT_ENABLED: bool = True

    @property
    def cors_origins_list(self) -> list[str]:
        if self.CORS_ALLOW_ORIGINS == "*":
            return ["*"]
        return [origin.strip() for origin in self.CORS_ALLOW_ORIGINS.split(",")]

    @property
    def DATABASE_URL(self) -> str:
        if self.ENVIRONMENT == "development":
            return "sqlite:///afamar.db"
        return (
            f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    @property
    def DATABASE_URL_SAFE(self) -> str:
        if self.ENVIRONMENT == "development":
            return "sqlite:///afamar.db"
        return (
            f"mysql+pymysql://{self.DB_USER}:******"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"


settings = Settings()
