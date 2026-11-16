"""Phase 3: Attack Surface Discovery Engine API endpoints.

Endpoints under /api/v1/discovery:
- Start discovery jobs
- List/cancel jobs
- View assets and observations
- Discovery history and statistics
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Optional, List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select, and_, or_, func, desc, asc
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.database import get_db
from app.database.session import get_session_factory
from app.models import users, organizations, scopes, discovery as disc_models
from app.models.discovery import (
    DiscoveryJob,
    Asset,
    DnsObservation,
    HttpObservation,
    PortObservation,
    TechnologyObservation,
    AssetRelationship,
)
from app.models.audit_logs import AuditLog
from app.models.users import User
from app.models.organizations import Organization
from app.models.scopes import Scope
from app.core.security import (
    get_current_user,
    has_organization_role,
    validate_domain_pattern,
)
from app.schemas.discovery import (
    DiscoveryJobCreate,
    DiscoveryJobResponse,
    DiscoveryJobStatus,
    AssetCreate,
    AssetResponse,
    AssetSearch,
    DnsObservationResponse,
    HttpObservationResponse,
    PortObservationResponse,
    TechnologyObservationResponse,
    AssetFilter,
    DiscoveryHistoryEntry,
    DiscoveryStats,
)

router = APIRouter(prefix="/v1/discovery", tags=["discovery"])


# ── Helpers ────────────────────────────────────────────────────────────────

def _require_org_access(
    org_id: int,
    db: Session,
    current_user: User,
    required_role: str = "viewer",
) -> Organization:
    """Verify organization membership and return the organization."""
    if not has_organization_role(current_user, org_id, required_role, db=db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient organization permissions",
        )
    org = db.get(Organization, org_id)
    if not org or not org.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )
    return org


def _require_scope_access(
    org_id: int,
    scope_id: int,
    db: Session,
    current_user: User,
    required_role: str = "viewer",
) -> Scope:
    """Verify scope belongs to organization and user has access."""
    scope = db.get(Scope, scope_id)
    if not scope or scope.organization_id != org_id or not scope.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scope not found in this organization",
        )
    if not has_organization_role(current_user, org_id, required_role, db=db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient organization permissions",
        )
    return scope


# ── Discovery Job endpoints ────────────────────────────────────────────────

@router.post(
    "/jobs",
    response_model=DiscoveryJobResponse,
    status_code=status.HTTP_201_CREATED,
)
async def start_discovery_job(
    job_in: DiscoveryJobCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
) -> DiscoveryJobResponse:
    """Start a new discovery job within an authorized scope.

    The user must be an owner or admin of the organization's scope.
    The scope must belong to the user's organization.
    """
    org = _require_org_access(job_in.organization_id, db, current_user, "admin")

    # Validate scope belongs to org and user has access
    scope = _require_scope_access(
        job_in.organization_id, job_in.scope_id, db, current_user, "admin"
    )

    # Check for duplicate running jobs for same target+profile
    existing = db.execute(
        select(DiscoveryJob).where(
            DiscoveryJob.organization_id == job_in.organization_id,
            DiscoveryJob.scope_id == job_in.scope_id,
            DiscoveryJob.name == job_in.name,
            DiscoveryJob.state.in_([disc_models.JOB_PENDING, disc_models.JOB_QUEUED, disc_models.JOB_RUNNING]),
        )
    )
    existing_job = existing.scalar_one_or_none()
    if existing_job:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A discovery job named '{job_in.name}' is already running or pending for this scope",
        )

    # Create the job
    db_job = DiscoveryJob(
        organization_id=job_in.organization_id,
        scope_id=job_in.scope_id,
        name=job_in.name,
        description=job_in.description,
        config=job_in.config.model_dump_json() if job_in.config else None,
    )
    db.add(db_job)
    db.commit()
    db.refresh(db_job)

    # Audit log
    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)

    audit = AuditLog(
        actor_id=current_user.id,
        action="discovery_job_start",
        outcome="success",
        organization_id=job_in.organization_id,
        ip_address=ip_address,
        user_agent=user_agent,
        details=f"Job '{job_in.name}' started with scope {job_in.scope_id}",
    )
    db.add(audit)
    db.commit()

    return DiscoveryJobResponse.model_validate(db_job)


@router.get("/jobs", response_model=List[DiscoveryJobStatus])
async def list_discovery_jobs(
    org_id: int,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[DiscoveryJobStatus]:
    """List discovery jobs for an organization.

    Filter by state if provided. Otherwise return all jobs.
    """
    org = _require_org_access(org_id, db, current_user, "viewer")

    query = select(DiscoveryJob).filter(
        DiscoveryJob.organization_id == org_id
    )

    if status_filter:
        query = query.filter(DiscoveryJob.state == status_filter)

    query = query.order_by(desc(DiscoveryJob.created_at))
    result = db.execute(query)
    jobs = result.scalars().unique().all()

    return [DiscoveryJobStatus.model_validate(job) for job in jobs]


@router.get("/jobs/{job_id}", response_model=DiscoveryJobStatus)
async def get_discovery_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DiscoveryJobStatus:
    """Get details of a specific discovery job."""
    job = db.get(DiscoveryJob, job_id)
    if not job or job.organization_id != current_user.org_id if hasattr(current_user, 'org_id') else True:
        # Need to check org access
        # Check the user has access to the organization
        org_result = db.execute(
            select(DiscoveryJob).join(Organization).where(
                DiscoveryJob.id == job_id,
                Organization.id == job.organization_id,
            )
        )
        # Simpler: just get the job and check via organization
        from app.core.security import has_organization_role
        org = db.get(Organization, job.organization_id)
        if not org or not has_organization_role(current_user, job.organization_id, "viewer", db=db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to view this job",
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    job = db.get(DiscoveryJob, job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    # Verify user has access to the organization
    if not has_organization_role(current_user, job.organization_id, "viewer", db=db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view this job",
        )

    return DiscoveryJobStatus.model_validate(job)


@router.post(
    "/jobs/{job_id}/cancel",
    status_code=status.HTTP_200_OK,
)
async def cancel_discovery_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Cancel a running discovery job."""
    job = db.get(DiscoveryJob, job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    # Verify user has admin+ access to the organization
    if not has_organization_role(current_user, job.organization_id, "admin", db=db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only organization admins can cancel jobs",
        )

    # Only cancel running or queued jobs
    if job.state not in [disc_models.JOB_RUNNING, disc_models.JOB_QUEUED, disc_models.JOB_PENDING]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel job in state '{job.state}'",
        )

    job.state = disc_models.JOB_CANCELLED
    job.state_updated_at = datetime.now(timezone.utc)
    job.completed_at = datetime.now(timezone.utc)

    db.add(job)
    db.commit()

    # Audit log
    audit = AuditLog(
        actor_id=current_user.id,
        action="discovery_job_cancel",
        outcome="success",
        organization_id=job.organization_id,
    )
    db.add(audit)
    db.commit()

    return {"detail": f"Discovery job '{job.name}' cancelled successfully"}


# ── Asset endpoints ────────────────────────────────────────────────────────

@router.get("/assets", response_model=List[AssetResponse])
async def list_assets(
    org_id: int,
    filter: Optional[AssetFilter] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[AssetResponse]:
    """List assets for an organization with filtering.

    Supports filtering by asset_type, status, validated status, and search value.
    """
    org = _require_org_access(org_id, db, current_user, "viewer")

    query = select(Asset).filter(Asset.organization_id == org_id)

    # Apply filters
    if filter:
        if filter.asset_type:
            query = query.filter(Asset.asset_type == filter.asset_type)
        if filter.status:
            query = query.filter(Asset.status == filter.status)
        if filter.is_validated is not None:
            query = query.filter(Asset.is_validated == filter.is_validated)
        if filter.search:
            # Search across value and normalized forms
            search_term = f"%{filter.search}%"
            query = query.filter(
                or_(
                    Asset.value.ilike(search_term),
                    Asset.normalized_domain.ilike(search_term),
                    Asset.normalized_ip.ilike(search_term),
                )
            )

    # Apply pagination (default limit)
    query = query.order_by(desc(Asset.last_seen)).limit(200)
    result = db.execute(query)
    assets = result.scalars().unique().all()

    return [AssetResponse.model_validate(asset) for asset in assets]


@router.get("/assets/{asset_id}", response_model=AssetResponse)
async def get_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AssetResponse:
    """Get details of a specific asset including all observations."""
    org_result = db.execute(
        select(Asset).join(Organization).where(
            Asset.id == asset_id,
            Organization.id == Asset.organization_id,
        )
    )
    # Simpler approach: get asset and check org access
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found",
        )

    # Verify user has access to the organization
    from app.core.security import has_organization_role
    if not has_organization_role(current_user, asset.organization_id, "viewer", db=db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view this asset",
        )

    return AssetResponse.model_validate(asset)


@router.get("/assets/{asset_id}/dns", response_model=List[DnsObservationResponse])
async def get_asset_dns_observations(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[DnsObservationResponse]:
    """Get DNS observations for an asset."""
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found",
        )

    from app.core.security import has_organization_role
    if not has_organization_role(current_user, asset.organization_id, "viewer", db=db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )

    query = select(DnsObservation).filter(DnsObservation.asset_id == asset_id)
    query = query.order_by(desc(DnsObservation.query_timestamp))
    result = db.execute(query)
    observations = result.scalars().unique().all()

    return [DnsObservationResponse.model_validate(obs) for obs in observations]


@router.get("/assets/{asset_id}/http", response_model=List[HttpObservationResponse])
async def get_asset_http_observations(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[HttpObservationResponse]:
    """Get HTTP observations for an asset."""
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found",
        )

    from app.core.security import has_organization_role
    if not has_organization_role(current_user, asset.organization_id, "viewer", db=db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )

    query = select(HttpObservation).filter(HttpObservation.asset_id == asset_id)
    query = query.order_by(desc(HttpObservation.observation_timestamp))
    result = db.execute(query)
    observations = result.scalars().unique().all()

    return [HttpObservationResponse.model_validate(obs) for obs in observations]


@router.get("/assets/{asset_id}/ports", response_model=List[PortObservationResponse])
async def get_asset_port_observations(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[PortObservationResponse]:
    """Get port observations for an asset."""
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found",
        )

    from app.core.security import has_organization_role
    if not has_organization_role(current_user, asset.organization_id, "viewer", db=db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )

    query = select(PortObservation).filter(PortObservation.asset_id == asset_id)
    query = query.order_by(desc(PortObservation.observation_timestamp))
    result = db.execute(query)
    observations = result.scalars().unique().all()

    return [PortObservationResponse.model_validate(obs) for obs in observations]


@router.get("/assets/{asset_id}/technology", response_model=List[TechnologyObservationResponse])
async def get_asset_technology_observations(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[TechnologyObservationResponse]:
    """Get technology fingerprint observations for an asset."""
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found",
        )

    from app.core.security import has_organization_role
    if not has_organization_role(current_user, asset.organization_id, "viewer", db=db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )

    query = select(TechnologyObservation).filter(
        TechnologyObservation.asset_id == asset_id
    )
    query = query.order_by(desc(TechnologyObservation.observation_timestamp))
    result = db.execute(query)
    observations = result.scalars().unique().all()

    return [TechnologyObservationResponse.model_validate(obs) for obs in observations]


# ── Discovery history endpoint ─────────────────────────────────────────────

@router.get("/history", response_model=List[DiscoveryHistoryEntry])
async def discovery_history(
    org_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[DiscoveryHistoryEntry]:
    """Get recent discovery history for an organization."""
    org = _require_org_access(org_id, db, current_user, "viewer")

    # Get recent job events via audit log
    query = (
        select(AuditLog)
        .filter(AuditLog.organization_id == org_id)
        .filter(AuditLog.action.startswith("discovery_"))
        .order_by(desc(AuditLog.created_at))
        .limit(limit)
    )
    result = db.execute(query)
    entries = result.scalars().unique().all()

    return [DiscoveryHistoryEntry.model_validate(entry) for entry in entries]


# ── Discovery statistics endpoint ──────────────────────────────────────────

@router.get("/stats", response_model=DiscoveryStats)
async def discovery_stats(
    org_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DiscoveryStats:
    """Get discovery statistics for an organization."""
    org = _require_org_access(org_id, db, current_user, "viewer")

    # Total assets by type
    assets_by_type = (
        db.execute(
            select(Asset.asset_type, func.count(Asset.id))
            .filter(Asset.organization_id == org_id)
            .group_by(Asset.asset_type)
        )
        .unique()
        .all()
    )
    assets_dict: dict[str, int] = {row[0]: row[1] for row in assets_by_type}

    # Total jobs by state
    jobs_by_state = (
        db.execute(
            select(DiscoveryJob.state, func.count(DiscoveryJob.id))
            .filter(DiscoveryJob.organization_id == org_id)
            .group_by(DiscoveryJob.state)
        )
        .unique()
        .all()
    )
    jobs_dict: dict[str, int] = {row[0]: row[1] for row in jobs_by_state}

    # Validated assets
    validated_count = (
        db.execute(
            select(func.count(Asset.id))
            .filter(Asset.organization_id == org_id, Asset.is_validated == True)
        )
        .scalar_one()
    )

    # Total assets
    total_assets = (
        db.execute(select(func.count(Asset.id)))
        .filter(Asset.organization_id == org_id)
        .scalar_one()
    )

    # Active jobs
    active_jobs = (
        db.execute(
            select(func.count(DiscoveryJob.id))
            .filter(
                DiscoveryJob.organization_id == org_id,
                DiscoveryJob.state.in_(
                    [disc_models.JOB_PENDING, disc_models.JOB_QUEUED, disc_models.JOB_RUNNING]
                ),
            )
        )
        .scalar_one()
    )

    return DiscoveryStats(
        total_assets=total_assets,
        assets_by_type=assets_dict,
        total_jobs=sum(jobs_dict.values()) if jobs_dict else 0,
        jobs_by_state=jobs_dict,
        validated_assets=validated_count,
        active_jobs=active_jobs,
    )