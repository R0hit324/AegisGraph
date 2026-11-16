"""SQLAlchemy ORM models.

Importing this package registers every model with `Base.metadata`, so that
`Base.metadata.create_all()` (test harness / scripts) and the Alembic mapper
config see the complete schema, and every string-based `relationship()`
argument resolves.
"""

from app.models.metadata import AppMetadata
from app.models.users import User
from app.models.organizations import Organization
from app.models.user_organizations import UserOrganization
from app.models.roles import Permission, Role
from app.models.scopes import Scope
from app.models.audit_logs import AuditLog

__all__ = [
    "AppMetadata",
    "User",
    "Organization",
    "UserOrganization",
    "Permission",
    "Role",
    "Scope",
    "AuditLog",
]
