"""Tests: database session lifecycle and ORM behavior."""

from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.database.base import utcnow
from app.database.session import check_database_connection
from app.models.metadata import AppMetadata


def test_session_can_write_and_read_records(db_session) -> None:  # type: ignore[no-untyped-def]
    record = AppMetadata(key="schema_initialized", value="0001_initial_infrastructure")
    db_session.add(record)
    db_session.commit()

    fetched = db_session.scalar(select(AppMetadata).where(AppMetadata.key == "schema_initialized"))
    assert fetched is not None
    assert fetched.value == "0001_initial_infrastructure"
    assert fetched.created_at <= fetched.updated_at <= utcnow()


def test_unique_key_constraint_enforced(db_session) -> None:  # type: ignore[no-untyped-msg]
    db_session.add(AppMetadata(key="duplicate_test", value="first"))
    db_session.commit()
    db_session.add(AppMetadata(key="duplicate_test", value="second"))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_rollback_discards_uncommitted_writes(db_session) -> None:  # type: ignore[no-untyped-def]
    db_session.add(AppMetadata(key="never_committed", value="value"))
    db_session.rollback()
    assert (
        db_session.scalar(select(AppMetadata).where(AppMetadata.key == "never_committed")) is None
    )


def test_connection_health_check_passes(db_session) -> None:  # type: ignore[no-untyped-def]
    from app.database.session import get_engine

    assert check_database_connection(get_engine()) is True


def test_metadata_records_survive_engine_recycle(db_session) -> None:  # type: ignore[no-untyped-def]
    """Records persist across engine dispose/reopen (SQLite per-test file)."""
    db_session.add(AppMetadata(key="persistence_probe", value="before-restart"))
    db_session.commit()

    from app.database.base import Base
    from app.database.session import dispose_engine, get_engine, get_session_factory

    dispose_engine()
    engine = get_engine()  # same database URL -> same file
    Base.metadata.create_all(engine)
    session = get_session_factory()()
    try:
        fetched = session.scalar(select(AppMetadata).where(AppMetadata.key == "persistence_probe"))
        assert fetched is not None
        assert fetched.value == "before-restart"
    finally:
        session.close()
