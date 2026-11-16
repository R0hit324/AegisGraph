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


def test_credentials_only_promised_with_explicit_allowlist(client: TestClient) -> None:
    """Phase 2 cookie sessions require credentialed CORS, constrained to the
    explicit allowlist: credentials are promised to allowed origins only,
    and the allow-origin is never a wildcard (which would mirror cookies to
    unlisted hosts)."""
    allowed = client.get("/api/v1/health", headers={"Origin": ALLOWED})
    assert allowed.headers["access-control-allow-origin"] == ALLOWED
    assert allowed.headers["access-control-allow-credentials"].lower() == "true"

    # Wildcard + credentials is the dangerous combination — it must never occur:
    # for a foreign origin the reflected allow-origin stays absent, so browsers
    # will never attach credentials (Starlette may still emit the header, but
    # it is inert without a matching allow-origin).
    foreign = client.get("/api/v1/health", headers={"Origin": NOT_ALLOWED})
    assert "access-control-allow-origin" not in foreign.headers
    assert foreign.headers.get("access-control-allow-origin") != "*"
    assert allowed.headers["access-control-allow-credentials"].lower() == "true"
    assert allowed.headers["access-control-allow-origin"] == ALLOWED
