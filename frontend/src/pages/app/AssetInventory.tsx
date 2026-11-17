/**
 * Phase 3: Asset Inventory page.
 *
 * Provides search, filters, asset-type classification, status indicators,
 * confidence indicators, discovery source, first-seen and last-seen
 * information for all assets in the organization.
 *
 * HONEST-DATA RULE: every row comes from `GET /api/v1/discovery/assets`;
 * empty stays empty.
 */

import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package } from "lucide-react";
import { OrgPicker } from "@/pages/app/OrgPicker";
import { useResource } from "@/hooks/useResource";
import {
  Badge,
  Button,
  EmptyState,
  ErrorNotice,
  Field,
  Panel,
  SelectInput,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
  TextInput,
} from "@/components/ui/Primitives";
import { listAssets } from "@/services/discoveryService";
import { listOrganizations } from "@/services/organizationsService";
import { describeAuthError } from "@/app/authErrors";
import type { AssetFilter, AssetResponse } from "@/schemas/discovery";

const ASSET_TYPES: Array<{ value: string; label: string }> = [
  { value: "", label: "All Types" },
  { value: "domain", label: "Domain" },
  { value: "subdomain", label: "Subdomain" },
  { value: "ipv4", label: "IPv4" },
  { value: "ipv6", label: "IPv6" },
  { value: "http_service", label: "HTTP Service" },
  { value: "https_service", label: "HTTPS Service" },
  { value: "network_service", label: "Network Service" },
];

const ASSET_STATUSES: Array<{ value: string; label: string }> = [
  { value: "", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "retired", label: "Retired" },
  { value: "out_of_scope", label: "Out of Scope" },
];

function statusTone(status: string): "ok" | "warn" | "danger" | "neutral" {
  if (status === "active") return "ok";
  if (status === "retired") return "warn";
  if (status === "out_of_scope") return "neutral";
  return "danger";
}

export function AssetInventoryPage() {
  const navigate = useNavigate();

  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState<AssetFilter>({});

  const loadOrgs = useCallback(() => listOrganizations(), []);
  const orgs = useResource(loadOrgs, 0, describeAuthError);

  const loadAssets = useCallback(
    () =>
      selectedOrgId === null
        ? Promise.resolve<AssetResponse[]>([])
        : listAssets(selectedOrgId, filter),
    [selectedOrgId, filter],
  );
  const assetKey = `${selectedOrgId ?? "none"}#${JSON.stringify(filter)}#${reloadKey}`;
  const assets = useResource(loadAssets, assetKey, describeAuthError);

  const assetList = assets.loading || assets.error !== null ? [] : (assets.data ?? []);

  const updateFilter = useCallback((patch: AssetFilter) => {
    setFilter((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetFilter = useCallback(() => {
    setFilter({});
    setReloadKey((k) => k + 1);
  }, []);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 pb-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-text">Asset Inventory</h1>
        <p className="mt-1 text-[13px] text-muted">
          All discovered assets for your organization. Each asset is tied to an
          authorized scope and preserves historical observation data including
          first-seen/last-seen timestamps and confidence scores.
        </p>
      </div>

      <OrgPicker
        orgs={orgs.data ?? []}
        selectedId={selectedOrgId}
        loading={orgs.loading}
        onSelect={(id) => setSelectedOrgId(id)}
      />

      {selectedOrgId !== null && (
        <Panel title="Filters" description="Filter assets by type, status, and validation">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Asset type" htmlFor="filter-asset-type">
              <SelectInput
                id="filter-asset-type"
                value={filter.asset_type ?? ""}
                onChange={(e) =>
                  updateFilter({
                    asset_type: e.target.value === "" ? undefined : e.target.value,
                  })
                }
              >
                {ASSET_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </SelectInput>
            </Field>

            <Field label="Status" htmlFor="filter-status">
              <SelectInput
                id="filter-status"
                value={filter.status ?? ""}
                onChange={(e) =>
                  updateFilter({
                    status: e.target.value === "" ? undefined : e.target.value,
                  })
                }
              >
                {ASSET_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </SelectInput>
            </Field>

            <Field label="Validated" htmlFor="filter-validated">
              <SelectInput
                id="filter-validated"
                value={filter.is_validated === undefined ? "" : String(filter.is_validated)}
                onChange={(e) =>
                  updateFilter({
                    is_validated:
                      e.target.value === "" ? undefined : e.target.value === "true",
                  })
                }
              >
                <option value="">All</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </SelectInput>
            </Field>

            <Field label="Search" htmlFor="filter-search">
              <TextInput
                id="filter-search"
                type="text"
                placeholder="Search by value or normalized form…"
                value={filter.search ?? ""}
                onChange={(e) =>
                  updateFilter({ search: e.target.value.trim() === "" ? undefined : e.target.value.trim() })
                }
              />
            </Field>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Button variant="outline" onClick={resetFilter}>
              Reset
            </Button>
            <Button onClick={() => setReloadKey((k) => k + 1)}>Apply</Button>
          </div>
        </Panel>
      )}

      <Panel
        title="Assets"
        description="All discovered assets with classification, status and confidence"
      >
        {selectedOrgId === null && (
          <div className="text-[13px] text-muted">
            Select an organization above to view its assets.
          </div>
        )}

        {selectedOrgId !== null && assets.loading && (
          <div
            className="flex items-center gap-2.5 py-3 text-[13px] text-muted"
            role="status"
          >
            <Spinner label="Loading assets" />
            Loading assets…
          </div>
        )}

        {selectedOrgId !== null && !assets.loading && assets.error !== null && (
          <ErrorNotice
            title="Could not load assets"
            detail={assets.error}
            onRetry={() => setReloadKey((k) => k + 1)}
          />
        )}

        {selectedOrgId !== null && !assets.loading && assets.error === null && assetList.length === 0 && (
          <EmptyState
            icon={<Package size={24} aria-hidden />}
            title="No assets discovered yet"
            description="No assets have been discovered for this organization yet. Start a discovery job to begin asset collection."
            action={
              <Button variant="outline" onClick={() => navigate("/app/discovery/config")}>
                Start Discovery Job
              </Button>
            }
          />
        )}

        {selectedOrgId !== null && assetList.length > 0 && (
          <>
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
                {assetList.map((asset: AssetResponse) => (
                  <TableRow key={asset.id}>
                    <TableCell>
                      <Badge tone="neutral">{asset.value}</Badge>
                    </TableCell>
                    <TableCell>{asset.asset_type_display ?? asset.asset_type}</TableCell>
                    <TableCell>
                      {asset.normalized_domain ?? asset.normalized_ip ?? asset.value}
                    </TableCell>
                    <TableCell>
                      <Badge tone={statusTone(asset.status)}>{asset.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge tone={asset.is_validated ? "ok" : "neutral"}>
                        {asset.is_validated ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell>{asset.confidence.toFixed(2)}</TableCell>
                    <TableCell>{asset.discovery_source ?? "—"}</TableCell>
                    <TableCell>{new Date(asset.first_seen).toLocaleString()}</TableCell>
                    <TableCell>{new Date(asset.last_seen).toLocaleString()}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="small"
                        onClick={() => navigate(`/app/discovery/asset-details/${asset.id}`)}
                        title={`View details for ${asset.value}`}
                      >
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-3 text-[11px] text-faint">
              Showing {assetList.length} asset{assetList.length === 1 ? "" : "s"}
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
