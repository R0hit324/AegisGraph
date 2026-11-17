/**
 * Phase 3: Attack Surface Discovery Engine — API types.
 *
 * Mirrors the backend Pydantic schemas in `backend/app/schemas/discovery.py`.
 * Datetimes are serialized by FastAPI as ISO-8601 strings.
 */

/* ── Discovery jobs ─────────────────────────────────────────────────────── */

/** Mirrors backend `DiscoveryJobCreate`. */
export interface DiscoveryJobCreate {
  name: string;
  description?: string | null;
  organization_id: number;
  scope_id: number;
  /** JSON-encoded module configuration string. */
  config?: string | null;
}

/** Mirrors backend `DiscoveryJobResponse`. */
export interface DiscoveryJobResponse {
  id: number;
  organization_id: number;
  scope_id: number | null;
  name: string;
  description: string | null;
  state: string;
  state_updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  target_count: number | null;
  discovered_count: number;
  completed_count: number;
  error_count: number;
  config: string | null;
  created_at: string;
  created_by: number | null;
}

/** Mirrors backend `DiscoveryJobStatus`. */
export interface DiscoveryJobStatus {
  id: number;
  name: string;
  state: string;
  discovered_count: number;
  completed_count: number;
  error_count: number;
  started_at: string | null;
  completed_at: string | null;
}

/* ── Assets ─────────────────────────────────────────────────────────────── */

/** Mirrors backend `AssetFilter`. */
export interface AssetFilter {
  asset_type?: string | undefined;
  status?: string | undefined;
  is_validated?: boolean | undefined;
  search?: string | undefined;
}

/** Mirrors backend `AssetResponse`. */
export interface AssetResponse {
  id: number;
  organization_id: number;
  job_id: number | null;
  scope_id: number | null;
  asset_type: string;
  value: string;
  asset_type_display: string;
  parent_asset_id: number | null;
  first_seen: string;
  last_seen: string;
  is_validated: boolean;
  confidence: number;
  discovery_source: string | null;
  status: string;
  normalized_domain: string | null;
  normalized_ip: string | null;
}

/* ── Observations ───────────────────────────────────────────────────────── */

/** Mirrors backend `DnsObservationResponse`. */
export interface DnsObservationResponse {
  id: number;
  asset_id: number;
  record_type: string;
  record_value: string;
  resolved_at: string;
  query_timestamp: string;
  resolution_success: boolean;
  error_message: string | null;
  resolved_target: string | null;
}

/** Mirrors backend `HttpObservationResponse`. */
export interface HttpObservationResponse {
  id: number;
  asset_id: number;
  observation_timestamp: string;
  status_code: number | null;
  final_url: string | null;
  response_time_ms: number | null;
  response_size_bytes: number | null;
  tls_available: boolean;
  tls_version: string | null;
  tls_cipher_suite: string | null;
  certificate_subject: string | null;
  certificate_issuer: string | null;
  certificate_fingerprint_sha256: string | null;
  server_header: string | null;
  x_powered_by: string | null;
  strict_transport_security: string | null;
  x_xss_protection: string | null;
  x_frame_options: string | null;
  content_security_policy: string | null;
  age_header: string | null;
  etag_header: string | null;
  page_title: string | null;
  error_message: string | null;
  redirect_count: number | null;
}

/** Mirrors backend `PortObservationResponse`. */
export interface PortObservationResponse {
  id: number;
  asset_id: number;
  port: number;
  observation_timestamp: string;
  status: string;
  transport: string;
  service_name: string | null;
  service_product: string | null;
  service_version: string | null;
  connection_time_ms: number | null;
  banner: string | null;
  error_message: string | null;
}

/** Mirrors backend `TechnologyObservationResponse`. */
export interface TechnologyObservationResponse {
  id: number;
  asset_id: number;
  observation_timestamp: string;
  category: string;
  name: string | null;
  version: string | null;
  indicator: string | null;
  source_path: string | null;
  confidence: number;
  is_primary: boolean;
}

/* ── History and statistics ─────────────────────────────────────────────── */

/** Mirrors backend `DiscoveryHistoryEntry`. */
export interface DiscoveryHistoryEntry {
  id: number;
  action: string;
  outcome: string;
  created_at: string;
  organization_name: string | null;
  details: string | null;
}

/** Mirrors backend `DiscoveryStats`. */
export interface DiscoveryStats {
  total_assets: number;
  assets_by_type: Record<string, number>;
  total_jobs: number;
  jobs_by_state: Record<string, number>;
  validated_assets: number;
  active_jobs: number;
}
