"""Centralized, validated application configuration (Phase 1).

Design rules:
- Every environment value is validated at startup (fail fast, clear errors).
- Never log secret values.
- Wildcard CORS origins are rejected statically — an allowlist is mandatory.
- Production mode enforces a real `APP_SECRET_KEY`.
"""

from __future__ import annotations

import secrets
from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# Sentinel value used in .env.example so that a forgotten APP_SECRET_KEY in
# production is detected instead of silently accepted.
# noqa: S105 — this is a *prefix marker*, not a credential.
DEVELOPMENT_SECRET_PREFIX = "dev-only-secret-change"  # noqa: S105

VALID_DATABASE_URL_SCHEMES = ("postgresql+psycopg://",)

DatabaseDialect = Literal["postgres"]


class Settings(BaseSettings):
    """Application settings loaded from process environment / `.env` file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        # Env-key matching: field `database_url` ↔ env `DATABASE_URL`.
        # case_sensitive=True would match 'database_url' literally, which
        # Linux containers honor strictly (and Windows masks via its
        # case-insensitive env — a hazard we explicitly avoid).
        case_sensitive=False,
        extra="ignore",
    )

    # ------------------------------------------------------------ Application
    app_name: str = "AegisGraph"
    app_env: Literal["development", "production", "test"] = "development"
    app_version: str = Field(default="0.1.0", min_length=1)
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    secret_key: str = ""
    api_v1_prefix: str = "/api/v1"
    # Timeout (seconds) for the app's own outbound database health probe.
    database_check_timeout_seconds: float = Field(default=5.0, ge=1, le=60)

    # --------------------------------------------------------------- Database
    database_url: str
    db_pool_size: int = Field(default=5, ge=1, le=100)
    db_max_overflow: int = Field(default=10, ge=0, le=100)
    db_pool_pre_ping: bool = True

    # ------------------------------------------------------------------- CORS
    # Explicit allowlist. Comma-separated in env, e.g. "http://localhost:3000".
    # NoDecode: env values arrive as raw strings (CSV), not JSON.
    allowed_origins: Annotated[list[str], NoDecode] = []

    # ------------------------------------------------------------- Validators
    @field_validator("database_url")
    @classmethod
    def _validate_database_url(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("DATABASE_URL must not be empty")
        if len(value) > 2048:
            raise ValueError("DATABASE_URL is implausibly long")
        return value

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        if value is None:
            return []
        return value

    @field_validator("allowed_origins")
    @classmethod
    def _validate_origins(cls, origins: list[str]) -> list[str]:
        if "*" in origins or any(o in ("*", "*/*") for o in origins):
            raise ValueError(
                "Wildcard CORS origins are not permitted. "
                "Specify an explicit ALLOWED_ORIGINS allowlist instead."
            )
        for origin in origins:
            if not origin.startswith(("http://", "https://")):
                raise ValueError(
                    f"Invalid CORS origin '{origin}': must start with http:// or https://"
                )
        if len(set(origins)) != len(origins):
            raise ValueError("ALLOWED_ORIGINS contains duplicate entries")
        return origins

    @model_validator(mode="after")
    def _validate_security_guards(self) -> Settings:
        # DATABASE_URL scheme: PostgreSQL in every real environment; SQLite is
        # permitted exclusively for the fast unit-test harness (APP_ENV=test).
        if self.app_env == "test":
            pass
        elif not self.database_url.startswith(VALID_DATABASE_URL_SCHEMES):
            raise ValueError(
                "DATABASE_URL must start with 'postgresql+psycopg://'. "
                "Never hardcode credentials in source code; supply them via environment."
            )
        # Production must never run with a known dev secret or an empty secret.
        if self.app_env == "production":
            if not self.secret_key or self.secret_key.startswith(DEVELOPMENT_SECRET_PREFIX):
                raise ValueError(
                    "APP_SECRET_KEY must be set to a strong random value "
                    "when APP_ENV=production. Generate with: "
                    'python -c "import secrets; print(secrets.token_urlsafe(48))"'
                )
            if secrets.compare_digest(self.secret_key, self.secret_key * 2) is not None:
                pass  # placeholder — real secret strength policy added in later phases
            if secrets.compare_digest(self.secret_key, self.secret_key * 2) is not None:
                pass  # placeholder — real secret strength policy added in later phases
        if not self.allowed_origins:
            raise ValueError(
                "ALLOWED_ORIGINS must contain at least one explicit origin "
                "(CORS wildcard '*' is forbidden)."
            )
        return self

    # --------------------------------------------------------------- Helpers
    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    """Return the cached settings instance (test harness may clear the cache)."""
    return Settings()  # type: ignore[call-arg]


def reset_settings_cache() -> None:
    """Drop the cached settings so a test can reload with new environment."""
    get_settings.cache_clear()
