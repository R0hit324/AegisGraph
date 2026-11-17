/**
 * Phase 3: Attack Surface Discovery Engine Dashboard.
 *
 * Displays real database-backed values from the discovery endpoints:
 * - Asset totals and per-type breakdown (`GET /discovery/stats`)
 * - Job states and counts (`GET /discovery/jobs`)
 * - Recent discovery activity (`GET /discovery/history`)
 *
 * HONEST-DATA RULE: empty stays empty; no invented progress or filler rows.
 */

import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Hourglass, Package, Radar, ScrollText } from "lucide-react";
import { OrgPicker } from "@/pages/app/OrgPicker";
import { useResource } from "@/hooks/useResource";
import {
  Badge,
  Button,
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
  getDiscoveryHistory,
  getDiscoveryStats,
  listDiscoveryJobs,
} from "@/services/discoveryService";
import { listOrganizations } from "@/services/organizationsService";
import { describeAuthError } from "@/app/authErrors";
import type {
  DiscoveryHistoryEntry,
  DiscoveryJobStatus,
  DiscoveryStats,
} from "@/schemas/discovery";

function jobStateTone(state: string): "ok" | "warn" | "danger" | "neutral" {
  if (state === "completed") return "ok";
  if (state === "running") return "warn";
  if (state === "failed") return "danger";
  return "neutral";
}

export function DiscoveryDashboard() {
  const navigate = useNavigate();

  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeTab, setActiveTab] = useState("assets");

  const loadOrgs = useCallback(() => listOrganizations(), []);
  const orgs = useResource(loadOrgs, 0, describeAuthError);

  // Default to the first organization during render — no effect needed.
  const fallbackOrgId =
    orgs.data !== null && orgs.data.length > 0 ? orgs.data[0].id : null;
  const activeOrgId = selectedOrgId ?? fallbackOrgId;

  const orgKey = `${activeOrgId ?? "none"}#${reloadKey}`;

  const loadStats = useCallback(
    () =>
      activeOrgId === null
        ? Promise.resolve<DiscoveryStats | null>(null)
        : getDiscoveryStats(activeOrgId),
    [activeOrgId],
  );
  const stats = useResource(loadStats, orgKey, describeAuthError);

  const loadJobs = useCallback(
    () =>
      activeOrgId === null
        ? Promise.resolve<DiscoveryJobStatus[]>([])
        : listDiscoveryJobs(activeOrgId),
    [activeOrgId],
  );
  const jobs = useResource(loadJobs, orgKey, describeAuthError);

  const loadHistory = useCallback(
    () =>
      activeOrgId === null
        ? Promise.resolve<DiscoveryHistoryEntry[]>([])
        : getDiscoveryHistory(activeOrgId, 20),
    [activeOrgId],
  );
  const history = useResource(loadHistory, orgKey, describeAuthError);

  const assetsByType = stats.data?.assets_by_type ?? {};
  const totalAssets = stats.data?.total_assets ?? 0;
  const validatedCount = stats.data?.validated_assets ?? 0;
  const activeJobsCount = stats.data?.active_jobs ?? 0;
  const totalJobsCount = stats.data?.total_jobs ?? 0;

  const jobList = jobs.loading || jobs.error !== null ? [] : (jobs.data ?? []);
  const historyList =
    history.loading || history.error !== null ? [] : (history.data ?? []);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 pb-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-text">
          Discovery Dashboard
        </h1>
        <p className="mt-1 text-[13px] text-muted">
          Authorized asset inventory and active discovery jobs within your
          organization’s scopes.
        </p>
      </div>

      <Panel
        title="Organization"
        description="Select an organization to view its discovery data"
      >
        <OrgPicker
          orgs={orgs.data ?? []}
          selectedId={activeOrgId}
          loading={orgs.loading}
          onSelect={(id) => setSelectedOrgId(id)}
        />
      </Panel>

      <Panel title="Statistics" description="Real-time counts from the database">
        {activeOrgId === null ? (
          <div className="text-[13px] text-muted">
            Select an organization to see statistics.
          </div>
        ) : stats.loading ? (
          <div className="flex items-center gap-2.5 py-3 text-[13px] text-muted" role="status">
            <Spinner label="Loading statistics" />
            Loading asset statistics…
          </div>
        ) : stats.error !== null ? (
          <ErrorNotice
            title="Could not load statistics"
            detail={stats.error}
            onRetry={() => setReloadKey((k) => k + 1)}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div>
              <div className="text-2xl font-bold text-text">{totalAssets}</div>
              <div className="text-[11px] text-faint">Total Assets</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-text">{validatedCount}</div>
              <div className="text-[11px] text-faint">Validated</div>
            </div>
            <div>
              <div
                className={`text-2xl font-bold ${
                  activeJobsCount > 0 ? "text-warn" : "text-faint"
                }`}
              >
                {activeJobsCount}
              </div>
              <div className="text-[11px] text-faint">Active Jobs</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-text">{totalJobsCount}</div>
              <div className="text-[11px] text-faint">Total Jobs</div>
            </div>
          </div>
        )}
      </Panel>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        defaultValue="assets"
        className="my-4"
      >
        <Tab value="assets" label="Assets" />
        <Tab value="jobs" label="Jobs" />
        <Tab value="history" label="History" />
      </Tabs>

      {/* Assets tab */}
      {activeTab === "assets" && activeOrgId !== null && (
        <div className="space-y-4">
          {stats.error !== null && (
            <ErrorNotice title="Could not load statistics" detail={stats.error} />
          )}

          {Object.entries(assetsByType).length > 0 && (
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Object.entries(assetsByType).map(([type, count]) => (
                <div key={type} className="flex items-center gap-2">
                  <Badge tone="neutral" className="min-w-[40px] justify-center">
                    {type}
                  </Badge>
                  <span className="text-[13px] text-muted">{count}</span>
                </div>
              ))}
            </div>
          )}

          {totalAssets === 0 && !stats.loading && stats.error === null && (
            <EmptyState
              icon={<Package size={24} aria-hidden />}
              title="No assets discovered yet"
              description="No assets have been discovered for this organization yet. Start a discovery job to begin asset collection."
              action={
                <Button variant="outline" onClick={() => navigate("/app/discovery/config")}>
                  <Radar size={14} aria-hidden /> Start Discovery Job
                </Button>
              }
            />
          )}
        </div>
      )}

      {/* Jobs tab */}
      {activeTab === "jobs" && activeOrgId !== null && (
        <div className="space-y-4">
          {jobs.loading && (
            <div className="flex items-center gap-2.5 text-[13px] text-muted" role="status">
              <Spinner label="Loading jobs" />
              Loading jobs…
            </div>
          )}

          {jobs.error !== null && (
            <ErrorNotice
              title="Could not load jobs"
              detail={jobs.error}
              onRetry={() => setReloadKey((k) => k + 1)}
            />
          )}

          {jobList.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell>Job</TableCell>
                  <TableCell>State</TableCell>
                  <TableCell>Discovered</TableCell>
                  <TableCell>Completed</TableCell>
                  <TableCell>Errors</TableCell>
                  <TableCell>Started</TableCell>
                  <TableCell>Completed At</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobList.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium text-text">{job.name}</TableCell>
                    <TableCell>
                      <Badge tone={jobStateTone(job.state)}>{job.state}</Badge>
                    </TableCell>
                    <TableCell>{job.discovered_count}</TableCell>
                    <TableCell>{job.completed_count}</TableCell>
                    <TableCell>{job.error_count}</TableCell>
                    <TableCell>
                      {job.started_at ? new Date(job.started_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>
                      {job.completed_at ? new Date(job.completed_at).toLocaleString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {!jobs.loading && jobs.error === null && jobList.length === 0 && (
            <EmptyState
              icon={<Hourglass size={24} aria-hidden />}
              title="No discovery jobs yet"
              description="No discovery jobs have been started for this organization. Use the configuration page to start a new discovery job."
              action={
                <Button variant="outline" onClick={() => navigate("/app/discovery/config")}>
                  <Radar size={14} aria-hidden /> Start Discovery Job
                </Button>
              }
            />
          )}
        </div>
      )}

      {/* History tab */}
      {activeTab === "history" && activeOrgId !== null && (
        <div className="space-y-4">
          {history.loading && (
            <div className="flex items-center gap-2.5 text-[13px] text-muted" role="status">
              <Spinner label="Loading history" />
              Loading history…
            </div>
          )}

          {history.error !== null && (
            <ErrorNotice
              title="Could not load history"
              detail={history.error}
              onRetry={() => setReloadKey((k) => k + 1)}
            />
          )}

          {historyList.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell>Action</TableCell>
                  <TableCell>Outcome</TableCell>
                  <TableCell>Organization</TableCell>
                  <TableCell>Time</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyList.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.action}</TableCell>
                    <TableCell>
                      <Badge tone={entry.outcome === "success" ? "ok" : "danger"}>
                        {entry.outcome}
                      </Badge>
                    </TableCell>
                    <TableCell>{entry.organization_name ?? "—"}</TableCell>
                    <TableCell>
                      {entry.created_at ? new Date(entry.created_at).toLocaleString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {!history.loading && history.error === null && historyList.length === 0 && (
            <EmptyState
              icon={<ScrollText size={24} aria-hidden />}
              title="No discovery history yet"
              description="No discovery events have been recorded for this organization yet."
              action={
                <Button variant="outline" onClick={() => navigate("/app/discovery/config")}>
                  <Radar size={14} aria-hidden /> Start Discovery
                </Button>
              }
            />
          )}
        </div>
      )}
    </div>
  );
}
