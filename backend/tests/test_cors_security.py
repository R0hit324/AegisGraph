"""Security tests: CORS behavior must exactly match the explicit allowlist."""

from __future__ import annotations

from fastapi.testclient import TestClient

ALLOWED = "http://localhost:3000"
NOT_ALLOWED = "https://evil.example"


def test_preflight_from_allowed_origin_is_accepted(client: TestClient) -> None:
    response = client.options(
        "/api/v1/health",
        headers={
            "Origin": ALLOWED,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "application/json",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ALLOWED


def test_plain_request_from_allowed_origin_gets_allow_header(
    client: TestClient,
) -> None:
    response = client.get("/api/v1/health", headers={"Origin": ALLOWED})
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ALLOWED


def test_request_from_disallowed_origin_is_reflected_without_allow_header(
    client: TestClient,
) -> None:
    """A foreign origin must not receive an Access-Control-Allow-Origin header."""
    response = client.get("/api/v1/health", headers={"Origin": NOT_ALLOWED})
    assert response.status_code == 200  # resource still exists
    assert "access-control-allow-origin" not in response.headers


def test_preflight_from_disallowed_origin_is_denied(client: TestClient) -> None:
    response = client.options(
        "/api/v1/health",
        headers={
            "Origin": NOT_ALLOWED,
            "Access-Control-Request-Method": "GET",
        },
    )
    assert "access-control-allow-origin" not in response.headers


def test_no_cors_credentials_are_exposed(client: TestClient) -> None:
    """Phase 1 is cookie-free; credentials must not be promised."""
    response = client.get("/api/v1/health", headers={"Origin": ALLOWED})
    assert response.headers.get("access-control-allow-credentials", "").lower() != "true"
