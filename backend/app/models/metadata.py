"""AppMetadata — a minimal key/value infrastructure table.

WHY THIS EXISTS PHASE 1 (and nothing more):
- The application must be able to distinguish "this database has been
  initialized" from "an empty/new database" — safe for upgrade workflows.
- It gives the backup/restore scripts and tests real records to write and read.

It is NOT a premature domain schema and will not grow into one.
"""

from sqlalchemy import String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class AppMetadata(Base):
    """Single-record-per-key metadata storage (key/value, unique)."""

    __tablename__ = "app_metadata"
    __table_args__ = (UniqueConstraint("key", name="uq_app_metadata_key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<AppMetadata key={self.key!r}>"
