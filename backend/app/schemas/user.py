"""Pydantic schemas for user authentication and profile data."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    """Schema for user registration."""

    username: str = Field(..., min_length=3, max_length=100, description="User's unique username")
    email: Optional[str] = Field(
        None,
        min_length=5,
        max_length=254,
        description="User's email address (optional)",
    )
    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="User's password (minimum 8 characters)",
    )


class UserLogin(BaseModel):
    """Schema for user login."""

    username: str = Field(..., min_length=3, max_length=100, description="User's username")
    password: str = Field(..., min_length=1, max_length=128, description="User's password")


class UserResponse(BaseModel):
    """Schema for user profile response."""

    id: int
    username: str
    email: Optional[str] = None
    is_active: bool
    is_superuser: bool
    is_verified: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, user) -> "UserResponse":
        return cls(
            id=user.id,
            username=user.username,
            email=user.email,
            is_active=user.is_active,
            is_superuser=user.is_superuser,
            is_verified=user.is_verified,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )


class Token(BaseModel):
    """Schema for authentication token response."""

    access_token: str
    token_type: Literal["bearer"] = "bearer"


class TokenData(BaseModel):
    """Schema for token data extracted from JWT."""

    username: Optional[str] = None
    user_id: Optional[int] = None


class UserUpdate(BaseModel):
    """Schema for user profile updates."""

    email: Optional[str] = Field(None, min_length=5, max_length=254)
    current_password: Optional[str] = Field(None, min_length=1, max_length=128)
    new_password: Optional[str] = Field(None, min_length=8, max_length=128)


class UserSummary(BaseModel):
    """Schema for user summary (used in organization contexts)."""

    id: int
    username: str
    role: str
    organization_id: int

    model_config = {"from_attributes": True}