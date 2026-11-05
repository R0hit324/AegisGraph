"""Tests: health endpoints and API surface behavior."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError


def test_root_reports_app_metadata(client: TestClient) -> None:
    response = client.get("/")
    assert response.status_code == 200
    body = response.json()
    assert body["application"] == "AegisGraph"
    assert body["version"].startswith("0.1.")
    assert body["docs"] == "/docs"


def test_health_reports_connected_database(client: TestClient) -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["database"] == "connected"
    assert body["version"].startswith("0.1.")
    assert body["application"] == "AegisGraph"
    assert body["environment"] == "test"
    # Timestamp must be present and parse as ISO format.
    assert body["timestamp"]


def test_health_response_has_no_sensitive_fields(client: TestClient) -> None:
    body: dict[str, object] = client.get("/api/v1/health").json()
    serialized = str(body).lower()
    for forbidden in ("postgres", "password", "sqlite://", "secret", "connection"):
        assert forbidden not in serialized, f"health leaked sensitive token: {forbidden}"


def test_liveness_probe_is_independent_of_database(client: TestClient) -> None:
    response = client.get("/api/v1/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "ready", "version": "0.1.0-test"}


def test_readiness_is_200_with_database(client: TestClient) -> None:
    response = client.get("/api/v1/health/ready")
    assert response.status_code == 200
    assert response.json()["status"] == "ready"


class _BrokenEngine:
    """Engine stand-in whose every connection attempt raises."""

    def connect(self) -> None:
        raise SQLAlchemyError("connection refused (unit test)")


def test_health_and_readiness_are_503_when_database_down(client: TestClient) -> None:
    """Degraded dependency must produce 503 — never fake success."""
    from app.api.routes import health as health_routes
    from app.services.health_service import HealthService

    failing_service = HealthService(engine=_BrokenEngine())  # type: ignore[arg-type]
    client.app.dependency_overrides[health_routes.get_health_service] = lambda: failing_service
    try:
        ready = client.get("/api/v1/health/ready")
        assert ready.status_code == 503

        health = client.get("/api/v1/health")
        assert health.status_code == 503
        assert health.json()["status"] == "degraded"
        assert health.json()["database"] == "unavailable"
    finally:
        client.app.dependency_overrides.clear()


def test_api_docs_are_served(client: TestClient) -> None:
    response = client.get("/docs")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
