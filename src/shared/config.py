"""
BasketStats Pro v2.0 — Configuración central
"""

from pydantic_settings import BaseSettings
from pydantic import Field, ConfigDict


class Settings(BaseSettings):
    model_config = ConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Supabase
    supabase_url: str = Field(..., env="SUPABASE_URL")
    supabase_key: str = Field(..., env="SUPABASE_KEY")
    supabase_service_role_key: str = Field("", env="SUPABASE_SERVICE_ROLE_KEY")

    # Scraping
    feb_base_url: str = Field("https://www.feb.es", env="FEB_BASE_URL")
    scraping_headless: bool = Field(True, env="SCRAPING_HEADLESS")
    scraping_timeout_ms: int = Field(30000, env="SCRAPING_TIMEOUT_MS")
    scraping_delay_s: int = Field(2, env="SCRAPING_DELAY_BETWEEN_REQUESTS_S")

    # App
    app_name: str = Field("BasketStats Pro", env="APP_NAME")
    app_env: str = Field("development", env="APP_ENV")
    log_level: str = Field("DEBUG", env="LOG_LEVEL")


settings = Settings()

