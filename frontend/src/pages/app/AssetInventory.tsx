/** Phase 3: Asset Inventory page.

Provides search, filters, asset-type classification, status indicators,
confidence indicators, discovery source, first-seen and last-seen
information for all assets in the organization.
*/

import { useCallback, useState, useEffect } from "react";
import {
  Button,
  EmptyState,
  ErrorNotice,
  Field,
  Panel,
  Input,
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
  Tab,
  Tabs,
  Spinner,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  Badge,
} from "@/components/ui/Primitives";
import { useResource } from "@/hooks/useResource";
import { useSession } from "@/app/useSession";
import { listAssets, getDiscoveryStats } from "@/services/discoveryService";
import { describeAuthError } from "@/app/authErrors";
import type { AssetFilter, AssetResponse } from "@/schemas/discovery";

export function AssetInventoryPage() {
  const session = useSession();
  const myUserId = session.user?.id ?? -1;

  // Org selector
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [orgs, setOrgs] = useState<Array<{ id: number; name: string }>>([]);
  const loadOrgs = useCallback(async () => {
    try {
      const { listOrganizations } = await import("@/services/organizationsService");
      const data = await listOrganizations();
      setOrgs(data.data ?? []);
    } catch (e) {
      setOrgs([]);
    }
  }, []);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  const handleOrgSelect = useCallback(
    (orgId: number | null) => {
      setSelectedOrgId(orgId);
    },
    [],
  );

  useEffect(() => {
    if (selectedOrgId === null && orgs.length > 0) {
      setSelectedOrgId(orgs[0].id);
    }
  }, [orgs, selectedOrgId]);

  // Filter state
  const [filter, setFilter] = useState<AssetFilter>({});
  const [filterOpen, setFilterOpen] = useState(false);

  // Assets
  const [assets, setAssets] = useState<ResourceResult<AssetResponse[]>>({
    data: [],
    loading: true,
    error: null,
  });

  const loadAssets = useCallback(
    (orgId: number) =>
      setAssets(
        useResource(
          () => listAssets(orgId, filter),
          `${orgId}#${JSON.stringify(filter)}`,
          describeAuthError,
        ),
      ),
    [filter, describeAuthError],
  );

  useEffect(() => {
    if (selectedOrgId !== null) {
      loadAssets(selectedOrgId);
    }
  }, [selectedOrgId, loadAssets]);

  // Compute stats
  const totalAssets = assets.data?.length ?? 0;
  const assetTypes = useMemo(() => {
    const types = new Set<string>();
    assets.data?.forEach((a) => types.add(a.asset_type));
    return types;
  }, [assets.data]);

  // Filter panel
  const applyFilter = useCallback(
    (newFilter: AssetFilter) => {
      setFilter(newFilter);
      setReloadKey((k) => k + 1);
    },
    [],
  );

  const resetFilter = useCallback(() => {
    setFilter({});
    setReloadKey((k) => k + 1);
  }, []);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 pb-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-text">
          Asset Inventory
        </h1>
        <p className="mt-1 text-[13px] text-muted">
          All discovered assets for your organization. Each asset is tied to an
          authorized scope and preserves historical observation data including
          first-seen/last-seen timestamps and confidence scores.
        </p>
      </div>

      {/* Org selector */}
      <Panel
        title="Organization"
        description="Select an organization to view its assets"
      >
        {selectedOrgId === null && (
          <div className="flex items-center gap-2.5 py-3 text-[13px] text-muted">
            <Select
              onValueChange={handleOrgSelect}
              placeholder="Select organization"
            >
              <SelectTrigger>
                <SelectValue placeholder="Select organization" />
              </SelectTrigger>
              <SelectContent>
                {orgs.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {selectedOrgId !== null && (
          <div className="flex items-center gap-2.5 py-3 text-[13px] text-muted">
            <Badge tone="neutral">
              {orgs.find((o) => o.id === selectedOrgId)?.name ?? "Unknown"}
            </Badge>
          </div>
        )}
        {selectedOrgId === null && orgs.length > 0 && (
          <ErrorNotice title="No organizations found." />
        )}
      </Panel>

      {/* Filter panel */}
      {selectedOrgId !== null && (
        <Panel
          title="Filters"
          description="Filter assets by type, status, and validation"
        >
          <Form
            onSubmit={(e: React.FormEvent) => e.preventDefault()}
            className="space-y-3"
          >
            <Field
              label="Asset type"
              htmlFor="asset-type"
            >
              <Select
                onValueChange={(val: string) => {
                  applyFilter({ asset_type: val });
                }}
                disabled={false}
              >
                <SelectTrigger>
                  <SelectValue notchedPlaceholder="Asset type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Types</SelectItem>
                  <SelectItem value="domain">Domain</SelectItem>
                  <SelectItem value="subdomain">Subdomain</SelectItem>
                  <SelectItem value="ipv4">IPv4</SelectItem>
                  <SelectItem value="ipv6">IPv6</SelectItem>
                  <SelectItem value="http_service">HTTP Service</SelectItem>
                  <SelectItem value="https_service">HTTPS Service</SelectItem>
                  <SelectItem value="network_service">Network Service</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Status"
              htmlFor="asset-status"
            >
              <Select
                onValueChange={(val: string) => {
                  applyFilter({ status: val });
                }}
              >
                <SelectTrigger>
                  <SelectValue notchedPlaceholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                  <SelectItem value="out_of_scope">Out of Scope</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Validated"
              htmlFor="asset-validated"
            >
              <Select
                onValueChange={(val: string) => {
                  applyFilter({ is_validated: val === "true" });
                }}
              >
                <SelectTrigger>
                  <SelectValue notchedPlaceholder="Validated" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Search"
              htmlFor="asset-search"
            >
              <Input
                id="asset-search"
                type="text"
                placeholder="Search by value or normalized form..."
                onChange={(e) =>
                  applyFilter({ search: e.target.value.trim() })
                }
                disabled={false}
                placeholder="e.g., example.com or 1.2.3.4"
              />
            </Field>

            <div>
              <Button type="submit" variant="outline" onClick={resetFilter}>
                Reset
              </Button>
              <Button type="submit" variant="primary" onClick={applyFilter}>
                Apply
              </Button>
            </div>
          </Form>
        </Panel>
      )}

      {/* Assets table / list */}
      <Panel
        title="Assets"
        description="All discovered assets with classification, status and confidence"
      >
        {selectedOrgId === null && orgs.length > 0 ? (
          <div className="text-muted text-[13px]">
            Select an organization above to view its assets.
          </div>
        ) : assets.loading && (
          <div className="text-muted text-[13px]">Loading assets…</div>
        )}

        {assets.error !== null && (
          <ErrorNotice title="Could not load assets" detail={assets.error} />
        )}

        {/* Empty state */}
        {!assets.loading && !assets.error && (assets.data ?? []).length === 0 && (
          <EmptyState
            icon={<Badge tone="neutral" className="text-2xl"}>📦</Badge>
            title="No assets discovered yet"
            description={
              selectedOrgId !== null
                ? "No assets have been discovered for this organization yet. Start a discovery job to begin asset collection."
                : "Select an organization above to begin."
            }
            action={
              selectedOrgId !== null ? (
                <Button
                  variant="outline"
                  onClick={() => window.location.href = "/app/discovery-config"
                }>
                  Start Discovery Job
                </Button>
              ) : null
            }
          />
        )}

        {/* Assets table */}
        {!assets.loading && !assets.error && (assets.data ?? []).length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell>Asset</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Value</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Validated</TableCell>
                <TableCell>Confidence</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>First Seen</TableCell>
                <TableCell>Last Seen</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(assets.data ?? []).map((asset: AssetResponse) => {
                // Determine human-readable display type
                typeMap: {
                  domain: "Domain",
                  subdomain: "Subdomain",
                  ipv4: "IPv4 Address",
                  ipv6: "IPv6 Address",
                  http_service: "HTTP Service",
                  https_service: "HTTPS Service",
                  network_service: "Network Service",
                };
                const typeLabels: Record<string, string> = {
                  domain: "Domain",
                  subdomain: "Subdomain",
                  ipv4: "IPv4 Address",
                  ipv6: "IPv6 Address",
                  http_service: "HTTP Service",
                  https_service: "HTTPS Service",
                  network_service: "Network Service",
                };
                const typeDisplay =
                  typeLabels[asset.asset_type] ?? asset.asset_type;

                const confidenceBar =
                  asset.confidence > 0
                    ? `width: ${Math.round(asset.confidence * 100)}%`
                    : "width: 0%";

                return (
                  <TableRow key={asset.id}>
                    <TableCell>
                      <Badge tone="neutral" className="min-w-[60px]">
                        {asset.value}
                      </Badge>
                    </TableCell>
                    <TableCell>{typeDisplay}</TableCell>
                    <TableCell>
                      {asset.normalized_domain ?? asset.normalized_ip ?? asset.value}
                    </TableCell>
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
                    <TableCell>
                      <Badge
                        tone={asset.is_validated ? "ok" : "muted"}
                        className="min-w-[35px]"
                      >
                        {asset.is_validated ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span style={{ width: Math.round(asset.confidence * 100) + "%" }}>
                        {asset.confidence.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell>{asset.discovery_source || "—"}</TableCell>
                    <TableCell>
                      {asset.first_seen ? new Date(asset.first_seen).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>
                      {asset.last_seen ? new Date(asset.last_seen).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="small"
                        onClick={() => {
                          // Navigate to asset details
                          window.location.href = `/app/asset-details/${asset.id}`;
                        }}
                      >
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Pagination info */}
          <div className="mt-3 text-[11px] text-faint">
            Showing {assets.data?.length ?? 0} assets
          </div>
        )}
      </Panel>
    </div>
  );
}