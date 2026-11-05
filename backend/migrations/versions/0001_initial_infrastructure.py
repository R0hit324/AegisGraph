"""Initial infrastructure revision: minimal metadata table.

This migration intentionally creates ONLY infrastructure required by Phase 1:

- `app_metadata`: single-row-per-key application metadata used to record that
  the database schema has been initialized. It lets operators and tests
  distinguish a migrated database from an empty one, and gives the backup /
  restore scripts real records to verify against.

The full domain schema (organizations, scopes, assets, findings, …) is added
in later phases as dedicated migrations.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001_initial_infrastructure"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create the Phase 1 infrastructure table."""
    op.create_table(
        "app_metadata",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column("value", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_app_metadata_key", "app_metadata", ["key"], unique=True)


def downgrade() -> None:
    """Remove the Phase 1 infrastructure table."""
    op.drop_index("ix_app_metadata_key", table_name="app_metadata")
    op.drop_table("app_metadata")
