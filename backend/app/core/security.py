"""Core security utilities for authentication and scope validation.

Provides bcrypt-based password hashing, JWT token creation/verification,
user authentication helpers, and domain pattern validation for scope
enforcement. All operations are designed to be constant-time where possible
and never expose secrets in logs or responses.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import re
import time
from collections import deque
from typing import Any, Callable, Optional

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import bcrypt
from jose import jwt, JWTError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.database.session import get_session_factory
from app.models.users import User
from app.models.user_organizations import UserOrganization

# Role hierarchy: a member satisfies a required role when their own role is
# at or above the required level. Owner implies admin implies analyst/viewer.
ROLE_HIERARCHY: dict[str, int] = {
    "viewer": 1,
    "analyst": 2,
    "admin": 3,
    "owner": 4,
}

# Token configuration
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 30

oauth2_scheme = HTTPBearer(auto_error=False, bearerFormat="JWT")

# The HttpOnly session cookie set by /auth endpoints.
SESSION_COOKIE_NAME = "aegis_access_token"

# The secret key comes from application settings
# It should be set via APP_SECRET_KEY environment variable
SECRET_KEY: str = ""
# SECRET_KEY will be overridden by the app factory at startup


def set_secret_key(key: str) -> None:
    """Set the secret key for token signing (called from app factory)."""
    global SECRET_KEY
    SECRET_KEY = key


def hash_password(plain_text: str) -> str:
    """Hash a plaintext password using bcrypt.

    Args:
        plain_text: The password to hash.

    Returns:
        The bcrypt-hashed password string.
    """
    # bcrypt.gensalt() uses default work factor (12)
    hashed = bcrypt.hashpw(plain_text.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    return hashed


def verify_password(plain_text: str, hashed: str) -> bool:
    """Verify a plaintext password against a bcrypt hash.

    Args:
        plain_text: The password to verify.
        hashed: The bcrypt hash to verify against.

    Returns:
        True if the password matches, False otherwise.
    """
    try:
        return bcrypt.checkpw(plain_text.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a JWT access token.

    Args:
        data: The payload data to embed in the token.
        expires_delta: Optional timedelta for token expiration.

    Returns:
        Encoded JWT token string.
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire, "iat": int(time.time())})

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Optional[dict]:
    """Decode and verify a JWT token.

    Args:
        token: The JWT token string (may be prefixed with "Bearer ").

    Returns:
        The decoded payload dict if valid, None otherwise.
    """
    try:
        # Strip "Bearer " prefix if present
        if token.startswith("Bearer "):
            token = token[7:]

        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except (JWTError, Exception):
        return None


# ---------------------------------------------------------------------------
# Simple per-process sliding-window rate limiter for credential endpoints.
#
# Sufficient for a single process; a reverse proxy or shared store (e.g.
# Redis) is required for multi-instance deployments (tracked in Report A).
# ---------------------------------------------------------------------------
_RATE_LIMIT_BUCKETS: dict[tuple[str, str], deque] = {}


def rate_limit(max_requests: int = 10, window_seconds: int = 60) -> Callable[..., Any]:
    """Return a FastAPI dependency enforcing a sliding-window rate limit.

    The limit applies per (client IP, request path). Exceeding it yields
    HTTP 429 with a Retry-After header instead of processing the request.
    """

    async def dependency(request: Request) -> None:
        client_ip = get_client_ip(request) or "unknown"
        key = (client_ip, request.url.path)
        now = time.time()
        bucket = _RATE_LIMIT_BUCKETS.get(key)
        if bucket is None:
            bucket = deque()
            _RATE_LIMIT_BUCKETS[key] = bucket
        while bucket and now - bucket[0] > window_seconds:
            bucket.popleft()
        if len(bucket) >= max_requests:
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please try again later.",
                headers={"Retry-After": str(window_seconds)},
            )
        bucket.append(now)

    return dependency


def get_client_ip(request) -> str | None:
    """Extract the client IP address from a request.

    Handles forwarded headers properly (but does not trust them blindly).
    """
    # Check X-Forwarded-For first (if behind a proxy)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Take the leftmost IP (the original client)
        ip = forwarded_for.split(",")[0].strip()
        if ip:
            return ip

    # Fall back to direct connection IP
    return request.client.host if request.client else None


def get_user_agent(request) -> str | None:
    """Extract the user agent string from a request."""
    return request.headers.get("User-Agent")


async def authenticate_user(username: str, password: str, db: Session) -> User | None:
    """Authenticate a user by username and password.

    Args:
        username: The username to authenticate.
        password: The plaintext password to verify.
        db: The database session.

    Returns:
        The User object if authentication succeeds, None otherwise.
    """
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return None

    if not verify_password(password, user.hashed_password):
        return None

    if not user.is_active:
        return None

    return user


def validate_domain_pattern(domain: str) -> bool:
    """Validate a domain pattern for scope authorization.

    Checks that the domain is a valid hostname or subdomain pattern.
    Supports:
    - Exact domain matches (e.g., "example.com")
    - Subdomain wildcards (e.g., "*.example.com")
    - Rejects invalid characters, IP addresses, loopback, and reserved ranges

    Args:
        domain: The domain pattern to validate.

    Returns:
        True if the domain pattern is valid, False otherwise.
    """
    if not domain or not domain.strip():
        return False

    domain = domain.strip()

    # Reject IP addresses (IPv4 and IPv6)
    ipv4_pattern = r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$"
    ipv6_pattern = r"^\[?[0-9a-fA-F:]+\]?$"

    # Check if it looks like an IP
    if re.match(ipv4_pattern, domain):
        # Further reject private, loopback, link-local, reserved
        parts = domain.split(".")
        if len(parts) == 4:
            try:
                a, b, c, d = int(parts[0]), int(parts[1]), int(parts[2]), int(parts[3])
                # Loopback
                if a == 127:
                    return False
                # Private ranges
                if a == 10:
                    return False
                if a == 172 and 16 <= b <= 31:
                    return False
                if a == 192 and b == 168:
                    return False
                # Link-local
                if a == 169 and b == 254:
                    return False
                # Reserved
                if a == 0:
                    return False
                if a >= 224:
                    return False
            except ValueError:
                pass
        return False

    if re.match(ipv6_pattern, domain):
        return False

    # Reject containing paths, query strings, or fragments
    if "?" in domain or "#" in domain or " " in domain:
        return False

    # Require at least one dot: single-label hosts (e.g. "localhost",
    # "intranet") resolve only via local DNS/hosts files and must never be
    # treated as authorized scan targets.
    pattern_part = domain[2:] if domain.startswith("*.") else domain
    if "." not in pattern_part:
        return False

    # Reject IANA special-use / reserved TLDs (RFC 6761/6762):
    # localhost, local (mDNS), invalid, test, example.
    final_label = pattern_part.rstrip(".").rsplit(".", 1)[-1].lower()
    if final_label in {"localhost", "local", "invalid", "test", "example"}:
        return False

    # Valid domain pattern: alphanumeric, dots, hyphens, and optional leading wildcard
    # Pattern: optional "*." followed by valid domain labels
    label_pattern = r"^(?:\*\.)?[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*$"

    if re.match(label_pattern, domain):
        return True

    return False


async def get_current_token(
    request: Request,
    bearer_credentials: Optional[HTTPAuthorizationCredentials] = Depends(oauth2_scheme),
) -> str:
    """Resolve the JWT from the HttpOnly session cookie or Authorization header.

    Priority: Authorization header first, then the `aegis_access_token`
    cookie (whose value is `Bearer <jwt>`). Raises 401 when neither is
    present so protected routes reject anonymous requests.
    """
    if bearer_credentials is not None:
        return bearer_credentials.credentials

    raw_cookie = request.cookies.get(SESSION_COOKIE_NAME)
    if raw_cookie:
        # Cookie stores "Bearer <jwt>" — strip the scheme prefix.
        parts = raw_cookie.split(" ", 1)
        if len(parts) == 2 and parts[0].lower() == "bearer":
            return parts[1]
        return raw_cookie

    raise HTTPException(
        status_code=401,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(get_current_token)
) -> User:
    """Dependency that returns the current authenticated user.

    Extracts the token from the HttpOnly cookie (or Authorization header),
    decodes the JWT, and returns the corresponding User.

    Raises:
        HTTPException: 401 if the token is invalid or the user is not found.
    """
    # Decode the token
    payload = decode_token(token)
    if payload is None:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=401,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id: int = payload.get("user_id")
    if user_id is None:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=401,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Look up the user
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=401,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=400,
            detail="User account is disabled",
        )

    return user


def has_role(user: User, role_name: str) -> bool:
    """Check if a user has a specific role.

    This is a simplified role check. In production, this would query
    the user's roles from the database.
    """
    # Superusers have all roles
    if user.is_superuser:
        return True

    # Check role-based permissions
    # This is a placeholder - full implementation uses user_organizations.roles
    return False


def has_organization_role(
    user: User, organization_id: int, role_name: str, db: Session | None = None
) -> bool:
    """Check if a user has a role at least as strong as `role_name` in an org.

    Enforced from the `user_organizations` table using the role hierarchy
    (owner > admin > analyst > viewer). Superusers hold access everywhere.

    Args:
        user: The user to check.
        organization_id: The organization ID.
        role_name: Minimum required role (owner/admin/analyst/viewer).
        db: Optional existing session to reuse; a short-lived session is
            created when omitted.

    Returns:
        True if the user has the required role level in the organization.
    """
    # Superusers have all roles in all organizations
    if user.is_superuser:
        return True

    required_level = ROLE_HIERARCHY.get(role_name.lower())
    if required_level is None:
        return False

    owns_session = db is None
    session = db if db is not None else get_session_factory()()
    try:
        membership = session.execute(
            select(UserOrganization).where(
                UserOrganization.user_id == user.id,
                UserOrganization.organization_id == organization_id,
            )
        ).scalar_one_or_none()
        if membership is None or not membership.role:
            return False
        return ROLE_HIERARCHY.get(membership.role.lower(), 0) >= required_level
    finally:
        if owns_session:
            session.close()