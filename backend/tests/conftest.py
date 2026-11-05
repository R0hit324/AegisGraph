"""Shared pytest fixtures for AegisGraph backend tests.

Each test gets a fresh SQLite database file and freshly built app so settings
changes take effect and database state never leaks between tests.
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

# Configure a valid test environment BEFORE app modules import settings.
TEST_ENV: dict[str, str] = {
    "APP_ENV": "test",
    "APP_VERSION": "0.1.0-test",
    "LOG_LEVEL": "WARNING",
    "APP_SECRET_KEY": "unit-test-secret-key-not-production",
    "DATABASE_URL": "sqlite+pysqlite:///unused-will-be-replaced",  # replaced per test
    "ALLOWED_ORIGINS": "http://localhost:3000",
}


def _apply_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for key, value in TEST_ENV.items():
        monkeypatch.setenv(key, value)


@pytest.fixture()
def test_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    """Base environment for unit tests that don't need a live database."""
    _apply_env(monkeypatch)
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'unit.db'}")

    from app.config.settings import reset_settings_cache

    reset_settings_cache()
    yield {}
    reset_settings_cache()


@pytest.fixture()
def app(test_env: dict[str, str]) -> Iterator[FastAPI]:
    """A fresh FastAPI app per test with a clean database."""
    from app.database.base import Base
    from app.database.session import dispose_engine, get_engine

    dispose_engine()
    engine = get_engine()
    Base.metadata.create_all(engine)
    from app.main import create_app

    yield create_app()
    dispose_engine()


@pytest.fixture()
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


@pytest.fixture()
def db_session(test_env: dict[str, str]) -> Iterator[Session]:
    """Direct ORM session for database lifecycle tests."""
    from app.database.base import Base
    from app.database.session import dispose_engine, get_engine, get_session_factory

    dispose_engine()
    engine = get_engine()
    Base.metadata.create_all(engine)
    session = get_session_factory()()
    yield session
    session.close()
    dispose_engine()
