"""Health check service — the single place that probes backend dependencies."""

from __future__ import annotations

from typing import TypedDict

from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError

from app.core.logging import get_logger
from app.schemas.health import DatabaseStatus

logger = get_logger("health")


class HealthCheckResult(TypedDict):
    database: DatabaseStatus


class HealthService:
    """Probe application dependencies and report a coarse-grained status.

    The service never exposes *why* a dependency is down to API clients; the
    detailed cause is logged instead. That keeps error responses safe while
    still supporting operators via log inspection.
    """

    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    def check(self) -> HealthCheckResult:
        """Return the current dependency status."""
        return {"database": self._check_database()}

    def _check_database(self) -> DatabaseStatus:
        try:
            with self._engine.connect() as connection:
                connection.execute(text("SELECT 1"))
        except SQLAlchemyError as exc:
            logger.warning(
                "database_check_failed",
                extra={"exc_type": type(exc).__name__},
            )
            return "unavailable"
        return "connected"
