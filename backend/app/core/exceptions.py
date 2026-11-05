"""Centralized exception handling for the API.

Error responses follow a stable, informative-but-safe envelope:

    {"error": {"code": "<machine_code>", "message": "<safe human message>"}}

Stack traces, SQL statements, credentials, and internal paths are never sent to
clients — they are logged internally instead.
"""

from __future__ import annotations

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.core.logging import get_logger

logger = get_logger("errors")


class AppError(Exception):
    """Base class for expected application errors surfaced to clients."""

    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    code: str = "internal_error"
    message: str = "An unexpected error occurred."

    def __init__(self, message: str | None = None, *, code: str | None = None) -> None:
        super().__init__(message or self.message)
        if message:
            self.message = message
        if code:
            self.code = code


def _error_payload(code: str, message: str) -> dict[str, object]:
    return {"error": {"code": code, "message": message}}


async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    logger.info("app_error", extra={"code": exc.code})
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_payload(exc.code, exc.message),
    )


async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    # Standard 422 handling: return sanitized validation details (no internals).
    errors = [
        {
            "loc": " -> ".join(str(loc) for loc in err.get("loc", ())),
            "msg": err.get("msg", "invalid value"),
        }
        for err in exc.errors()
    ]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=_error_payload("validation_error", "Request validation failed.")
        | {"details": errors},
    )


async def database_error_handler(_: Request, exc: SQLAlchemyError) -> JSONResponse:
    # Full detail stays in the log; the client receives a generic message.
    logger.exception("database_error")
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content=_error_payload(
            "database_unavailable",
            "The database is currently unavailable. Please try again later.",
        ),
    )


async def unexpected_error_handler(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("unhandled_exception", extra={"exc_type": type(exc).__name__})
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=_error_payload("internal_error", "An unexpected error occurred."),
    )


__all__ = [
    "AppError",
    "app_error_handler",
    "validation_error_handler",
    "database_error_handler",
    "unexpected_error_handler",
]
