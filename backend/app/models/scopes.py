"""Authorized scope model for domain/asset authorization."""

from datetime import datetime, timezone

from sqlalchemy import Integer, String, Text, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Scope(Base):
    """Authorized scope for asset authorization."""

    __tablename__ = "scopes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    domain_pattern: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    organization = relationship("Organization", back_populates="scopes")

    def __repr__(self) -> str:
        return f"<Scope name={self.name!r} domain={self.domain_pattern!r}>"


# Index for domain pattern matching
__table_args__ = (
    Index("ix_scopes_domain_pattern", "domain_pattern", postgresql_ops={"domain_pattern": "text_pattern_ops"}),
    Index("ix_scopes_org_active", "organization_id", "is_active"),
)