"""Organization API routes (Phase 2).

Handles organization creation, membership management, and role assignments.
All operations are enforced server-side, not just frontend visibility.
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select

from app.database import get_db
from app.models.organizations import Organization
from app.models.user_organizations import UserOrganization
from app.models.users import User
from app.models.roles import Role
from app.models.scopes import Scope
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationResponse,
    OrganizationMemberCreate,
    OrganizationMemberResponse,
    ScopeCreate,
    ScopeResponse,
    ScopeUpdate,
    RoleResponse,
)
from app.schemas.audit import AuditLogCreate
from app.schemas.audit import AuditLogEntry
from app.core.security import (
    get_client_ip,
    get_user_agent,
    has_role,
    has_organization_role,
    get_current_user,
    validate_domain_pattern,
)
from app.models.audit_logs import AuditLog

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    org_in: OrganizationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
) -> OrganizationResponse:
    """Create a new organization.

    The authenticated user becomes the owner of the new organization.
    """
    # Check organization name is unique
    existing = db.scalar(
        select(Organization).where(Organization.name == org_in.name)
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization name already exists",
        )

    db_org = Organization(name=org_in.name, description=org_in.description)
    db.add(db_org)
    db.commit()
    db.refresh(db_org)

    # Add creator as owner
    membership = UserOrganization(
        user_id=current_user.id,
        organization_id=db_org.id,
        role="owner",
    )
    db.add(membership)
    db.commit()

    # Audit log
    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)

    audit = AuditLog(
        actor_id=current_user.id,
        action="org_create",
        outcome="success",
        organization_id=db_org.id,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(audit)
    db.commit()

    return OrganizationResponse.model_validate(db_org)


@router.get("", response_model=List[OrganizationResponse])
async def list_organizations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[OrganizationResponse]:
    """List organizations the user is a member of."""
    result = db.execute(
        select(UserOrganization)
        .filter(UserOrganization.user_id == current_user.id)
        .options(selectinload(UserOrganization.organization))
    )
    memberships = result.scalars().unique().all()

    orgs = []
    for membership in memberships:
        org = membership.organization
        if org and org.is_active:
            orgs.append(OrganizationResponse.model_validate(org))

    return orgs


@router.get("/{org_id}", response_model=OrganizationResponse)
async def get_organization(
    org_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OrganizationResponse:
    """Get organization details and its members."""
    result = db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    # Check user has access (owner, admin, analyst, or viewer)
    if not has_organization_role(current_user, org_id, "viewer", db=db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to access this organization",
        )

    # Load members
    members_result = db.execute(
        select(UserOrganization)
        .filter(UserOrganization.organization_id == org_id)
        .options(selectinload(UserOrganization.user))
    )
    members = members_result.scalars().unique().all()

    # Return with member info (basic version)
    return OrganizationResponse.model_validate(org)


@router.get("/{org_id}/members", response_model=List[OrganizationMemberResponse])
async def list_organization_members(
    org_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[OrganizationMemberResponse]:
    """List the members of an organization and their roles.

    Read access: any organization member (viewer and above). The roster
    exposes usernames and roles only — never emails, tokens or password
    material.
    """
    result = db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    if not has_organization_role(current_user, org_id, "viewer", db=db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to access this organization",
        )

    result = db.execute(
        select(UserOrganization)
        .filter(UserOrganization.organization_id == org_id)
        .options(selectinload(UserOrganization.user))
        .order_by(UserOrganization.joined_at)
    )
    memberships = result.scalars().unique().all()

    return [
        OrganizationMemberResponse(
            user_id=membership.user_id,
            username=membership.user.username,
            role=membership.role,
            joined_at=membership.joined_at,
        )
        for membership in memberships
    ]


@router.get("/{org_id}/audit", response_model=List[AuditLogEntry])
async def list_organization_audit(
    org_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[AuditLogEntry]:
    """List recent audit events recorded for this organization.

    Read access: organization admins and owners only. Entries carry the
    action, outcome, timestamp and acting username — never IP addresses,
    user agents, tokens or password material (the schema enforces this:
    unsafe fields are not serialized).
    """
    result = db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    if not has_organization_role(current_user, org_id, "admin", db=db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only organization admins can view the audit trail",
        )

    limited = min(max(limit, 1), 200)
    entries = db.execute(
        select(AuditLog)
        .filter(AuditLog.organization_id == org_id)
        .order_by(AuditLog.created_at.desc())
        .limit(limited)
    ).scalars().all()

    return [AuditLogEntry.model_validate(entry) for entry in entries]


@router.post(
    "/{org_id}/members", response_model=OrganizationMemberResponse, status_code=status.HTTP_201_CREATED
)
async def add_organization_member(
    org_id: int,
    member_in: OrganizationMemberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
) -> OrganizationMemberResponse:
    """Add a user to an organization with a specific role.

    The current user must be an owner or admin of the organization.
    """
    # Verify organization exists and user has access
    result = db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    # Check permissions: only owner or admin can add members
    if not has_organization_role(current_user, org_id, "admin", db=db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only organization admins can add members",
        )

    # Verify user exists
    user = db.execute(select(User).where(User.id == member_in.user_id))
    user = user.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Check if user is already a member
    existing = db.execute(
        select(UserOrganization).filter(
            UserOrganization.user_id == member_in.user_id,
            UserOrganization.organization_id == org_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this organization",
        )

    membership = UserOrganization(
        user_id=member_in.user_id,
        organization_id=org_id,
        role=member_in.role,
    )
    db.add(membership)
    db.commit()

    # Audit log
    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)

    audit = AuditLog(
        actor_id=current_user.id,
        action="org_member_add",
        outcome="success",
        organization_id=org_id,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(audit)
    db.commit()

    return OrganizationMemberResponse(
        user_id=membership.user_id,
        username=membership.user.username,
        role=membership.role,
        joined_at=membership.joined_at,
    )


@router.delete(
    "/{org_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_organization_member(
    org_id: int,
    user_id: int,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Remove a user from an organization.

    The current user must be an owner or admin. Cannot remove the last owner.
    """
    # Verify organization exists
    result = db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    # Check permissions
    if not has_organization_role(current_user, org_id, "admin", db=db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only organization admins can remove members",
        )

    # Remove the membership
    membership = db.execute(
        select(UserOrganization).filter(
            UserOrganization.user_id == user_id,
            UserOrganization.organization_id == org_id,
        )
    )
    membership = membership.scalar_one_or_none()

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a member of this organization",
        )

    # Prevent removing the last owner
    owner_memberships = db.execute(
        select(UserOrganization).filter(
            UserOrganization.organization_id == org_id,
            UserOrganization.role == "owner",
        )
    )
    owner_memberships = owner_memberships.scalars().unique().all()

    if membership.role == "owner" and len(owner_memberships) <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove the last owner of an organization",
        )

    db.delete(membership)
    db.commit()

    # Audit log
    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)

    audit = AuditLog(
        actor_id=current_user.id,
        action="org_member_remove",
        outcome="success",
        organization_id=org_id,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(audit)
    db.commit()


@router.post(
    "/{org_id}/scopes", response_model=ScopeResponse, status_code=status.HTTP_201_CREATED
)
async def create_scope(
    org_id: int,
    scope_in: ScopeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
) -> ScopeResponse:
    """Create an authorized scope (domain) for an organization.

    The current user must be an owner or admin of the organization.
    Every scope must belong to an organization.
    """
    # Verify organization exists and user has permission
    result = db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    # Check permissions: only owner or admin can create scopes
    if not has_organization_role(current_user, org_id, "admin", db=db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only organization admins can create scopes",
        )

    # Check scope name is unique within organization
    existing = db.execute(
        select(Scope).where(
            Scope.name == scope_in.name, Scope.organization_id == org_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Scope name already exists in this organization",
        )

    # Validate domain pattern
    if not validate_domain_pattern(scope_in.domain_pattern):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid domain pattern. Must be a valid domain or subdomain pattern.",
        )

    db_scope = Scope(
        name=scope_in.name,
        description=scope_in.description,
        domain_pattern=scope_in.domain_pattern,
        organization_id=org_id,
    )
    db.add(db_scope)
    db.commit()
    db.refresh(db_scope)

    # Audit log
    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)

    audit = AuditLog(
        actor_id=current_user.id,
        action="scope_create",
        outcome="success",
        organization_id=org_id,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(audit)
    db.commit()

    return ScopeResponse.model_validate(db_scope)


@router.get("/{org_id}/scopes", response_model=List[ScopeResponse])
async def list_scopes(
    org_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[ScopeResponse]:
    """List all authorized scopes for an organization.

    The current user must have access to the organization.
    """
    # Verify organization exists and user has access
    result = db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    if not has_organization_role(current_user, org_id, "viewer", db=db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to access organization scopes",
        )

    # List scopes
    result = db.execute(
        select(Scope).where(Scope.organization_id == org_id, Scope.is_active == True)
    )
    scopes = result.scalars().unique().all()

    return [ScopeResponse.model_validate(s) for s in scopes]


@router.put("/{org_id}/scopes/{scope_id}", response_model=ScopeResponse)
async def update_scope(
    org_id: int,
    scope_id: int,
    scope_in: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
) -> ScopeResponse:
    """Update an authorized scope.

    The current user must be an owner or admin of the organization.
    """
    # Verify organization exists and user has permission
    result = db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    if not has_organization_role(current_user, org_id, "admin", db=db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only organization admins can update scopes",
        )

    # Get the scope
    result = db.execute(
        select(Scope).where(Scope.id == scope_id, Scope.organization_id == org_id)
    )
    scope = result.scalar_one_or_none()

    if not scope:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scope not found in this organization",
        )

    # Validate domain pattern if being updated
    if "domain_pattern" in scope_in:
        if not validate_domain_pattern(scope_in["domain_pattern"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid domain pattern",
            )
        scope.domain_pattern = scope_in["domain_pattern"]

    if "name" in scope_in:
        scope.name = scope_in["name"]

    if "description" in scope_in:
        scope.description = scope_in["description"]

    if "is_active" in scope_in:
        scope.is_active = scope_in["is_active"]

    db.add(scope)
    db.commit()
    db.refresh(scope)

    # Audit log
    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)

    audit = AuditLog(
        actor_id=current_user.id,
        action="scope_update",
        outcome="success",
        organization_id=org_id,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(audit)
    db.commit()

    return ScopeResponse.model_validate(scope)


@router.delete(
    "/{org_id}/scopes/{scope_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_scope(
    org_id: int,
    scope_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
) -> None:
    """Delete (deactivate) an authorized scope.

    The current user must be an owner or admin of the organization.
    Scopes are soft-deactivated (is_active=False) rather than hard-deleted.
    """
    # Verify organization exists and user has permission
    result = db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    if not has_organization_role(current_user, org_id, "admin", db=db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only organization admins can delete scopes",
        )

    # Get the scope
    result = db.execute(
        select(Scope).where(
            Scope.id == scope_id, Scope.organization_id == org_id
        )
    )
    scope = result.scalar_one_or_none()

    if not scope:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scope not found in this organization",
        )

    # Soft-deactivate instead of hard-delete
    scope.is_active = False
    db.add(scope)
    db.commit()

    # Audit log
    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)

    audit = AuditLog(
        actor_id=current_user.id,
        action="scope_delete",
        outcome="success",
        organization_id=org_id,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(audit)
    db.commit()


@router.post(
    "/{org_id}/roles/assign",
    response_model=RoleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def assign_role_to_user(
    org_id: int,
    user_id: int,
    role_name: str,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RoleResponse:
    """Assign a role to a user in an organization.

    The current user must be an owner or admin of the organization.
    """
    # Verify organization exists
    result = db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    # Check permissions
    if not has_organization_role(current_user, org_id, "admin", db=db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only organization admins can assign roles",
        )

    # Verify user exists
    user = db.execute(select(User).where(User.id == user_id))
    user = user.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Verify role exists
    role = db.execute(select(Role).where(Role.name == role_name))
    role = role.scalar_one_or_none()

    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found",
        )

    # Check if user already has this role in the organization
    existing = db.execute(
        select(UserOrganization).filter(
            UserOrganization.user_id == user_id,
            UserOrganization.organization_id == org_id,
        )
    )
    existing_membership = existing.scalar_one_or_none()

    if existing_membership:
        # Update existing role
        existing_membership.role = role_name
        db.add(existing_membership)
        db.commit()

        # Audit log
        ip_address = get_client_ip(request)
        user_agent = get_user_agent(request)

        audit = AuditLog(
            actor_id=current_user.id,
            action="role_assign",
            outcome="success",
            organization_id=org_id,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(audit)
        db.commit()

        return RoleResponse.model_validate(role)
    else:
        # Create new membership with role
        membership = UserOrganization(
            user_id=user_id,
            organization_id=org_id,
            role=role_name,
        )
        db.add(membership)
        db.commit()

        # Audit log
        ip_address = get_client_ip(request)
        user_agent = get_user_agent(request)

        audit = AuditLog(
            actor_id=current_user.id,
            action="role_assign",
            outcome="success",
            organization_id=org_id,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(audit)
        db.commit()

        return RoleResponse.model_validate(role)


@router.post(
    "/{org_id}/permissions/grant",
    status_code=status.HTTP_201_CREATED,
)
async def grant_permission(
    org_id: int,
    permission_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Grant a permission to the organization.

    This is a simplified endpoint. In production, permissions would be
    managed through the roles table and assigned to users via those roles.
    """
    from app.models.roles import Role, Permission

    # Verify organization exists and user has permission
    result = db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    # Check permissions: only owner can grant organization-level permissions
    if not has_organization_role(current_user, org_id, "owner", db=db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only organization owners can grant permissions",
        )

    # Verify permission exists or create it
    perm = db.execute(select(Permission).where(Permission.code == permission_code))
    perm = perm.scalar_one_or_none()

    if not perm:
        perm = Permission(
            name=permission_code,
            code=permission_code,
            is_system=False,
        )
        db.add(perm)
        db.commit()

    # Create role if needed (Owner role gets all permissions)
    role = db.execute(select(Role).where(Role.name == "owner"))
    role = role.scalar_one_or_none()

    if not role:
        role = Role(name="owner", description="Organization owner with full access")
        db.add(role)
        db.commit()

    # Associate permission with role
    if perm not in role.permissions:
        role.permissions.append(perm)
        db.add(role)
        db.commit()

    return {"detail": f"Permission '{permission_code}' granted to organization"}