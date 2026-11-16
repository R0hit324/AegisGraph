"""Authentication API routes (Phase 2).

Handles user registration, login, logout, password changes, and session
management. Uses bcrypt for password hashing and HttpOnly secure cookies
for session storage.
"""

from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm

from app.core.logging import get_logger
from app.core.security import (
    authenticate_user,
    create_access_token,
    get_client_ip,
    get_current_user,
    get_user_agent,
    rate_limit,
    verify_password,
    decode_token,
)
from app.database import get_db
from sqlalchemy.orm import Session
from app.models.users import User
from app.models.roles import Role
from app.schemas.user import UserCreate, UserLogin, UserResponse, Token, UserUpdate
from app.models.audit_logs import AuditLog

logger = get_logger("api.auth")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


router = APIRouter(prefix="/auth", tags=["auth"])


# Brute-force protection: 10 credential attempts per minute per client IP.
_login_rate_limit = rate_limit(max_requests=10, window_seconds=60)


@router.post(
    "/register",
    response_model=Token,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_login_rate_limit)],
)
async def register(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    request: Request = None,
) -> Token:
    """Register a new user account.

    Creates a new user with a bcrypt-hashed password. The user is created
    as a member of a default organization with the "viewer" role. A superuser
    must promote the account afterward.
    """
    from app.core.security import hash_password

    # Check if user already exists. A NULL email must never count as a
    # duplicate match (SQLAlchemy renders `email == None` as `IS NULL`),
    # so the email clause is only added when an email was provided.
    from sqlalchemy import or_

    duplicate_filters = [User.username == user_in.username]
    if user_in.email:
        duplicate_filters.append(User.email == user_in.email)
    existing = db.query(User).filter(or_(*duplicate_filters)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already registered",
        )

    # Hash password
    hashed_password = hash_password(user_in.password)

    # Create user
    db_user = User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=hashed_password,
        is_active=True,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # Create default organization for the user (founder)
    from app.models.organizations import Organization
    from app.models.user_organizations import UserOrganization

    org = Organization(name=f"{user_in.username}'s Organization")
    db.add(org)
    db.commit()
    db.refresh(org)

    membership = UserOrganization(
        user_id=db_user.id,
        organization_id=org.id,
        role="owner",
    )
    db.add(membership)
    db.commit()

    # Create access token
    access_token_expires = timedelta(minutes=60)
    access_token = create_access_token(
        data={"sub": db_user.username, "user_id": db_user.id},
        expires_delta=access_token_expires,
    )

    # Build response with cookie
    resp = JSONResponse(
        content={"access_token": access_token, "token_type": "bearer"},
        status_code=201,
    )
    resp.set_cookie(
        key="aegis_access_token",
        value=f"Bearer {access_token}",
        httponly=True,
        secure=False,  # Set to True in production with HTTPS
        samesite="lax",
        max_age=3600,
        path="/",
    )

    # Audit log
    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)

    audit = AuditLog(
        actor_id=db_user.id,
        action="user_register",
        outcome="success",
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(audit)
    db.commit()

    # Return the cookie-carrying response (not a bare Token model), so the
    # HttpOnly session cookie is actually sent to the client.
    return resp


@router.post(
    "/login",
    response_model=Token,
    dependencies=[Depends(_login_rate_limit)],
)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
    request: Request = None,
) -> Token:
    """Login with username and password.

    Authenticates the user and creates an access token. Sets an HttpOnly
    secure cookie for session management.
    """
    user = await authenticate_user(form_data.username, form_data.password, db)
    if not user:
        # Audit log for failed login
        ip_address = get_client_ip(request)
        user_agent = get_user_agent(request)

        audit = AuditLog(
            actor_id=None,
            action="user_login_failed",
            outcome="failure",
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(audit)
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create access token
    access_token_expires = timedelta(minutes=60)
    access_token = create_access_token(
        data={"sub": user.username, "user_id": user.id},
        expires_delta=access_token_expires,
    )

    # Build response with cookie
    resp = JSONResponse(
        content={"access_token": access_token, "token_type": "bearer"},
        status_code=200,
    )
    resp.set_cookie(
        key="aegis_access_token",
        value=f"Bearer {access_token}",
        httponly=True,
        secure=False,  # Set to True in production with HTTPS
        samesite="lax",
        max_age=3600,
        path="/",
    )

    # Audit log for successful login
    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)

    audit = AuditLog(
        actor_id=user.id,
        action="user_login",
        outcome="success",
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(audit)
    db.commit()

    # Return the cookie-carrying response (not a bare Token model), so the
    # HttpOnly session cookie is actually sent to the client.
    return resp


@router.post("/logout")
async def logout(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
) -> JSONResponse:
    """Logout the current user.

    Revokes the session by clearing the HttpOnly cookie. Logs the
    revocation event.
    """
    # Build response with cookie cleared
    resp = JSONResponse(
        content={"detail": "Successfully logged out"},
        status_code=status.HTTP_200_OK,
    )
    resp.delete_cookie(
        key="aegis_access_token",
        httponly=True,
        secure=False,
        samesite="lax",
        path="/",
    )

    # Audit log for logout
    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)

    audit = AuditLog(
        actor_id=current_user.id,
        action="user_logout",
        outcome="success",
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(audit)
    db.commit()

    return resp


@router.post("/refresh")
async def refresh_token(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
) -> Token:
    """Refresh the access token.

    Creates a new access token for the authenticated user.
    """
    access_token_expires = timedelta(minutes=60)
    access_token = create_access_token(
        data={"sub": current_user.username, "user_id": current_user.id},
        expires_delta=access_token_expires,
    )

    # Build response with cookie
    resp = JSONResponse(
        content={"access_token": access_token, "token_type": "bearer"},
        status_code=200,
    )
    resp.set_cookie(
        key="aegis_access_token",
        value=f"Bearer {access_token}",
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=3600,
        path="/",
    )

    # Return the cookie-carrying response (not a bare Token model) so the
    # refreshed HttpOnly session cookie reaches the client.
    return resp


@router.get("/me", response_model=UserResponse)
async def read_current_user(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Get the current authenticated user's profile."""
    return UserResponse.model_validate(current_user)


@router.post("/change-password")
async def change_password(
    password_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
) -> dict:
    """Change the current user's password.

    Requires the current password and the new password.
    """
    from app.core.security import verify_password, hash_password

    # Verify current password
    if not verify_password(password_data["current_password"], current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    # Hash new password
    new_hashed = hash_password(password_data["new_password"])
    current_user.hashed_password = new_hashed
    db.add(current_user)
    db.commit()

    # Audit log for password change
    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)

    audit = AuditLog(
        actor_id=current_user.id,
        action="user_password_change",
        outcome="success",
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(audit)
    db.commit()

    return {"detail": "Password changed successfully"}