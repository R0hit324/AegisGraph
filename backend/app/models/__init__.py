"""SQLAlchemy ORM models.

Phase 1 deliberately contains only infrastructure models. The domain schema
(organizations, scopes, assets, findings, …) is designed in later phases.
"""

from app.models.metadata import AppMetadata

__all__ = ["AppMetadata"]
