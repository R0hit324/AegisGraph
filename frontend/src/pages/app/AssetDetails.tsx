/** Phase 3: Asset Details page.

Shows comprehensive metadata for a specific asset including:
- Asset metadata (type, value, source, timestamps)
- DNS records
- HTTP observations
- Port/service observations
- Technology fingerprints
- Discovery history and evidence
- Relationships to other assets
*/

import { useCallback, useState, useEffect } from "react";
import {
  Button,
  EmptyState,
  ErrorNotice,
  Tabs,
  Tab,
  Spinner,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  Badge,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/Primitives";
import { useResource } from "@/hooks/useResource";
import { useSession } from "@/app/useSession";
import { useParams } from "react-router-dom";
import {
  getAsset,
  getAssetDns,
  getAssetHttp,
  getAssetPorts,
  getAssetTechnology,
} from "@/services/discoveryService";
import { describeAuthError } from "@/app/authErrors";
import type { AssetResponse } from "@/schemas/discovery";

export function AssetDetailsPage() {
  const { assetId } = useParams();
  const session = useSession();
  const myUserId = session.user?.id ?? -1;

  const targetAssetId = Number(assetId);

  // Asset
  const [asset, setAsset] = useState<AssetResponse | null>(null);
  const loadAsset = useCallback(
    (id: number) =>
      setAsset(
        useResource(
          () => getAsset(id),
          id,
          describeAuthError,
        ),
      ),
    [],
  );

  useEffect(() => {
    if (targetAssetId > 0) {
      loadAsset(targetAssetId);
    }
  }, [targetAssetId, loadAsset]);

  // DNS observations
  const [dns, setDns] = useState<ResourceResult<any>>({
    data: [],
    loading: true,
    error: null,
  });
  const loadDns = useCallback(
    (id: number) =>
      setDns(
        useResource(
          () => getAssetDns(id),
          id,
          describeAuthError,
        ),
      ),
    [],
  );
  useEffect(() => {
    if (targetAssetId > 0) {
      loadDns(targetAssetId);
    }
  }, [targetAssetId, loadDns]);

  // HTTP observations
  const [http, setHttp] = useState<ResourceResult<any>>({
    data: [],
    loading: true,
    error: null,
  });
  const loadHttp = useCallback(
    (id: number) =>
      setHttp(
        useResource(
          () => getAssetHttp(id),
          id,
          describeAuthError,
        ),
      ),
    [],
  );
  useEffect(() => {
    if (targetAssetId > 0) {
      loadHttp(targetAssetId);
    }
  }, [targetAssetId, loadHttp]);

  // Port observations
  const [ports, setPorts] = useState<ResourceResult<any>>({
    data: [],
    loading: true,
    error: null,
  });
  const loadPorts = useCallback(
    (id: number) =>
      setPorts(
        useResource(
          () => getAssetPorts(id),
          id,
          describeAuthError,
        ),
      ),
    [];
  );
  useEffect(() => {
    if (targetAssetId > 0) {
      loadPorts(targetAssetId);
    }
  }, [targetAssetId, loadPorts]);

  // Technology observations
  const [tech, setTech] = useState<ResourceResult<any>>({
    data: [],
    loading: true,
    error: null,
  });
  const loadTech = useCallback(
    (id: number) =>
      setTech(
        useResource(
          () => getAssetTechnology(id),
          id,
          describeAuthError,
        ),
      ),
    [];
  );
  useEffect(() => {
    if (targetAssetId > 0) {
      loadTech(targetAssetId);
    }
  }, [targetAssetId, loadTech]);

  // If asset ID changed, reload everything
  useEffect(() => {
    if (targetAssetId > 0) {
      loadAsset(targetAssetId);
      loadDns(targetAssetId);
      loadHttp(targetAssetId);
      loadPorts(targetAssetId);
      loadTech(targetAssetId);
    }
  }, [targetAssetId, loadAsset, loadDns, loadHttp, loadPorts, loadTech]);

  // If asset loaded, verify permissions
  useEffect(() => {
    if (asset) {
      // Check org access - will be handled in components
    }
  }, [asset]);

  // Compute breadcrumbs and title
  const assetTitle = asset
    ? `${asset.asset_type === "domain"
      ? asset.value
      : asset.asset_type === "subdomain"
        ? asset.value
        : asset.value}`
    : "Asset Details";

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 pb-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-text">
          {assetTitle}
        </h1>
        {asset && (
          <p className="mt-1 text-[13px] text-muted">
            Asset ID: {asset.id} | Type: {asset.asset_type_display ?? asset.asset_type}
          </p>
        )}
      </div>

      {asset === null && (
        <EmptyState
          icon={<Badge tone="neutral" className="text-2xl"}>📦</Badge>
          title="Asset not found"
          description={
            "The asset could not be loaded. It may have been retired or " +
            "you may not have permission to view it."
          }
        />
      )}

      {asset && asset.id > 0 && (
        <Tabs defaultValue="metadata" className="my-4">
          {/* Metadata tab */}
          <Tab value="metadata" label="Metadata">
            <Panel>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell>Asset Type</TableCell>
                    <TableCell>{asset.asset_type_display ?? asset.asset_type}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Normalized Value</TableCell>
                    <TableCell>
                      {asset.normalized_domain ?? asset.normalized_ip ?? asset.value}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Discovery Source</TableCell>
                    <TableCell>{asset.discovery_source || "—"}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Confidence</TableCell>
                    <TableCell>
                      <span style={{ width: `${asset.confidence * 100}%` }}>
                        {asset.confidence.toFixed(2)}
                      </span>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Validation Status</TableCell>
                    <TableCell>
                      <Badge
                        tone={asset.is_validated ? "ok" : "muted"}
                        className="min-w-[35px]"
                      >
                        {asset.is_validated ? "Validated" : "Not validated"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Asset Status</TableCell>
                    <TableCell>
                      <Badge
                        tone={
                          asset.status === "active"
                            ? "ok"
                            : asset.status === "retired"
                              ? "muted"
                              : "error"
                        }
                      >
                        {asset.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>First Seen</TableCell>
                    <TableCell>
                      {asset.first_seen ? new Date(asset.first_seen).toLocaleString() : "—"}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Last Seen</TableCell>
                    <TableCell>
                      {asset.last_seen ? new Date(asset.last_seen).toLocaleString() : "—"}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Job</TableCell>
                    <TableCell>{asset.job_id ?? "—"}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Scope</TableCell>
                    <TableCell>{asset.scope_id ?? "—"}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Parent Asset</TableCell>
                    <TableCell>{asset.parent_asset_id ?? "—"}</TableCell>
                  </TableRow>
                </Table>
              </Table>
            </Panel>
          </Tab>

          {/* DNS tab */}
          <Tab value="dns" label="DNS Records">
            <Panel>
              {dns.loading && (
                <div className="text-muted text-[13px]">Loading DNS records…</div>
              )}

              {dns.error !== null && (
                <ErrorNotice title="Could not load DNS records" detail={dns.error} />
              )}

              {!dns.loading && !dns.error && (dns.data ?? []).length > 0 && (
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
                    {(dns.data ?? []).map((record: any) => (
                      <TableRow key={record.id}>
                        <TableCell>{record.record_type}</TableCell>
                        <TableCell>{record.record_value}</TableCell>
                        <TableCell>
                          {record.resolved_at
                            ? new Date(record.resolved_at).toLocaleString()
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            tone={record.resolution_success ? "ok" : "error"}
                          >
                            {record.resolution_success ? "Success" : "Failed"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {!dns.loading && !dns.error && (dns.data ?? []).length === 0 && (
                <EmptyState
                  icon={<Badge tone="neutral" className="text-2xl"}>🔍</Badge>
                  title="No DNS records yet"
                  description="No DNS observations have been recorded for this asset."
                />
              )}
            </Panel>
          </Tab>

          {/* HTTP tab */}
          <Tab value="http" label="HTTP Observations">
            <Panel>
              {http.loading && (
                <div className="text-muted text-[13px]">Loading HTTP observations…</div>
              )}

              {http.error !== null && (
                <ErrorNotice title="Could not load HTTP observations" detail={http.error} />
              )}

              {!http.loading && !http.error && (http.data ?? []).length > 0 && (
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
                    {(http.data ?? []).map((obs: any) => (
                      <TableRow key={obs.id}>
                        <TableCell>{obs.status_code ?? "—"}</TableCell>
                        <TableCell>{obs.final_url ?? "—"}</TableCell>
                        <TableCell>
                          {obs.response_time_ms
                            ? `${obs.response_time_ms.toFixed(1)} ms`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge tone={obs.tls_available ? "ok" : "muted"}>
                            {obs.tls_available ? "Yes" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {obs.page_title ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {!http.loading && !http.error && (http.data ?? []).length === 0 && (
                <EmptyState
                  icon={<Badge tone="neutral" className="text-2xl"}>🌐</Badge>
                  title="No HTTP observations yet"
                  description="No HTTP/HTTPS observations have been recorded for this asset."
                />
              )}
            </Panel>
          </Tab>

          {/* Ports tab */}
          <Tab value="ports" label="Port/Service Observations">
            <Panel>
              {ports.loading && (
                <div className="text-muted text-[13px]">Loading port observations…</div>
              )}

              {ports.error !== null && (
                <ErrorNotice title="Could not load port observations" detail={ports.error} />
              )}

              {!ports.loading && !ports.error && (ports.data ?? []).length > 0 && (
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
                    {(ports.data ?? []).map((obs: any) => (
                      <TableRow key={obs.id}>
                        <TableCell>{obs.port}</TableCell>
                        <TableCell>
                          <Badge
                            tone={obs.status === "open" ? "ok" : obs.status === "closed" ? "muted" : "error"}
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

              {!ports.loading && !ports.error && (ports.data ?? []).length === 0 && (
                <EmptyState
                  icon={<Badge tone="neutral" className="text-2xl"}>🔌</Badge>
                  title="No port observations yet"
                  description="No port/service observations have been recorded for this asset."
                />
              )}
            </Panel>
          </Tab>

          {/* Technology tab */}
          <Tab value="technology" label="Technology Fingerprints">
            <Panel>
              {tech.loading && (
                <div className="text-muted text-[13px]">Loading technology observations…</div>
              )}

              {tech.error !== null && (
                <ErrorNotice title="Could not load technology observations" detail={tech.error} />
              )}

              {!tech.loading && !tech.error && (tech.data ?? []).length > 0 && (
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
                    {(tech.data ?? []).map((obs: any) => (
                      <TableRow key={obs.id}>
                        <TableCell>{obs.category}</TableCell>
                        <TableCell>{obs.name ?? "—"}</TableCell>
                        <TableCell>{obs.version ?? "—"}</TableCell>
                        <TableCell>
                          <span style={{ width: `${obs.confidence * 100}%` }}>
                            {obs.confidence.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge tone={obs.is_primary ? "ok" : "muted"}>
                            {obs.is_primary ? "Primary" : "Secondary"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {!tech.loading && !tech.error && (tech.data ?? []).length === 0 && (
                <EmptyState
                  icon={<Badge tone="neutral" className="text-2xl"}>🤖</Badge>
                  title="No technology observations yet"
                  description="No technology fingerprint observations have been recorded for this asset."
                />
              )}
            </Panel>
          </Tab>

          {/* Relationships tab */}
          <Tab value="relationships" label="Asset Relationships">
            <Panel>
              {/* Would show incoming/outgoing relationships */}
              <EmptyState
                icon={<Badge tone="neutral" className="text-2xl"}>🔗</Badge>
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