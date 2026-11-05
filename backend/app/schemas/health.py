"""Pydantic schemas for the health endpoints.

SECURITY: response fields are whitelisted. Nothing in these models leaks
database credentials, connection strings, file paths, or environment values.
"""

from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, Field

HealthStatus = Literal["ok", "degraded"]
DatabaseStatus = Literal["connected", "unavailable"]


class HealthResponse(BaseModel):
    """Response body of `GET /api/v1/health`."""

    status: HealthStatus
    application: str
    version: str
    environment: str
    database: DatabaseStatus
    timestamp: datetime = Field(default_factory=lambda: datetime.now(tz=UTC))


class ReadinessResponse(BaseModel):
    """Response body of `GET /api/v1/health/ready` and liveness data."""

    status: Literal["ready", "not_ready"]
    version: str
