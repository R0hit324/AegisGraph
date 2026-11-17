"""Phase 3 revision: Attack Surface Discovery Engine models.

This migration adds the discovery engine infrastructure:

- discovery_jobs: job state tracking with organization isolation
- assets: asset inventory (domains, subdomains, IPs, services)
- asset_relationships: infrastructure relationships between assets
- dns_observations: DNS record resolution records
- http_observations: HTTP/HTTPS endpoint observations
- port_observations: port/service discovery observations
- technology_observations: technology fingerprint observations

The Phase 1 (app_metadata) and Phase 2 (users, organizations, scopes,
user_organizations, audit_logs, roles, permissions) tables are preserved
unchanged.
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0003_phase3_discovery_models"
down_revision: str | None = "0002_phase2_auth_orgs_scopes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create Phase 3 discovery infrastructure tables."""

    # ---- discovery_jobs -------------------------------------------------------
    op.create_table(
        "discovery_jobs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("organization_id", sa.Integer(),
                  sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("scope_id", sa.Integer(),
                  sa.ForeignKey("scopes.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("name", sa.String(length=200), nullable=False, index=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("state", sa.String(length=50), nullable=False,
                  server_default=sa.text("'pending'"), index=True),
        sa.Column("state_updated_at",
                  sa.DateTime(timezone=True), nullable=False),
        sa.Column("config", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("target_count", sa.Integer(), nullable=True),
        sa.Column("discovered_count", sa.Integer(),
                  server_default=sa.text("0"), nullable=False),
        sa.Column("completed_count", sa.Integer(),
                  server_default=sa.text("0"), nullable=False),
        sa.Column("error_count", sa.Integer(),
                  server_default=sa.text("0"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", sa.Integer(),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index(
        "ix_discovery_jobs_org_state", "discovery_jobs",
        ["organization_id", "state"],
    )
    op.create_index(
        "ix_discovery_jobs_org_scope", "discovery_jobs",
        ["organization_id", "scope_id"],
    )

    # ---- assets -------------------------------------------------------------
    op.create_table(
        "assets",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("organization_id", sa.Integer(),
                  sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("job_id", sa.Integer(),
                  sa.ForeignKey("discovery_jobs.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("scope_id", sa.Integer(),
                  sa.ForeignKey("scopes.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("asset_type", sa.String(length=50), nullable=False, index=True),
        sa.Column("value", sa.String(length=39), nullable=False, index=True),
        sa.Column("parent_asset_id", sa.Integer(),
                  sa.ForeignKey("assets.id", ondelete="CASCADE"), nullable=True, index=True),
        sa.Column("first_seen", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("now()")),
        sa.Column("last_seen", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("now()"),
                  onupdate=sa.text("now()")),
        sa.Column("is_validated", sa.Boolean(),
                  nullable=False, server_default=sa.text("false")),
        sa.Column("confidence", sa.Float(),
                  nullable=False, server_default=sa.text("0.0")),
        sa.Column("discovery_source", sa.String(length=200), nullable=True, index=True),
        sa.Column("status", sa.String(length=50),
                  nullable=False, server_default=sa.text("'active'"), index=True),
        sa.Column("normalized_domain", sa.String(length=255), nullable=True, index=True),
        sa.Column("normalized_ip", sa.String(length=45), nullable=True, index=True),
    )
    op.create_index("ix_assets_org_type", "assets", ["organization_id", "asset_type"])
    op.create_index("ix_assets_org_value", "assets", ["organization_id", "value"])
    op.create_index("ix_assets_type_status", "assets", ["asset_type", "status"])

    # ---- asset_relationships ------------------------------------------------
    op.create_table(
        "asset_relationships",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("organization_id", sa.Integer(),
                  sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("source_asset_id", sa.Integer(),
                  sa.ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("target_asset_id", sa.Integer(),
                  sa.ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("relationship_type", sa.String(length=50), nullable=False, index=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("observed_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("now()")),
        sa.Column("confidence", sa.Float(),
                  nullable=False, server_default=sa.text("0.5")),
    )
    op.create_index(
        "ix_asset_rels_org", "asset_relationships", ["organization_id"]
    )
    op.create_index(
        "ix_asset_rels_src_target", "asset_relationships",
        ["source_asset_id", "target_asset_id"],
    )
    op.create_unique_constraint(
        "uq_asset_relationship_pair",
        "asset_relationships",
        ["source_asset_id", "target_asset_id", "relationship_type"],
    )

    # ---- dns_observations ---------------------------------------------------
    op.create_table(
        "dns_observations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("asset_id", sa.Integer(),
                  sa.ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("record_type", sa.String(length=10), nullable=False, index=True),
        sa.Column("record_value", sa.String(length=255), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("now()")),
        sa.Column("query_timestamp", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("now()")),
        sa.Column("resolution_success", sa.Boolean(),
                  nullable=False, server_default=sa.text("true")),
        sa.Column("error_message", sa.String(length=500), nullable=True),
        sa.Column("resolved_target", sa.String(length=39), nullable=True, index=True),
    )
    op.create_index("ix_dns_assets_org", "dns_observations", ["asset_id"])
    op.create_index("ix_dns_org_type", "dns_observations", ["record_type"])

    # ---- http_observations --------------------------------------------------
    op.create_table(
        "http_observations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("asset_id", sa.Integer(),
                  sa.ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("observation_timestamp", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("now()")),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("final_url", sa.String(length=500), nullable=True),
        sa.Column("response_time_ms", sa.Float(), nullable=True),
        sa.Column("response_size_bytes", sa.Integer(), nullable=True),
        sa.Column("tls_available", sa.Boolean(),
                  nullable=False, server_default=sa.text("false")),
        sa.Column("tls_version", sa.String(length=30), nullable=True),
        sa.Column("tls_cipher_suite", sa.String(length=100), nullable=True),
        sa.Column("certificate_subject", sa.String(length=500), nullable=True),
        sa.Column("certificate_issuer", sa.String(length=500), nullable=True),
        sa.Column("certificate_fingerprint_sha256", sa.String(length=100), nullable=True),
        sa.Column("server_header", sa.String(length=100), nullable=True),
        sa.Column("x_powered_by", sa.String(length=100), nullable=True),
        sa.Column("strict_transport_security", sa.String(length=500), nullable=True),
        sa.Column("x_xss_protection", sa.String(length=100), nullable=True),
        sa.Column("x_frame_options", sa.String(length=100), nullable=True),
        sa.Column("content_security_policy", sa.String(length=500), nullable=True),
        sa.Column("age_header", sa.String(length=100), nullable=True),
        sa.Column("etag_header", sa.String(length=100), nullable=True),
        sa.Column("page_title", sa.String(length=500), nullable=True),
        sa.Column("error_message", sa.String(length=500), nullable=True),
        sa.Column("redirect_count", sa.Integer(), nullable=True, server_default=sa.text("0")),
    )
    op.create_index("ix_http_assets_org", "http_observations", ["asset_id"])
    op.create_index("ix_http_timestamp", "http_observations", ["observation_timestamp"])

    # ---- port_observations --------------------------------------------------
    op.create_table(
        "port_observations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("asset_id", sa.Integer(),
                  sa.ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("port", sa.Integer(), nullable=False, index=True),
        sa.Column("observation_timestamp", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("now()")),
        sa.Column("status", sa.String(length=30), nullable=False, index=True),
        sa.Column("transport", sa.String(length=10),
                  nullable=False, server_default=sa.text("'tcp'")),
        sa.Column("service_name", sa.String(length=100), nullable=True),
        sa.Column("service_product", sa.String(length=200), nullable=True),
        sa.Column("service_version", sa.String(length=50), nullable=True),
        sa.Column("connection_time_ms", sa.Float(), nullable=True),
        sa.Column("banner", sa.String(length=1024), nullable=True),
        sa.Column("error_message", sa.String(length=500), nullable=True),
    )
    op.create_index("ix_port_assets_org", "port_observations", ["asset_id"])
    op.create_index("ix_port_status", "port_observations", ["status"])

    # ---- technology_observations --------------------------------------------
    op.create_table(
        "technology_observations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("asset_id", sa.Integer(),
                  sa.ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("observation_timestamp", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("now()")),
        sa.Column("category", sa.String(length=50), nullable=False, index=True),
        sa.Column("name", sa.String(length=200), nullable=True),
        sa.Column("version", sa.String(length=50), nullable=True),
        sa.Column("indicator", sa.String(length=500), nullable=True),
        sa.Column("source_path", sa.String(length=500), nullable=True),
        sa.Column("confidence", sa.Float(),
                  nullable=False, server_default=sa.text("0.5")),
        sa.Column("is_primary", sa.Boolean(),
                  nullable=False, server_default=sa.text("false")),
    )
    op.create_index("ix_tech_assets_org", "technology_observations", ["asset_id"])
    op.create_index("ix_tech_category", "technology_observations", ["category"])


def downgrade() -> None:
    """Remove Phase 3 discovery infrastructure tables."""

    op.drop_table("technology_observations")
    op.drop_index("ix_tech_category", table_name="technology_observations")
    op.drop_index("ix_tech_assets_org", table_name="technology_observations")

    op.drop_table("port_observations")
    op.drop_index("ix_port_status", table_name="port_observations")
    op.drop_index("ix_port_assets_org", table_name="port_observations")

    op.drop_table("http_observations")
    op.drop_index("ix_http_timestamp", table_name="http_observations")
    op.drop_index("ix_http_assets_org", table_name="http_observations")

    op.drop_table("dns_observations")
    op.drop_index("ix_dns_org_type", table_name="dns_observations")
    op.drop_index("ix_dns_assets_org", table_name="dns_observations")

    op.drop_constraint(
        "uq_asset_relationship_pair", "asset_relationships", type_="unique"
    )
    op.drop_index("ix_asset_rels_src_target", table_name="asset_relationships")
    op.drop_index("ix_asset_rels_org", table_name="asset_relationships")
    op.drop_table("asset_relationships")

    op.drop_index("ix_assets_type_status", table_name="assets")
    op.drop_index("ix_assets_org_value", table_name="assets")
    op.drop_index("ix_assets_org_type", table_name="assets")
    op.drop_table("assets")

    op.drop_index("ix_discovery_jobs_org_scope", table_name="discovery_jobs")
    op.drop_index("ix_discovery_jobs_org_state", table_name="discovery_jobs")
    op.drop_table("discovery_jobs")

    # Note: Phase 1 and Phase 2 tables are preserved unchanged.