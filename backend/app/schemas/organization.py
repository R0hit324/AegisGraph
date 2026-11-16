"""Pydantic schemas for organization and scope management."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional, Literal

from pydantic import BaseModel, Field


class OrganizationCreate(BaseModel):
    """Schema for organization creation."""

    name: str = Field(..., min_length=3, max_length=200, description="Organization name")
    description: Optional[str] = Field(
        None, max_length=500, description="Organization description"
    )


class OrganizationResponse(BaseModel):
    """Schema for organization response."""

    id: int
    name: str
    description: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, org) -> "OrganizationResponse":
        return cls(
            id=org.id,
            name=org.name,
            description=org.description,
            is_active=org.is_active,
            created_at=org.created_at,
            updated_at=org.updated_at,
        )


class OrganizationMemberCreate(BaseModel):
    """Schema for adding a user to an organization."""

    user_id: int = Field(..., description="User ID to add")
    role: str = Field(
        default="viewer",
        description="Role assignment (owner, admin, analyst, viewer)",
    )


class OrganizationMemberResponse(BaseModel):
    """Schema for organization member response."""

    user_id: int
    username: str
    role: str
    joined_at: datetime

    model_config = {"from_attributes": True}


class ScopeCreate(BaseModel):
    """Schema for authorized scope creation."""

    name: str = Field(
        ..., min_length=3, max_length=200, description="Scope display name"
    )
    description: Optional[str] = Field(
        None, max_length=500, description="Scope description"
    )
    domain_pattern: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Domain pattern (e.g., example.com, *.example.com)",
    )
    is_active: bool = Field(default=True, description="Whether the scope is active")


class ScopeResponse(BaseModel):
    """Schema for scope response."""

    id: int
    name: str
    description: Optional[str] = None
    domain_pattern: str
    is_active: bool
    organization_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, scope) -> "ScopeResponse":
        return cls(
            id=scope.id,
            name=scope.name,
            description=scope.description,
            domain_pattern=scope.domain_pattern,
            is_active=scope.is_active,
            organization_id=scope.organization_id,
            created_at=scope.created_at,
            updated_at=scope.updated_at,
        )


class ScopeUpdate(BaseModel):
    """Schema for scope updates."""

    name: Optional[str] = Field(None, min_length=3, max_length=200)
    description: Optional[str] = Field(None, max_length=500)
    domain_pattern: Optional[str] = Field(None, min_length=1, max_length=255)
    is_active: Optional[bool] = Field(None, description="Whether the scope is active")


class AuditLogEntry(BaseModel):
    """Schema for audit log entry response."""

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


class RoleResponse(BaseModel):
    """Schema for role response."""

    id: int
    name: str
    description: Optional[str] = None
    is_system: bool

    model_config = {"from_attributes": True}


class PermissionResponse(BaseModel):
    """Schema for permission response."""

    id: int
    name: str
    code: str
    description: Optional[str] = None
    is_system: bool

    model_config = {"from_attributes": True}