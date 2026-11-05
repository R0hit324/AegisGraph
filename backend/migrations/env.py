"""Alembic environment.

The database URL comes exclusively from the DATABASE_URL environment variable.
Credentials never appear in alembic.ini or in tracked files.
"""

from __future__ import annotations

import os
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import create_engine, pool

# Make `backend/` importable so `app.*` resolves regardless of CWD.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from alembic import context  # noqa: E402

from app.database.base import Base  # noqa: E402

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _database_url() -> str:
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        raise RuntimeError(
            "DATABASE_URL is not set. Export it (e.g. from .env) before running migrations."
        )
    if not url.startswith("postgresql+psycopg://"):
        raise RuntimeError(
            "AegisGraph migrations run against PostgreSQL only"
            " ('postgresql+psycopg://…', not sqlite)."
        )
    return url


def run_migrations_offline() -> None:
    """Emit SQL to stdout without connecting ('offline' mode)."""
    context.configure(
        url=_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Connect and run migrations against a live database."""
    connectable = create_engine(_database_url(), poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
