"""Pydantic schemas for Phase 3: Attack Surface Discovery Engine."""

from __future__ import annotations

from datetime import datetime
from typing import Optional, List, Dict, Any

from pydantic import BaseModel, Field


# ── Discovery Job schemas ──────────────────────────────────────────────────

class DiscoveryJobCreate(BaseModel):
    """Schema for creating a discovery job."""

    name: str = Field(
        ..., min_length=1, max_length=200, description="Job display name"
    )
    description: Optional[str] = Field(
        None, max_length=500, description="Job description"
    )
    organization_id: int = Field(
        ..., description="Organization ID to run discovery under"
    )
    scope_id: int = Field(
        ..., description="Scope ID authorizing the discovery"
    )
    config: Optional[Any] = Field(
        None, description="JSON configuration for discovery modules"
    )


class DiscoveryJobResponse(BaseModel):
    """Schema for discovery job response."""

    id: int
    organization_id: int
    scope_id: Optional[int] = None
    name: str
    description: Optional[str] = None
    state: str
    state_updated_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    target_count: Optional[int] = None
    discovered_count: int
    completed_count: int
    error_count: int
    config: Optional[str] = None  # JSON string
    created_at: datetime
    created_by: Optional[int] = None

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, job) -> "DiscoveryJobResponse":
        return cls(
            id=job.id,
            organization_id=job.organization_id,
            scope_id=job.scope_id,
            name=job.name,
            description=job.description,
            state=job.state,
            state_updated_at=job.state_updated_at,
            started_at=job.started_at,
            completed_at=job.completed_at,
            target_count=job.target_count,
            discovered_count=job.discovered_count,
            completed_count=job.completed_count,
            error_count=job.error_count,
            config=job.config,
            created_at=job.created_at,
            created_by=job.created_by,
        )


class DiscoveryJobStatus(BaseModel):
    """Schema for discovery job status summary."""

    id: int
    name: str
    state: str
    discovered_count: int
    completed_count: int
    error_count: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, job) -> "DiscoveryJobStatus":
        return cls(
            id=job.id,
            name=job.name,
            state=job.state,
            discovered_count=job.discovered_count,
            completed_count=job.completed_count,
            error_count=job.error_count,
            started_at=job.started_at,
            completed_at=job.completed_at,
        )


# ── Asset schemas ──────────────────────────────────────────────────────────

class AssetFilter(BaseModel):
    """Schema for asset filtering."""

    asset_type: Optional[str] = Field(
        None, description="Filter by asset type (domain, subdomain, ipv4, ipv6, etc.)"
    )
    status: Optional[str] = Field(
        None, description="Filter by status (active, retired, out_of_scope)"
    )
    is_validated: Optional[bool] = Field(
        None, description="Filter by validation status"
    )
    search: Optional[str] = Field(
        None, max_length=200, description="Search term across asset value"
    )


class AssetCreate(BaseModel):
    """Schema for creating an asset (internal use)."""

    organization_id: int = Field(..., description="Organization ID")
    job_id: Optional[int] = Field(None, description="Discovery job ID")
    scope_id: Optional[int] = Field(None, description="Scope ID")
    asset_type: str = Field(..., min_length=1, description="Asset type category")
    value: str = Field(..., min_length=1, max_length=39, description="Normalized asset value")
    parent_asset_id: Optional[int] = Field(
        None, description="Parent asset ID for subdomain relationships"
    )
    discovery_source: Optional[str] = Field(
        None, max_length=200, description="Source of discovery"
    )
    confidence: float = Field(
        default=0.5, ge=0.0, le=1.0, description="Confidence score (0-1)"
    )
    is_validated: bool = Field(default=False, description="Whether asset is validated")
    status: str = Field(
        default="active", description="Asset status"
    )
    normalized_domain: Optional[str] = Field(
        None, max_length=255, description="Normalized domain form"
    )
    normalized_ip: Optional[str] = Field(
        None, max_length=45, description="Normalized IP form"
    )


class AssetResponse(BaseModel):
    """Schema for asset response."""

    id: int
    organization_id: int
    job_id: Optional[int] = None
    scope_id: Optional[int] = None
    asset_type: str
    value: str
    asset_type_display: str = Field(..., description="Human-readable type")
    parent_asset_id: Optional[int] = None
    first_seen: datetime
    last_seen: datetime
    is_validated: bool
    confidence: float
    discovery_source: Optional[str] = None
    status: str
    normalized_domain: Optional[str] = None
    normalized_ip: Optional[str] = None

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, asset) -> "AssetResponse":
        # Determine human-readable display type
        type_map = {
            "domain": "Domain",
            "subdomain": "Subdomain",
            "ipv4": "IPv4 Address",
            "ipv6": "IPv6 Address",
            "http_service": "HTTP Service",
            "https_service": "HTTPS Service",
            "network_service": "Network Service",
        }
        type_display = type_map.get(asset.asset_type, asset.asset_type)

        return cls(
            id=asset.id,
            organization_id=asset.organization_id,
            job_id=asset.job_id,
            scope_id=asset.scope_id,
            asset_type=asset.asset_type,
            value=asset.value,
            asset_type_display=type_display,
            parent_asset_id=asset.parent_asset_id,
            first_seen=asset.first_seen,
            last_seen=asset.last_seen,
            is_validated=asset.is_validated,
            confidence=asset.confidence,
            discovery_source=asset.discovery_source,
            status=asset.status,
            normalized_domain=asset.normalized_domain,
            normalized_ip=asset.normalized_ip,
        )


# ── DNS Observation schemas ────────────────────────────────────────────────

class DnsObservationResponse(BaseModel):
    """Schema for DNS observation response."""

    id: int
    asset_id: int
    record_type: str
    record_value: str
    resolved_at: datetime
    query_timestamp: datetime
    resolution_success: bool
    error_message: Optional[str] = None
    resolved_target: Optional[str] = None

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, obs) -> "DnsObservationResponse":
        return cls(
            id=obs.id,
            asset_id=obs.asset_id,
            record_type=obs.record_type,
            record_value=obs.record_value,
            resolved_at=obs.resolved_at,
            query_timestamp=obs.query_timestamp,
            resolution_success=obs.resolution_success,
            error_message=obs.error_message,
            resolved_target=obs.resolved_target,
        )


# ── HTTP Observation schemas ───────────────────────────────────────────────

class HttpObservationResponse(BaseModel):
    """Schema for HTTP observation response."""

    id: int
    asset_id: int
    observation_timestamp: datetime
    status_code: Optional[int] = None
    final_url: Optional[str] = None
    response_time_ms: Optional[float] = None
    response_size_bytes: Optional[int] = None
    tls_available: bool
    tls_version: Optional[str] = None
    tls_cipher_suite: Optional[str] = None
    certificate_subject: Optional[str] = None
    certificate_issuer: Optional[str] = None
    certificate_fingerprint_sha256: Optional[str] = None
    server_header: Optional[str] = None
    x_powered_by: Optional[str] = None
    strict_transport_security: Optional[str] = None
    x_xss_protection: Optional[str] = None
    x_frame_options: Optional[str] = None
    content_security_policy: Optional[str] = None
    age_header: Optional[str] = None
    etag_header: Optional[str] = None
    page_title: Optional[str] = None
    error_message: Optional[str] = None
    redirect_count: Optional[int] = None

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, obs) -> "HttpObservationResponse":
        return cls(
            id=obs.id,
            asset_id=obs.asset_id,
            observation_timestamp=obs.observation_timestamp,
            status_code=obs.status_code,
            final_url=obs.final_url,
            response_time_ms=obs.response_time_ms,
            response_size_bytes=obs.response_size_bytes,
            tls_available=obs.tls_available,
            tls_version=obs.tls_version,
            tls_cipher_suite=obs.tls_cipher_suite,
            certificate_subject=obs.certificate_subject,
            certificate_issuer=obs.certificate_issuer,
            certificate_fingerprint_sha256=obs.certificate_fingerprint_sha256,
            server_header=obs.server_header,
            x_powered_by=obs.x_powered_by,
            strict_transport_security=obs.strict_transport_security,
            x_xss_protection=obs.x_xss_protection,
            x_frame_options=obs.x_frame_options,
            content_security_policy=obs.content_security_policy,
            age_header=obs.age_header,
            etag_header=obs.etag_header,
            page_title=obs.page_title,
            error_message=obs.error_message,
            redirect_count=obs.redirect_count,
        )


# ── Port Observation schemas ───────────────────────────────────────────────

class PortObservationResponse(BaseModel):
    """Schema for port observation response."""

    id: int
    asset_id: int
    port: int
    observation_timestamp: datetime
    status: str
    transport: str = "tcp"
    service_name: Optional[str] = None
    service_product: Optional[str] = None
    service_version: Optional[str] = None
    connection_time_ms: Optional[float] = None
    banner: Optional[str] = None
    error_message: Optional[str] = None

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, obs) -> "PortObservationResponse":
        return cls(
            id=obs.id,
            asset_id=obs.asset_id,
            port=obs.port,
            observation_timestamp=obs.observation_timestamp,
            status=obs.status,
            transport=obs.transport,
            service_name=obs.service_name,
            service_product=obs.service_product,
            service_version=obs.service_version,
            connection_time_ms=obs.connection_time_ms,
            banner=obs.banner,
            error_message=obs.error_message,
        )


# ── Technology Observation schemas ─────────────────────────────────────────

class TechnologyObservationResponse(BaseModel):
    """Schema for technology observation response."""

    id: int
    asset_id: int
    observation_timestamp: datetime
    category: str
    name: Optional[str] = None
    version: Optional[str] = None
    indicator: Optional[str] = None
    source_path: Optional[str] = None
    confidence: float
    is_primary: bool

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, obs) -> "TechnologyObservationResponse":
        return cls(
            id=obs.id,
            asset_id=obs.asset_id,
            observation_timestamp=obs.observation_timestamp,
            category=obs.category,
            name=obs.name,
            version=obs.version,
            indicator=obs.indicator,
            source_path=obs.source_path,
            confidence=obs.confidence,
            is_primary=obs.is_primary,
        )


# ── Discovery History schemas ──────────────────────────────────────────────

class DiscoveryHistoryEntry(BaseModel):
    """Schema for discovery history entry response."""

    id: int
    action: str
    outcome: str
    created_at: datetime
    organization_name: Optional[str] = None
    details: Optional[str] = None

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, entry) -> "DiscoveryHistoryEntry":
        org_name = None
        if hasattr(entry, "organization") and entry.organization:
            org_name = entry.organization.name
        return cls(
            id=entry.id,
            action=entry.action,
            outcome=entry.outcome,
            created_at=entry.created_at,
            organization_name=org_name,
            details=entry.details,
        )


# ── Discovery Statistics schemas ───────────────────────────────────────────

class DiscoveryStats(BaseModel):
    """Schema for discovery statistics response."""

    total_assets: int
    assets_by_type: Dict[str, int] = Field(default_factory=dict)
    total_jobs: int
    jobs_by_state: Dict[str, int] = Field(default_factory=dict)
    validated_assets: int
    active_jobs: int