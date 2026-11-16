"""Discovery models for Phase 3: Attack Surface Discovery Engine.

Models for:
- Discovery Jobs
- Assets (domains, subdomains, IPs, services)
- DNS observations
- HTTP observations
- Port/service observations
- Technology observations
- Asset relationships
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import (
    String,
    Text,
    Boolean,
    Integer,
    Float,
    DateTime,
    ForeignKey,
    Index,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


# ---------------------------------------------------------------------------
# Job state constants
# ---------------------------------------------------------------------------
JOB_PENDING = "pending"
JOB_QUEUED = "queued"
JOB_RUNNING = "running"
JOB_COMPLETED = "completed"
JOB_PARTIALLY_COMPLETED = "partially_completed"
JOB_FAILED = "failed"
JOB_CANCELLED = "cancelled"


# ---------------------------------------------------------------------------
# Job status tracking
# ---------------------------------------------------------------------------

class DiscoveryJob(Base):
    """A discovery job running under an organization's authorization.

    Each job represents a coordinated set of discovery activities (subdomain
    enumeration, DNS resolution, port scanning, etc.) against an authorized
    scope.  All network operations within a job are organization-isolated and
    audit-logged.
    """

    __tablename__ = "discovery_jobs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    scope_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("scopes.id", ondelete="SET NULL"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Job state machine
    state: Mapped[str] = mapped_column(
        String(50), nullable=False, default=JOB_PENDING, index=True
    )
    state_updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # Discovery configuration
    config: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON config

    # Timestamps
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Job metadata
    target_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    discovered_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Audit
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    created_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    organization = relationship("Organization", back_populates="discovery_jobs")
    scope = relationship("Scope", back_populates="discovery_jobs")
    assets = relationship("Asset", back_populates="job", cascade="all, delete-orphan")
    audit = relationship("AuditLog", back_populates="job", cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# Assets
# ---------------------------------------------------------------------------

class Asset(Base):
    """An asset discovered during a discovery job.

    Assets are the fundamental tracked entities — domains, subdomains, IPv4/
    IPv6 addresses, and HTTP/HTTPS services.  Every asset is tied to an
    organization and a discovery job, and preserves historical observation
    data including first-seen/last-seen timestamps and confidence scores.
    """

    __tablename__ = "assets"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    job_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("discovery_jobs.id", ondelete="SET NULL"), nullable=True, index=True
    )
    scope_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("scopes.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Asset identification
    asset_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # e.g. "domain", "subdomain", "ipv4", "ipv6", "http_service", "https_service", "network_service"
    value: Mapped[str] = mapped_column(String(39), nullable=False, index=True)  # normalized value (IP in CIDR-free form, domain FQDN)

    # Relationships
    parent_asset_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=True, index=True
    )
    job = relationship("DiscoveryJob", back_populates="assets")
    parent_asset = relationship("Asset", remote_side=[id], back_populates="children")
    children = relationship("Asset", back_populates="parent_asset", cascade="all, delete-orphan")

    # Observation tracking
    first_seen: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_seen: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Validation and confidence
    is_validated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    confidence: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0
    )  # 0.0 = low, 1.0 = high

    # Discovery source tracking
    discovery_source: Mapped[str | None] = mapped_column(
        String(200), nullable=True, index=True
    )  # e.g. "certificate_transparency", "dns_enumeration", "passive_intelligence", "port_scan", "http_fingerprint"

    # Status
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="active", index=True
    )  # active, retired, out_of_scope

    # Normalized forms for different types
    normalized_domain: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True
    )  # for domain-type assets
    normalized_ip: Mapped[str | None] = mapped_column(
        String(45), nullable=True, index=True
    )  # for IP-type assets (IPv4 or IPv6, no CIDR)

    # Relationships
    organization = relationship("Organization", back_populates="assets")
    dns_observations = relationship("DnsObservation", back_populates="asset", cascade="all, delete-orphan")
    http_observations = relationship("HttpObservation", back_populates="asset", cascade="all, delete-orphan")
    port_observations = relationship("PortObservation", back_populates="asset", cascade="all, delete-orphan")
    tech_observations = relationship("TechnologyObservation", back_populates="asset", cascade="all, delete-orphan")


class AssetRelationship(Base):
    """Relationship between two assets.

    Captures infrastructure relationships discovered during assessment:
    - domain-to-IP mappings
    - CNAME chains
    - parent-subdomain relationships
    - reverse DNS relationships
    """

    __tablename__ = "asset_relationships"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    source_asset_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True)
    target_asset_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    relationship_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # e.g. "parent", "cpdname", "reverse_dns", "ip_range", "name_server"
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    observed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Confidence in this relationship
    confidence: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.5
    )

    # Ensure unique source-target pairs per type
    __table_args__ = (
        UniqueConstraint(
            "source_asset_id", "target_asset_id", "relationship_type", name="uq_asset_relationship_pair"
        ),
    )

    source_asset = relationship("Asset", foreign_keys=[source_asset_id], back_populates="outgoing_relationships")
    target_asset = relationship("Asset", foreign_keys=[target_asset_id], back_populates="incoming_relationships")


# Add reverse relationships for Asset
# (SQLAlchemy will handle these via the back_populates above, but let's be explicit)


# ---------------------------------------------------------------------------
# DNS observations
# ---------------------------------------------------------------------------

class DnsObservation(Base):
    """A DNS record observation for an asset.

    Each observation records a DNS query result for a specific record type,
    with timestamps and failure tracking.  Historical observations are preserved
    — new observations do not overwrite prior ones.
    """

    __tablename__ = "dns_observations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    asset_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    record_type: Mapped[str] = mapped_column(
        String(10), nullable=False, index=True
    )  # "A", "AAAA", "CNAME", "MX", "NS", "TXT", "SOA"
    record_value: Mapped[str] = mapped_column(String(255), nullable=False)
    resolved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    query_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Resolution metadata
    resolution_success: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Normalized target
    resolved_target: Mapped[str | None] = mapped_column(
        String(39), nullable=True, index=True
    )  # resolved IP or canonical name

    # Relationships
    asset = relationship("Asset", back_populates="dns_observations")


# ---------------------------------------------------------------------------
# HTTP observations
# ---------------------------------------------------------------------------

class HttpObservation(Base):
    """An HTTP/HTTPS endpoint observation for an asset.

    Records the results of an HTTP/HTTPS check: status code, final URL after
    redirects, response headers, TLS metadata, response time, and page title
    when safely available.  Every observation is preserved historically.
    """

    __tablename__ = "http_observations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    asset_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    observation_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # HTTP response details
    status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    final_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    response_time_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    response_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # TLS / certificate metadata
    tls_available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    tls_version: Mapped[str | None] = mapped_column(String(30), nullable=True)
    tls_cipher_suite: Mapped[str | None] = mapped_column(String(100), nullable=True)
    certificate_subject: Mapped[str | None] = mapped_column(String(500), nullable=True)
    certificate_issuer: Mapped[str | None] = mapped_column(String(500), nullable=True)
    certificate_fingerprint_sha256: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )

    # Headers (key indicators only; full request/response preserved selectively)
    server_header: Mapped[str | None] = mapped_column(String(100), nullable=True)
    x_powered_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    strict_transport_security: Mapped[str | None] = mapped_column(String(500), nullable=True)
    X_XSS_PROTECTION: Mapped[str | None] = mapped_column(String(100), nullable=True)
    X_FRAME_OPTIONS: Mapped[str | None] = mapped_column(String(100), nullable=True)
    content_security_policy: Mapped[str | None] = mapped_column(String(500), nullable=True)
    age_header: Mapped[str | None] = mapped_column(String(100), nullable=True)
    etag_header: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Page title when safely extractable
    page_title: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Error information
    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    redirect_count: Mapped[int | None] = mapped_column(Integer, nullable=True, default=0)

    # Relationships
    asset = relationship("Asset", back_populates="http_observations")


# ---------------------------------------------------------------------------
# Port/service observations
# ---------------------------------------------------------------------------

class PortObservation(Base):
    """A port/service observation for an asset.

    Records open/closed/filtered status of a specific port on an asset's IP,
    along with service identification where safely possible.
    """

    __tablename__ = "port_observations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    asset_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    port: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    observation_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Connection status
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, index=True
    )  # "open", "closed", "filtered", "unknown"
    transport: Mapped[str] = mapped_column(String(10), nullable=False, default="tcp")

    # Service identification
    service_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    service_product: Mapped[str | None] = mapped_column(String(200), nullable=True)
    service_version: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Connection metadata
    connection_time_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    banner: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    # Error information
    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Relationships
    asset = relationship("Asset", back_populates="port_observations")


# ---------------------------------------------------------------------------
# Technology observations
# ---------------------------------------------------------------------------

class TechnologyObservation(Base):
    """A technology fingerprint observation for an asset.

    Records technology indicators collected from HTTP/HTTPS endpoints,
    preserving passive indicators and confidence scores.
    """

    __tablename__ = "technology_observations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    asset_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    observation_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Technology categories
    category: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # e.g. "web_server", "framework", "cms", "js_framework", "cdn", "reverse_proxy"

    # Technology name/value
    name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    version: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Passive indicators
    indicator: Mapped[str | None] = mapped_column(String(500), nullable=True)  # e.g. "X-Powered-By: Express"
    source_path: Mapped[str | None] = mapped_column(String(500), nullable=True)  # e.g. "/admin/login"

    # Confidence in this observation
    confidence: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.5
    )  # 0.0 = tentative, 1.0 = confirmed

    # Multiple possible matches allowed
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Relationships
    asset = relationship("Asset", back_populates="tech_observations")