"""Tests: centralized error handling must be fail-safe and information-poor."""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError


@pytest.fixture()
def failing_app(app: FastAPI) -> FastAPI:
    """App with test-only routes that deliberately raise."""

    @app.get("/test/unexpected", include_in_schema=False)
    def _boom() -> dict[str, str]:
        raise RuntimeError("SECRET INTERNAL PATH /etc/aegisgraph should never escape")

    @app.get("/test/database", include_in_schema=False)
    def _db_fail() -> dict[str, str]:
        raise SQLAlchemyError(
            "statement: INSERT … password='hunter2' connection='/var/run/db' leaked"
        )

    return app


@pytest.fixture()
def failing_client(failing_app: FastAPI) -> Iterator[TestClient]:
    with TestClient(failing_app, raise_server_exceptions=False) as http:
        yield http


def test_unexpected_error_returns_safe_500(failing_client: TestClient) -> None:
    response = failing_client.get("/test/unexpected")
    assert response.status_code == 500
    body = response.json()
    assert body["error"]["code"] == "internal_error"
    message = body["error"]["message"]
    assert "SECRET" not in message
    assert "INTERNAL PATH" not in message


def test_unexpected_error_never_leaks_stack_details(failing_client: TestClient) -> None:
    response = failing_client.get("/test/unexpected")
    serialized = response.text
    for token in ("traceback", "RuntimeError", "raise", ".py", "except"):
        assert token not in serialized, f"stack detail leaked: {token}"


def test_database_error_returns_safe_503(failing_client: TestClient) -> None:
    response = failing_client.get("/test/database")
    assert response.status_code == 503
    body = response.json()
    assert body["error"]["code"] == "database_unavailable"
    # Underlying SQL statement and credentials must not appear client-side.
    assert "hunter2" not in response.text
    assert "INSERT" not in response.text


def test_unknown_route_returns_clean_404(failing_client: TestClient) -> None:
    response = failing_client.get("/api/v1/does-not-exist")
    assert response.status_code == 404
    assert "RuntimeError" not in response.text
