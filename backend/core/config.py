"""
Centralized, type-safe app configuration.

WHY THIS FILE EXISTS:
Every setting (DB URL, secrets, API keys) is read from .env ONCE, here.
No other file should call os.getenv() directly - they import `settings`
from this file instead. Interview line: "one source of truth for config,
type-checked at startup instead of failing randomly deep in the code."
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # App
    app_name: str = "PositionIQ"
    environment: str = "development"
    debug: bool = True

    # Database
    database_url: str

    # Security (used from Phase 3 onward)
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # External APIs (used from later phases onward)
    finnhub_api_key: str = ""
    gemini_api_key: str = ""

    # Email (daily digest) - optional; digest sends are skipped, not crashed,
    # when these aren't configured
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


# Import this single instance everywhere instead of re-reading .env
settings = Settings()
