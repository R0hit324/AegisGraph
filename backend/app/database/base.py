"""Base declarative class and common model utilities."""

from datetime import UTC, datetime

from sqlalchemy import DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow() -> datetime:
    """UTC timestamp used for `created_at`/`updated_at` defaults."""
    return datetime.now(tz=UTC)


class Base(DeclarativeBase):
    """Declarative base for every AegisGraph ORM model."""

    # Every table records row times in UTC.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )
