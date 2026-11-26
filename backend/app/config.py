"""Application settings (environment variables, see /.env.example)."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_SECRET = "dev-only-secret-change-me-0123456789abcdef"  # noqa: S105


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"  # development | test | production
    database_url: str = "postgresql+asyncpg://seekmate@127.0.0.1:55432/seekmate"
    secret_key: str = DEV_SECRET

    # Comma separated lists (plain strings keep env parsing predictable).
    allowed_email_domains: str = "kampus.ac.id,demo.seekmate.example"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    frontend_url: str = "http://localhost:3000"

    access_token_minutes: int = 15
    refresh_token_days: int = 30
    ws_token_seconds: int = 60
    verify_token_hours: int = 24
    cookie_secure: bool = False
    # Production over plain HTTP (no domain, no TLS). Weakens cookie protection.
    allow_insecure_http: bool = False
    # console: verification links go to the server log (no SMTP configured yet).
    mail_mode: str = "console"

    rate_limit_enabled: bool = True
    login_rate: str = "10/300"  # attempts / seconds
    login_email_rate: str = "30/300"  # per account, whatever the IP
    message_rate: str = "10/10"
    lobby_create_rate: str = "5/3600"
    register_rate: str = "5/600"
    generic_write_rate: str = "30/60"

    scheduler_enabled: bool = True
    retention_hour_utc: int = 18  # 01:00 WIB
    retention_batch_size: int = 1000
    expiring_notice_days: int = 7

    banned_words: str = "anjing,bangsat,kontol,memek,ngentot,goblok,tolol,fuck,bitch,slut"
    usability_test_mode: bool = False

    # Match weights; must sum to 1.0.
    weight_study_goal: float = Field(default=0.35, ge=0)
    weight_atmosphere: float = Field(default=0.25, ge=0)
    weight_preferred_time: float = Field(default=0.20, ge=0)
    weight_communication_style: float = Field(default=0.10, ge=0)
    weight_language: float = Field(default=0.10, ge=0)

    @model_validator(mode="after")
    def _check(self) -> Settings:
        if abs(sum(self.match_weights.values()) - 1.0) > 1e-6:
            raise ValueError("match weights must sum to 1.0")
        if self.environment == "production":
            if self.secret_key == DEV_SECRET or len(self.secret_key) < 32:
                raise ValueError("SECRET_KEY must be a unique value of 32+ characters")
            if not self.cookie_secure and not self.allow_insecure_http:
                raise ValueError("COOKIE_SECURE must be true in production")
        return self

    @property
    def match_weights(self) -> dict[str, float]:
        return {
            "study_goal": self.weight_study_goal,
            "atmosphere": self.weight_atmosphere,
            "preferred_time": self.weight_preferred_time,
            "communication_style": self.weight_communication_style,
            "language": self.weight_language,
        }

    @staticmethod
    def _split(value: str) -> list[str]:
        return [part.strip().lower() for part in value.split(",") if part.strip()]

    @property
    def email_domains(self) -> list[str]:
        return self._split(self.allowed_email_domains)

    @property
    def cors_origin_list(self) -> list[str]:
        return self._split(self.cors_origins)

    @property
    def banned_word_list(self) -> list[str]:
        return self._split(self.banned_words)


@lru_cache
def get_settings() -> Settings:
    return Settings()
