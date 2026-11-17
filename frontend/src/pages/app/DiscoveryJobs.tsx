/**
 * Phase 3: Discovery Jobs page.
 *
 * Lists discovery jobs for the selected organization from
 * `GET /api/v1/discovery/jobs` — job state, discovered/completed/error
 * counts, start/completion times. No progress percentages are invented:
 * the backend does not expose them, so none are shown.
 *
 * Cancellation calls the real `POST /api/v1/discovery/jobs/{id}/cancel`
 * endpoint; it is only offered for jobs that can still be cancelled
 * (pending/queued/running) and is admin-gated server-side.
 */

import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Hourglass, ListX, Radar } from "lucide-react";
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
} from "@/components/ui/Primitives";
import { cancelDiscoveryJob, listDiscoveryJobs } from "@/services/discoveryService";
import { listOrganizations } from "@/services/organizationsService";
import { describeAuthError } from "@/app/authErrors";
import type { DiscoveryJobStatus } from "@/schemas/discovery";

/** Map a job state to a badge tone. Unknown states stay neutral. */
function stateTone(state: string): "ok" | "warn" | "danger" | "accent" | "neutral" {
  switch (state) {
    case "completed":
      return "ok";
    case "running":
      return "warn";
    case "failed":
      return "danger";
    case "pending":
    case "queued":
      return "accent";
    default:
      return "neutral";
  }
}

const CANCELLABLE_STATES = new Set(["pending", "queued", "running"]);

export function DiscoveryJobsPage() {
  const navigate = useNavigate();

  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const loadOrgs = useCallback(() => listOrganizations(), []);
  const orgs = useResource(loadOrgs, 0, describeAuthError);

  const loadJobs = useCallback(
    () =>
      selectedOrgId === null
        ? Promise.resolve<DiscoveryJobStatus[]>([])
        : listDiscoveryJobs(selectedOrgId),
    [selectedOrgId],
  );
  const orgKey = `${selectedOrgId ?? "none"}#${reloadKey}`;
  const jobs = useResource(loadJobs, orgKey, describeAuthError);

  const jobList = jobs.loading || jobs.error !== null ? [] : (jobs.data ?? []);
  const totalJobs = jobList.length;
  const runningJobs = jobList.filter((j) => j.state === "running").length;
  const failedJobs = jobList.filter((j) => j.state === "failed").length;
  const cancelledJobs = jobList.filter((j) => j.state === "cancelled").length;

  const handleCancel = useCallback(
    async (job: DiscoveryJobStatus) => {
      setProblem(null);
      setNotice(null);
      setCancellingId(job.id);
      try {
        await cancelDiscoveryJob(job.id);
        setNotice(`Discovery job “${job.name}” was cancelled.`);
        setReloadKey((k) => k + 1);
      } catch (cause: unknown) {
        setProblem(describeAuthError(cause));
      } finally {
        setCancellingId(null);
      }
    },
    [],
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 pb-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-text">Discovery Jobs</h1>
        <p className="mt-1 text-[13px] text-muted">
          Active and completed discovery jobs for your organization. Each job
          represents a coordinated set of discovery activities against an
          authorized scope.
        </p>
      </div>

      <OrgPicker
        orgs={orgs.data ?? []}
        selectedId={selectedOrgId}
        loading={orgs.loading}
        onSelect={(id) => {
          setSelectedOrgId(id);
          setNotice(null);
          setProblem(null);
        }}
      />

      {problem !== null && (
        <ErrorNotice title={problem} onRetry={() => setProblem(null)} />
      )}
      {notice !== null && (
        <div
          role="status"
          className="rounded-quiet border border-ok/40 bg-ok/10 px-4 py-3 text-[13px] text-ok"
        >
          {notice}
        </div>
      )}

      <Panel title="Job Summary" description="Overview of discovery jobs">
        {selectedOrgId === null ? (
          <div className="text-[13px] text-muted">
            Select an organization to see the job summary.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <div className="text-2xl font-bold text-text">{totalJobs}</div>
              <div className="text-[11px] text-faint">Total Jobs</div>
            </div>
            <div>
              <div
                className={`text-2xl font-bold ${
                  runningJobs > 0 ? "text-warn" : "text-faint"
                }`}
              >
                {runningJobs}
              </div>
              <div className="text-[11px] text-faint">Running</div>
            </div>
            <div>
              <div
                className={`text-2xl font-bold ${
                  failedJobs > 0 ? "text-danger" : "text-faint"
                }`}
              >
                {failedJobs}
              </div>
              <div className="text-[11px] text-faint">Failed</div>
            </div>
            <div>
              <div
                className={`text-2xl font-bold ${
                  cancelledJobs > 0 ? "text-warn" : "text-faint"
                }`}
              >
                {cancelledJobs}
              </div>
              <div className="text-[11px] text-faint">Cancelled</div>
            </div>
          </div>
        )}
      </Panel>

      <Panel
        title="Jobs"
        description="Discovery job status and details. No progress percentages are invented."
      >
        {jobs.loading && (
          <div
            className="flex items-center gap-2.5 py-3 text-[13px] text-muted"
            role="status"
          >
            <Spinner label="Loading jobs" />
            Loading discovery jobs…
          </div>
        )}

        {!jobs.loading && jobs.error !== null && (
          <ErrorNotice
            title="Discovery jobs could not be loaded"
            detail={jobs.error}
            onRetry={() => setReloadKey((k) => k + 1)}
          />
        )}

        {!jobs.loading && jobs.error === null && selectedOrgId !== null && jobList.length > 0 && (
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
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobList.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-medium text-text">{job.name}</TableCell>
                  <TableCell>
                    <Badge tone={stateTone(job.state)}>{job.state}</Badge>
                  </TableCell>
                  <TableCell>{job.discovered_count}</TableCell>
                  <TableCell>{job.completed_count}</TableCell>
                  <TableCell>{job.error_count}</TableCell>
                  <TableCell>
                    {job.started_at
                      ? new Date(job.started_at).toLocaleString()
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {job.completed_at
                      ? new Date(job.completed_at).toLocaleString()
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {CANCELLABLE_STATES.has(job.state) ? (
                      <Button
                        variant="ghost"
                        size="small"
                        disabled={cancellingId !== null}
                        onClick={() => void handleCancel(job)}
                        title={`Cancel ${job.name}`}
                      >
                        {cancellingId === job.id ? (
                          <>
                            <Spinner label="Cancelling" /> Cancelling…
                          </>
                        ) : (
                          "Cancel"
                        )}
                      </Button>
                    ) : (
                      <span className="text-[11px] text-faint" aria-hidden>
                        —
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {!jobs.loading && jobs.error === null && jobList.length === 0 && (
          <EmptyState
            icon={<Hourglass size={24} aria-hidden />}
            title={selectedOrgId === null ? "No organization selected" : "No discovery jobs yet"}
            description={
              selectedOrgId === null
                ? "Select an organization above to view its discovery jobs."
                : "No discovery jobs have been started for this organization. Configure one from the discovery configuration page."
            }
            action={
              selectedOrgId !== null ? (
                <Button variant="outline" onClick={() => navigate("/app/discovery/config")}>
                  <Radar size={14} aria-hidden /> Start Discovery Job
                </Button>
              ) : undefined
            }
          />
        )}
      </Panel>

      {selectedOrgId !== null && jobList.some((j) => CANCELLABLE_STATES.has(j.state)) && (
        <p className="flex items-center gap-1.5 text-[12px] text-faint">
          <ListX size={13} aria-hidden />
          Cancellation is admin-gated and enforced again server-side.
        </p>
      )}
    </div>
  );
}
