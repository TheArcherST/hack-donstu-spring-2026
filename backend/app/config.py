from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(case_sensitive=False, extra="ignore")

    app_name: str = "DDoS-Guard: Линия защиты API"
    database_url: str = Field(
        default="postgresql+psycopg://ddos_guard:ddos_guard@db:5432/ddos_guard",
        alias="DATABASE_URL",
    )
    api_cors_origins: str = Field(default="http://localhost:8080", alias="API_CORS_ORIGINS")
    admin_password: str = Field(default="", alias="ADMIN_PASSWORD")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.api_cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
