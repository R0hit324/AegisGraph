"""AegisGraph backend — application factory and entry point.

Run (local dev):
    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from typing import Any, cast

from fastapi import Depends, FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError

from app.api.v1 import api_router
from app.config.settings import Settings, get_settings
from app.core.exceptions import (
    AppError,
    app_error_handler,
    database_error_handler,
    unexpected_error_handler,
    validation_error_handler,
)
from app.core.logging import configure_logging, get_logger
from app.database import dispose_engine

logger = get_logger("startup")


def _configure_security_middleware(app: FastAPI, settings: Settings) -> None:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=False,  # Phase 1 API is cookie-free; revisit with auth.
        allow_methods=["GET"],
        allow_headers=["application/json"],
        max_age=600,
    )


def _starlette_handler(
    handler: Callable[[Request, Any], Any],
) -> Callable[[Request, Exception], Any]:
    """Adapt a narrowed exception handler to Starlette's registry protocol.

    Starlette only ever invokes a handler with the exception type it was
    registered for, so the narrower static signature is safe; this cast is what
    `add_exception_handler`'s strict protocol expects.
    """
    return cast(Callable[[Request, Exception], Any], handler)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    logger.info(
        "application_starting",
        extra={"version": settings.app_version, "mode": settings.app_env},
    )
    yield
    logger.info("application_stopped")
    dispose_engine()


def create_app() -> FastAPI:
    """Build and return the fully configured FastAPI application."""
    settings = get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(
        title=f"{settings.app_name} API",
        description=(
            "AegisGraph — Unified Attack Surface Discovery & Website Security "
            "Assessment Platform. Phase 1 foundation: health and readiness only."
        ),
        version=settings.app_version,
        lifespan=lifespan,
        # Docs stay reachable; the app is localhost-only in Phase 1.
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    _configure_security_middleware(app, settings)

    # ------------------------------------------------------- error handlers
    # See `_starlette_handler` — Starlette only invokes a handler for its
    # registered exception type, so the narrowed signatures are safe.
    app.add_exception_handler(AppError, _starlette_handler(app_error_handler))
    app.add_exception_handler(RequestValidationError, _starlette_handler(validation_error_handler))
    app.add_exception_handler(SQLAlchemyError, _starlette_handler(database_error_handler))
    # A catch-all keeps stack traces away from clients in every path.
    app.add_exception_handler(Exception, _starlette_handler(unexpected_error_handler))

    # ------------------------------------------------------------ API router
    app.include_router(api_router, prefix=settings.api_v1_prefix)

    # ------------------------------------------------------------ root info
    @app.get("/", include_in_schema=False)
    def root(settings: Settings = Depends(get_settings)) -> dict[str, str]:
        return {
            "application": settings.app_name,
            "version": settings.app_version,
            "status": "running",
            "docs": "/docs",
            "health": f"{settings.api_v1_prefix}/health",
        }

    # Minimal hardening header on every response.
    @app.middleware("http")
    async def _add_nosniff_header(
        request: Request,
        call_next: Callable[[Request], Any],
    ) -> Response:
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    return app


app = create_app()
