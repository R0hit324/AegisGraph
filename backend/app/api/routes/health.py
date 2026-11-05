"""Health, liveness and readiness endpoints."""

from __future__ import annotations

from typing import cast

from fastapi import APIRouter, Depends, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.config.settings import Settings, get_settings
from app.database import get_db
from app.schemas.health import HealthResponse, ReadinessResponse
from app.services.health_service import HealthService

router = APIRouter()

DB_STATUS_TO_HTTP = {
    "connected": status.HTTP_200_OK,
    "unavailable": status.HTTP_503_SERVICE_UNAVAILABLE,
}

DB_STATUS_TO_APP_STATUS = {
    "connected": "ok",
    "unavailable": "degraded",
}


def get_health_service(
    db: Session = Depends(get_db), settings: Settings = Depends(get_settings)
) -> HealthService:
    """Build a HealthService bound to the current request's DB engine."""
    bind = db.get_bind()
    return HealthService(engine=cast(Engine, bind))


@router.get(
    "",
    response_model=HealthResponse,
    summary="Application and dependency health",
    responses={
        200: {"description": "Healthy"},
        503: {"description": "One or more dependencies are unavailable"},
    },
)
def read_health(health_svc: HealthService = Depends(get_health_service)) -> Response:
    """Report application status and database connectivity.

    The response intentionally excludes credentials, connection strings and
    internal infrastructure details. A degraded database yields 503 so that
    orchestrators can act on it.
    """
    result = health_svc.check()
    db_status = result["database"]
    settings = get_settings()
    health = HealthResponse(
        status=DB_STATUS_TO_APP_STATUS[db_status],  # type: ignore[arg-type]
        application=settings.app_name,
        version=settings.app_version,
        environment=settings.app_env,
        database=db_status,
    )
    return JSONResponse(
        status_code=DB_STATUS_TO_HTTP[db_status],
        content=health.model_dump(mode="json"),
    )


@router.get(
    "/live",
    response_model=ReadinessResponse,
    summary="Liveness probe (in-process, no dependencies)",
)
def read_liveness() -> ReadinessResponse:
    """Liveness: the API process itself can serve requests."""
    settings = get_settings()
    return ReadinessResponse(status="ready", version=settings.app_version)


@router.get(
    "/ready",
    response_model=ReadinessResponse,
    summary="Readiness probe (dependencies reachable)",
    responses={200: {"description": "Ready"}, 503: {"description": "Database unreachable"}},
)
def read_readiness(
    settings: Settings = Depends(get_settings),
    health_svc: HealthService = Depends(get_health_service),
) -> ReadinessResponse | Response:
    """Readiness: all application dependencies are reachable."""
    result = health_svc.check()
    if result["database"] != "connected":
        return Response(status_code=status.HTTP_503_SERVICE_UNAVAILABLE)
    return ReadinessResponse(status="ready", version=settings.app_version)


__all__ = ["router", "get_health_service"]
