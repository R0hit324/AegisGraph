"""Security tests: configuration validation must fail closed.

Invalid or unsafe configuration must never silently degrade into a weak
default. The ingestion of malformed values raises at startup.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.config.settings import Settings


def _build_env(
    monkeypatch: pytest.MonkeyPatch,
    **overrides: str,
) -> None:
    base: dict[str, str] = {
        "APP_ENV": "test",
        "APP_VERSION": "0.1.0-test",
        "APP_SECRET_KEY": "unit-test-secret-key",
        "DATABASE_URL": "postgresql+psycopg://user:pw@db:5432/aegisgraph",
        "ALLOWED_ORIGINS": "http://localhost:3000",
    }
    base.update(overrides)
    for key, value in base.items():
        monkeypatch.setenv(key, value)


def test_valid_settings_load(monkeypatch: pytest.MonkeyPatch) -> None:
    _build_env(monkeypatch)
    settings = Settings()
    assert settings.database_url.startswith("postgresql+psycopg://")
    assert settings.allowed_origins == ["http://localhost:3000"]


def test_missing_database_url_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    _build_env(monkeypatch)
    monkeypatch.delenv("DATABASE_URL")
    with pytest.raises(ValidationError):
        Settings()


def test_invalid_database_url_scheme_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    _build_env(monkeypatch, APP_ENV="development", DATABASE_URL="mysql://host/db")
    with pytest.raises(ValidationError, match="postgresql\\+psycopg://"):
        Settings()


def test_test_env_permits_sqlite_for_harness(monkeypatch: pytest.MonkeyPatch) -> None:
    """SQLite URLs are accepted in APP_ENV=test only (unit-test harness)."""
    _build_env(monkeypatch, DATABASE_URL="sqlite:///tmp/test.db")
    settings = Settings()
    assert settings.database_url.startswith("sqlite:///")


def test_development_env_rejects_sqlite(monkeypatch: pytest.MonkeyPatch) -> None:
    _build_env(monkeypatch, APP_ENV="development", DATABASE_URL="sqlite:///tmp/x.db")
    with pytest.raises(ValidationError, match="postgresql\\+psycopg://"):
        Settings()


def test_wildcard_cors_origin_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    _build_env(monkeypatch, ALLOWED_ORIGINS="*")
    with pytest.raises(ValidationError, match="Wildcard"):
        Settings()


def test_relative_scheme_cors_origin_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    _build_env(monkeypatch, ALLOWED_ORIGINS="javascript:alert(1)")
    with pytest.raises(ValidationError, match="http:// or https://"):
        Settings()


def test_duplicate_cors_origins_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    _build_env(monkeypatch, ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3000")
    with pytest.raises(ValidationError, match="duplicate"):
        Settings()


def test_production_requires_strong_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    _build_env(
        monkeypatch,
        APP_ENV="production",
        APP_SECRET_KEY="dev-only-secret-change-before-production",  # default-style value
    )
    with pytest.raises(ValidationError, match="APP_SECRET_KEY"):
        Settings()


def test_production_requires_secret_at_all(monkeypatch: pytest.MonkeyPatch) -> None:
    _build_env(monkeypatch, APP_ENV="production")
    monkeypatch.setenv("APP_SECRET_KEY", "")
    with pytest.raises(ValidationError, match="APP_SECRET_KEY"):
        Settings()


def test_development_without_secret_is_allowed(monkeypatch: pytest.MonkeyPatch) -> None:
    """Development mode startup must not require any paid/external service."""
    _build_env(monkeypatch, APP_ENV="development")
    monkeypatch.setenv("APP_SECRET_KEY", "")
    settings = Settings()
    assert settings.app_env == "development"


def test_origin_list_parsing_strips_whitespace(monkeypatch: pytest.MonkeyPatch) -> None:
    _build_env(monkeypatch, ALLOWED_ORIGINS=" http://localhost:3000 , http://127.0.0.1:3000 ")
    settings = Settings()
    assert settings.allowed_origins == ["http://localhost:3000", "http://127.0.0.1:3000"]
