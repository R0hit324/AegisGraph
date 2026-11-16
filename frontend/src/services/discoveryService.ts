/** Phase 3: Attack Surface Discovery Engine API client. */

import type { ResourceResult } from "@/hooks/useResource";
import type { AssetResponse, AssetFilter, AssetSearch } from "@/schemas/discovery";
import type { DiscoveryJobStatus, DiscoveryJobCreate, DiscoveryJobResponse } from "@/schemas/discovery";
import type { DiscoveryStats, DiscoveryHistoryEntry } from "@/schemas/discovery";
import type { DnsObservationResponse, HttpObservationResponse, PortObservationResponse, TechnologyObservationResponse } from "@/schemas/discovery";
import type { Scope } from "@/types/api";

import { getApiBaseUrl, request } from "./apiClient";

/* ── Job endpoints ──────────────────────────────────────────────────────── */

export async function listDiscoveryJobs(
  orgId: number,
  statusFilter?: string,
): Promise<ResourceResult<DiscoveryJobStatus[]>> {
  return request<DiscoveryJobStatus[]>(`/api/v1/discovery/jobs?org_id=${orgId}${statusFilter ? `&status=${statusFilter}` : ""}`);
}

export async function startDiscoveryJob(
  job: DiscoveryJobCreate,
): Promise<ResourceResult<DiscoveryJobResponse>> {
  return request<DiscoveryJobResponse>("/api/v1/discovery/jobs", {
    method: "POST",
    body: job,
  });
}

export async function cancelDiscoveryJob(
  jobId: number,
): Promise<ResourceResult<void>> {
  return request<void>(`/api/v1/discovery/jobs/${jobId}/cancel`, {
    method: "POST",
  });
}

/* ── Asset endpoints ────────────────────────────────────────────────────── */

export async function listAssets(
  orgId: number,
  filter?: AssetFilter,
): Promise<ResourceResult<AssetResponse[]>> {
  let params = `org_id=${orgId}`;
  if (filter) {
    if (filter.asset_type) params += `&asset_type=${filter.asset_type}`;
    if (filter.status) params += `&status=${filter.status}`;
    if (filter.is_validated !== undefined) params += `&is_validated=${filter.is_validated}`;
    if (filter.search) params += `&search=${filter.search}`;
  }
  return request<AssetResponse[]>(`/api/v1/discovery/assets?${params}`);
}

export async function getAsset(
  assetId: number,
): Promise<ResourceResult<AssetResponse>> {
  return request<AssetResponse>(`/api/v1/discovery/assets/${assetId}`);
}

export async function getAssetDns(
  assetId: number,
): Promise<ResourceResult<DnsObservationResponse[]>> {
  return request<DnsObservationResponse[]>(
    `/api/v1/discovery/assets/${assetId}/dns`,
  );
}

export async function getAssetHttp(
  assetId: number,
): Promise<ResourceResult<HttpObservationResponse[]>> {
  return request<HttpObservationResponse[]>(
    `/api/v1/discovery/assets/${assetId}/http`,
  );
}

export async function getAssetPorts(
  assetId: number,
): Promise<ResourceResult<PortObservationResponse[]>> {
  return request<PortObservationResponse[]>(
    `/api/v1/discovery/assets/${assetId}/ports`,
  );
}

export async function getAssetTechnology(
  assetId: number,
): Promise<ResourceResult<TechnologyObservationResponse[]>> {
  return request<TechnologyObservationResponse[]>(
    `/api/v1/discovery/assets/${assetId}/technology`,
  );
}

/* ── Discovery history and stats ───────────────────────────────────────── */

export async function getDiscoveryHistory(
  orgId: number,
  limit?: number,
): Promise<ResourceResult<DiscoveryHistoryEntry[]>> {
  const param = limit !== undefined ? `&limit=${limit}` : "";
  return request<DiscoveryHistoryEntry[]>(
    `/api/v1/discovery/history?org_id=${orgId}${param}`,
  );
}

export async function getDiscoveryStats(
  orgId: number,
): Promise<ResourceResult<DiscoveryStats>> {
  return request<DiscoveryStats>(`/api/v1/discovery/stats?org_id=${orgId}`);
}

/* ── Scope validation (mirrors backend validate_domain_pattern) ─────────── */

export function isValidDomainPattern(domain: string): boolean {
  // Simple client-side check; backend re-validates strictly
  if (!domain || !domain.trim()) return false;
  const d = domain.trim();
  if (d === "") return false;
  // Reject IP addresses
  const ipv4Pattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
  if (ipv4Pattern.test(d)) return false;
  // Reject reserved TLDs
  const finalLabel = d.replace(/^\./, "").rsplit(".", 1)[-1]?.toLowerCase() ?? "";
  const reserved = ["localhost", "local", "invalid", "test", "example"];
  if (reserved.includes(finalLabel)) return false;
  // Must have at least one dot
  if (".\n" + d).split(".").length < 2 return false;
  // Basic valid pattern check
  const labelPattern = /^(?:\*\.)?[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;
  return labelPattern.test(d);
}