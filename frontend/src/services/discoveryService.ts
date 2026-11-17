/** Phase 3: Attack Surface Discovery Engine API client. */

import type {
  AssetFilter,
  AssetResponse,
  DiscoveryJobCreate,
  DiscoveryJobResponse,
  DiscoveryJobStatus,
  DiscoveryStats,
  DiscoveryHistoryEntry,
  DnsObservationResponse,
  HttpObservationResponse,
  PortObservationResponse,
  TechnologyObservationResponse,
} from "@/schemas/discovery";

import { request } from "./apiClient";

/* ── Job endpoints ──────────────────────────────────────────────────────── */

export async function listDiscoveryJobs(
  orgId: number,
  statusFilter?: string,
): Promise<DiscoveryJobStatus[]> {
  const params = new URLSearchParams({ org_id: String(orgId) });
  if (statusFilter !== undefined) params.set("status", statusFilter);
  return request<DiscoveryJobStatus[]>(`/api/v1/discovery/jobs?${params.toString()}`);
}

export async function startDiscoveryJob(
  job: DiscoveryJobCreate,
): Promise<DiscoveryJobResponse> {
  return request<DiscoveryJobResponse>("/api/v1/discovery/jobs", {
    method: "POST",
    body: job,
  });
}

export async function cancelDiscoveryJob(
  jobId: number,
): Promise<{ detail: string }> {
  return request<{ detail: string }>(`/api/v1/discovery/jobs/${jobId}/cancel`, {
    method: "POST",
  });
}

/* ── Asset endpoints ────────────────────────────────────────────────────── */

export async function listAssets(
  orgId: number,
  filter?: AssetFilter,
): Promise<AssetResponse[]> {
  const params = new URLSearchParams({ org_id: String(orgId) });
  if (filter?.asset_type !== undefined) params.set("asset_type", filter.asset_type);
  if (filter?.status !== undefined) params.set("status", filter.status);
  if (filter?.is_validated !== undefined) {
    params.set("is_validated", String(filter.is_validated));
  }
  if (filter?.search !== undefined) params.set("search", filter.search);
  return request<AssetResponse[]>(`/api/v1/discovery/assets?${params.toString()}`);
}

export async function getAsset(assetId: number): Promise<AssetResponse> {
  return request<AssetResponse>(`/api/v1/discovery/assets/${assetId}`);
}

export async function getAssetDns(
  assetId: number,
): Promise<DnsObservationResponse[]> {
  return request<DnsObservationResponse[]>(`/api/v1/discovery/assets/${assetId}/dns`);
}

export async function getAssetHttp(
  assetId: number,
): Promise<HttpObservationResponse[]> {
  return request<HttpObservationResponse[]>(`/api/v1/discovery/assets/${assetId}/http`);
}

export async function getAssetPorts(
  assetId: number,
): Promise<PortObservationResponse[]> {
  return request<PortObservationResponse[]>(`/api/v1/discovery/assets/${assetId}/ports`);
}

export async function getAssetTechnology(
  assetId: number,
): Promise<TechnologyObservationResponse[]> {
  return request<TechnologyObservationResponse[]>(
    `/api/v1/discovery/assets/${assetId}/technology`,
  );
}

/* ── Discovery history and stats ───────────────────────────────────────── */

export async function getDiscoveryHistory(
  orgId: number,
  limit?: number,
): Promise<DiscoveryHistoryEntry[]> {
  const params = new URLSearchParams({ org_id: String(orgId) });
  if (limit !== undefined) params.set("limit", String(limit));
  return request<DiscoveryHistoryEntry[]>(`/api/v1/discovery/history?${params.toString()}`);
}

export async function getDiscoveryStats(orgId: number): Promise<DiscoveryStats> {
  return request<DiscoveryStats>(`/api/v1/discovery/stats?org_id=${orgId}`);
}

/* ── Scope validation (mirrors backend validate_domain_pattern) ─────────── */

export function isValidDomainPattern(domain: string): boolean {
  if (!domain || !domain.trim()) return false;
  const d = domain.trim();
  // Reject bare IP addresses — they are not authorizable domain patterns.
  const ipv4Pattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
  if (ipv4Pattern.test(d)) return false;
  // Reject reserved special-use TLDs/labels.
  const finalLabel = d.replace(/^\./, "").split(".").pop()?.toLowerCase() ?? "";
  const reserved = ["localhost", "local", "invalid", "test", "example"];
  if (reserved.includes(finalLabel)) return false;
  // Must have at least one dot (single-label hosts are not authorizable).
  if (d.split(".").length < 2) return false;
  // Basic valid pattern check: optional `*.` wildcard plus dotted labels.
  const labelPattern =
    /^(?:\*\.)?[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;
  return labelPattern.test(d);
}
