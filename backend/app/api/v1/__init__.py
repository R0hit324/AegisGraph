"""API v1 package. All versioned routes live under the /api/v1 prefix."""

from fastapi import APIRouter

from app.api.routes import health

api_router = APIRouter()
api_router.include_router(health.router, prefix="/health", tags=["health"])

__all__ = ["api_router"]
