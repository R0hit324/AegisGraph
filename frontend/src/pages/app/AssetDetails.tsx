/**
 * Phase 3: Asset Details page.
 *
 * Shows comprehensive metadata for a specific asset including:
 * - Asset metadata (type, value, source, timestamps)
 * - DNS records
 * - HTTP observations
 * - Port/service observations
 * - Technology fingerprints
 * - Relationships (honest placeholder — the mapping UI arrives in Phase 4+)
 *
 * All data comes from `GET /api/v1/discovery/assets/{id}` and its
 * observation sub-endpoints. Empty stays empty.
 */

import { useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  Bot,
  Globe,
  Package,
  Plug,
  Search,
  Link2,
} from "lucide-react";
import { useResource } from "@/hooks/useResource";
import {
  Badge,
  EmptyState,
  ErrorNotice,
  Panel,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
  Tabs,
  Tab,
} from "@/components/ui/Primitives";
import {
  getAsset,
  getAssetDns,
  getAssetHttp,
  getAssetPorts,
  getAssetTechnology,
} from "@/services/discoveryService";
import { describeAuthError } from "@/app/authErrors";
import type {
  AssetResponse,
  DnsObservationResponse,
  HttpObservationResponse,
  PortObservationResponse,
  TechnologyObservationResponse,
} from "@/schemas/discovery";

function assetStatusTone(status: string): "ok" | "warn" | "danger" {
  if (status === "active") return "ok";
  if (status === "retired") return "warn";
  return "danger";
}

export function AssetDetailsPage() {
  const { assetId } = useParams();

  const targetAssetId = Number(assetId);
  const validId = Number.isFinite(targetAssetId) && targetAssetId > 0;

  const loadAsset = useCallback(
    () => getAsset(targetAssetId),
    [targetAssetId],
  );
  const asset = useResource(loadAsset, targetAssetId, describeAuthError);

  const loadDns = useCallback(() => getAssetDns(targetAssetId), [targetAssetId]);
  const dns = useResource(loadDns, targetAssetId, describeAuthError);

  const loadHttp = useCallback(() => getAssetHttp(targetAssetId), [targetAssetId]);
  const http = useResource(loadHttp, targetAssetId, describeAuthError);

  const loadPorts = useCallback(() => getAssetPorts(targetAssetId), [targetAssetId]);
  const ports = useResource(loadPorts, targetAssetId, describeAuthError);

  const loadTech = useCallback(
    () => getAssetTechnology(targetAssetId),
    [targetAssetId],
  );
  const tech = useResource(loadTech, targetAssetId, describeAuthError);

  const assetData: AssetResponse | null = asset.data;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 pb-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-text">
          {assetData !== null ? assetData.value : "Asset Details"}
        </h1>
        {assetData !== null && (
          <p className="mt-1 text-[13px] text-muted">
            Asset ID: {assetData.id} · Type: {assetData.asset_type_display}
          </p>
        )}
      </div>

      {!validId && (
        <EmptyState
          icon={<Search size={24} aria-hidden />}
          title="Invalid asset reference"
          description="The URL does not point to a numeric asset ID. Pick an asset from the asset inventory instead."
          action={
            <a href="/app/discovery/assets" className="text-accent hover:underline">
              Go to Asset Inventory
            </a>
          }
        />
      )}

      {validId && asset.loading && (
        <div className="flex items-center gap-2.5 py-3 text-[13px] text-muted" role="status">
          <Spinner label="Loading asset" />
          Loading asset details…
        </div>
      )}

      {validId && !asset.loading && asset.error !== null && (
        <ErrorNotice
          title="Could not load asset"
          detail={asset.error}
        />
      )}

      {validId && !asset.loading && asset.error === null && assetData === null && (
        <EmptyState
          icon={<Package size={24} aria-hidden />}
          title="Asset not found"
          description="The asset could not be loaded. It may have been retired or you may not have permission to view it."
        />
      )}

      {assetData !== null && (
        <Tabs defaultValue="metadata">
          {/* Metadata tab */}
          <Tab value="metadata" label="Metadata">
            <Panel title="Asset metadata">
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-[12px] text-muted">Asset Type</TableCell>
                    <TableCell>{assetData.asset_type_display}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-[12px] text-muted">Value</TableCell>
                    <TableCell>{assetData.value}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-[12px] text-muted">Normalized Value</TableCell>
                    <TableCell>
                      {assetData.normalized_domain ?? assetData.normalized_ip ?? assetData.value}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-[12px] text-muted">Discovery Source</TableCell>
                    <TableCell>{assetData.discovery_source ?? "—"}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-[12px] text-muted">Confidence</TableCell>
                    <TableCell>{assetData.confidence.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-[12px] text-muted">Validation Status</TableCell>
                    <TableCell>
                      <Badge tone={assetData.is_validated ? "ok" : "neutral"}>
                        {assetData.is_validated ? "Validated" : "Not validated"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-[12px] text-muted">Asset Status</TableCell>
                    <TableCell>
                      <Badge tone={assetStatusTone(assetData.status)}>
                        {assetData.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-[12px] text-muted">First Seen</TableCell>
                    <TableCell>{new Date(assetData.first_seen).toLocaleString()}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-[12px] text-muted">Last Seen</TableCell>
                    <TableCell>{new Date(assetData.last_seen).toLocaleString()}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-[12px] text-muted">Job</TableCell>
                    <TableCell>{assetData.job_id ?? "—"}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-[12px] text-muted">Scope</TableCell>
                    <TableCell>{assetData.scope_id ?? "—"}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-[12px] text-muted">Parent Asset</TableCell>
                    <TableCell>{assetData.parent_asset_id ?? "—"}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Panel>
          </Tab>

          {/* DNS tab */}
          <Tab value="dns" label="DNS Records">
            <Panel title="DNS observations">
              {dns.loading && (
                <div className="flex items-center gap-2.5 text-[13px] text-muted" role="status">
                  <Spinner label="Loading DNS records" />
                  Loading DNS records…
                </div>
              )}

              {dns.error !== null && (
                <ErrorNotice title="Could not load DNS records" detail={dns.error} />
              )}

              {!dns.loading && dns.error === null && (dns.data ?? []).length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableCell>Record Type</TableCell>
                      <TableCell>Record Value</TableCell>
                      <TableCell>Resolved At</TableCell>
                      <TableCell>Resolution</TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(dns.data ?? []).map((record: DnsObservationResponse) => (
                      <TableRow key={record.id}>
                        <TableCell>{record.record_type}</TableCell>
                        <TableCell>{record.record_value}</TableCell>
                        <TableCell>
                          {record.resolved_at
                            ? new Date(record.resolved_at).toLocaleString()
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge tone={record.resolution_success ? "ok" : "danger"}>
                            {record.resolution_success ? "Success" : "Failed"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {!dns.loading && dns.error === null && (dns.data ?? []).length === 0 && (
                <EmptyState
                  icon={<Search size={24} aria-hidden />}
                  title="No DNS records yet"
                  description="No DNS observations have been recorded for this asset."
                />
              )}
            </Panel>
          </Tab>

          {/* HTTP tab */}
          <Tab value="http" label="HTTP Observations">
            <Panel title="HTTP observations">
              {http.loading && (
                <div className="flex items-center gap-2.5 text-[13px] text-muted" role="status">
                  <Spinner label="Loading HTTP observations" />
                  Loading HTTP observations…
                </div>
              )}

              {http.error !== null && (
                <ErrorNotice title="Could not load HTTP observations" detail={http.error} />
              )}

              {!http.loading && http.error === null && (http.data ?? []).length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableCell>Status Code</TableCell>
                      <TableCell>Final URL</TableCell>
                      <TableCell>Response Time</TableCell>
                      <TableCell>TLS</TableCell>
                      <TableCell>Page Title</TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(http.data ?? []).map((obs: HttpObservationResponse) => (
                      <TableRow key={obs.id}>
                        <TableCell>{obs.status_code ?? "—"}</TableCell>
                        <TableCell>{obs.final_url ?? "—"}</TableCell>
                        <TableCell>
                          {obs.response_time_ms !== null
                            ? `${obs.response_time_ms.toFixed(1)} ms`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge tone={obs.tls_available ? "ok" : "neutral"}>
                            {obs.tls_available ? "Yes" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell>{obs.page_title ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {!http.loading && http.error === null && (http.data ?? []).length === 0 && (
                <EmptyState
                  icon={<Globe size={24} aria-hidden />}
                  title="No HTTP observations yet"
                  description="No HTTP/HTTPS observations have been recorded for this asset."
                />
              )}
            </Panel>
          </Tab>

          {/* Ports tab */}
          <Tab value="ports" label="Port/Service Observations">
            <Panel title="Port and service observations">
              {ports.loading && (
                <div className="flex items-center gap-2.5 text-[13px] text-muted" role="status">
                  <Spinner label="Loading port observations" />
                  Loading port observations…
                </div>
              )}

              {ports.error !== null && (
                <ErrorNotice title="Could not load port observations" detail={ports.error} />
              )}

              {!ports.loading && ports.error === null && (ports.data ?? []).length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableCell>Port</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Service</TableCell>
                      <TableCell>Product</TableCell>
                      <TableCell>Version</TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(ports.data ?? []).map((obs: PortObservationResponse) => (
                      <TableRow key={obs.id}>
                        <TableCell>{obs.port}</TableCell>
                        <TableCell>
                          <Badge
                            tone={
                              obs.status === "open"
                                ? "ok"
                                : obs.status === "closed"
                                  ? "neutral"
                                  : "danger"
                            }
                          >
                            {obs.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{obs.service_name ?? "—"}</TableCell>
                        <TableCell>{obs.service_product ?? "—"}</TableCell>
                        <TableCell>{obs.service_version ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {!ports.loading && ports.error === null && (ports.data ?? []).length === 0 && (
                <EmptyState
                  icon={<Plug size={24} aria-hidden />}
                  title="No port observations yet"
                  description="No port/service observations have been recorded for this asset."
                />
              )}
            </Panel>
          </Tab>

          {/* Technology tab */}
          <Tab value="technology" label="Technology Fingerprints">
            <Panel title="Technology fingerprints">
              {tech.loading && (
                <div className="flex items-center gap-2.5 text-[13px] text-muted" role="status">
                  <Spinner label="Loading technology observations" />
                  Loading technology observations…
                </div>
              )}

              {tech.error !== null && (
                <ErrorNotice
                  title="Could not load technology observations"
                  detail={tech.error}
                />
              )}

              {!tech.loading && tech.error === null && (tech.data ?? []).length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableCell>Category</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Version</TableCell>
                      <TableCell>Confidence</TableCell>
                      <TableCell>Primary</TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(tech.data ?? []).map((obs: TechnologyObservationResponse) => (
                      <TableRow key={obs.id}>
                        <TableCell>{obs.category}</TableCell>
                        <TableCell>{obs.name ?? "—"}</TableCell>
                        <TableCell>{obs.version ?? "—"}</TableCell>
                        <TableCell>{obs.confidence.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge tone={obs.is_primary ? "ok" : "neutral"}>
                            {obs.is_primary ? "Primary" : "Secondary"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {!tech.loading && tech.error === null && (tech.data ?? []).length === 0 && (
                <EmptyState
                  icon={<Bot size={24} aria-hidden />}
                  title="No technology observations yet"
                  description="No technology fingerprint observations have been recorded for this asset."
                />
              )}
            </Panel>
          </Tab>

          {/* Relationships tab */}
          <Tab value="relationships" label="Asset Relationships">
            <Panel title="Asset relationships">
              <EmptyState
                icon={<Link2 size={24} aria-hidden />}
                title="Relationships not yet displayed"
                description="Asset relationship mapping is available in Phase 4+."
              />
            </Panel>
          </Tab>
        </Tabs>
      )}
    </div>
  );
}
