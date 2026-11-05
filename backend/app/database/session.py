"""Database engine and session lifecycle.

Clean lifecycle rules (Phase 1):
- The engine is created lazily, once, from validated settings.
- `get_db` is the FastAPI dependency used by routes; it always closes the
  session, and rolls back on unexpected failure before closing.
- SQLAlchemy error details are never propagated to clients — handlers in
  `app.core.exceptions` convert them to safe 503 responses.
"""

from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from app.config.settings import get_settings

_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None


def _create_engine() -> Engine:
    settings = get_settings()
    if settings.database_url.startswith("sqlite"):
        # SQLite (test harness): allow cross-thread access, no shared pool.
        return create_engine(
            settings.database_url,
            connect_args={"check_same_thread": False},
        )
    return create_engine(
        settings.database_url,
        pool_pre_ping=settings.db_pool_pre_ping,
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
    )


def get_engine() -> Engine:
    """Return the process-wide engine, creating it on first use."""
    global _engine
    if _engine is None:
        _engine = _create_engine()
    return _engine


def get_session_factory() -> sessionmaker[Session]:
    """Return the process-wide session factory."""
    global _session_factory
    if _session_factory is None:
        _session_factory = sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)
    return _session_factory


def get_db() -> Iterator[Session]:
    """FastAPI dependency: yield a session and guarantee its closure."""
    session = get_session_factory()()
    try:
        yield session
        # Successful request path: nothing to commit here — service layers own
        # their transactions. Closing releases the connection for reuse.
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def check_database_connection(engine: Engine | None = None) -> bool:
    """Execute a trivial query to prove the database is really reachable."""
    target_engine = engine or get_engine()
    try:
        with target_engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except SQLAlchemyError:
        return False


def dispose_engine() -> None:
    """Dispose engine + factory (used on shutdown and between tests)."""
    global _engine, _session_factory
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _session_factory = None
