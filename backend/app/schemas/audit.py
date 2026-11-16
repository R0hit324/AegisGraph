"""Pydantic schemas for audit log data."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class AuditLogCreate(BaseModel):
    """Schema for creating an audit log entry."""

    action: str = Field(..., description="The action that was performed")
    outcome: str = Field(..., description="Whether the outcome was success or failure")
    details: Optional[str] = Field(
        None, max_length=1000, description="Additional details about the action"
    )
    ip_address: Optional[str] = Field(
        None, max_length=45, description="Client IP address"
    )
    user_agent: Optional[str] = Field(
        None, max_length=500, description="User agent string"
    )


class AuditLogEntry(BaseModel):
    """Schema for audit log entry response.

    Deliberately exposes NO sensitive fields: no IP addresses, user agents,
    tokens or password material. Name fields are resolved through SQLAlchemy
    relationships at serialization time.
    """

    id: int
    action: str
    outcome: str
    created_at: datetime
    actor_username: Optional[str] = None
    organization_name: Optional[str] = None

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, entry) -> "AuditLogEntry":
        actor_name = None
        org_name = None
        if hasattr(entry, "actor") and entry.actor:
            actor_name = entry.actor.username
        if hasattr(entry, "organization") and entry.organization:
            org_name = entry.organization.name
        return cls(
            id=entry.id,
            action=entry.action,
            outcome=entry.outcome,
            created_at=entry.created_at,
            actor_username=actor_name,
            organization_name=org_name,
        )


class AuditLogSummary(BaseModel):
    """Schema for aggregated audit log summaries."""

    total_actions: int
    success_count: int
    failure_count: int
    by_action: dict[str, int]
    by_outcome: dict[str, int]