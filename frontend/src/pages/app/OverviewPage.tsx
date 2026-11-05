import { Database, LayoutDashboard, RefreshCcw, Server, ShieldQuestion } from "lucide-react";
import { useConnection } from "@/hooks/useConnection";
import {
  Badge,
  Button,
  EmptyState,
  ErrorNotice,
  KeyValueRow,
  Panel,
  Spinner,
  StatusDot,
} from "@/components/ui/Primitives";

/**
 * Overview — the entry point of the application.
 * HONEST-DATA RULE: this page shows NO metrics. Everything displayed comes
 * from the live health endpoint; there are no asset counts, scores, or scan
 * histories because no such data exists in Phase 1.
 */
export function OverviewPage() {
  const { phase, health, error, refresh } = useConnection();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-text">Overview</h1>
        <p className="mt-1 text-[13px] text-muted">
          Platform status and future module readiness.
        </p>
      </div>

      <Panel title="Backend connection">
        {phase === "loading" && (
          <div className="flex items-center gap-2.5 py-2 text-[13px] text-muted">
            <Spinner label="Checking backend connection" />
            Checking backend connection…
          </div>
        )}

        {phase === "offline" && (
          <ErrorNotice title="Backend unreachable" detail={error} onRetry={refresh} />
        )}

        {phase === "online" && health !== null && (
          <>
            <div className="mb-3 flex items-center gap-2">
              <StatusDot tone={health.database === "connected" ? "ok" : "warn"} />
              <span className="text-[13px] font-medium text-text">Connected to backend</span>
              <Badge tone="ok">online</Badge>
            </div>
            <div>
              <KeyValueRow
                label="API status"
                value={health.status === "ok" ? "Operational" : "Degraded"}
              />
              <KeyValueRow label="API version" value={`v${health.version}`} />
              <KeyValueRow
                label="Database"
                value={
                  health.database === "connected" ? (
                    <Badge tone="ok">connected</Badge>
                  ) : (
                    <Badge tone="warn">unreachable</Badge>
                  )
                }
              />
              <KeyValueRow label="Environment" value={health.environment} />
              <KeyValueRow
                label="Reported at"
                value={new Date(health.timestamp).toLocaleTimeString()}
              />
            </div>
          </>
        )}
      </Panel>

      <Panel
        title="Attack surface data"
        description="Assessment modules activate in later development phases."
      >
        <EmptyState
          icon={<ShieldQuestion size={24} />}
          title="No assessment data yet"
          action={
            <Button variant="ghost" disabled title="Available in a future phase">
              <RefreshCcw size={14} aria-hidden /> Start first assessment
            </Button>
          }
        >
          AegisGraph will discover and assess the assets of your authorized domains in upcoming
          phases. Once a scope is defined and your first discovery run completes, live asset
          counts, findings and risk views will appear here — sourced from your local database
          only.
        </EmptyState>
      </Panel>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Panel title="What Phase 1 delivered">
          <ul className="space-y-2 text-[13px] leading-relaxed text-muted">
            <li className="flex gap-2">
              <Server size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden />
              FastAPI backend with versioned API and health reporting
            </li>
            <li className="flex gap-2">
              <Database size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden />
              PostgreSQL persistence, migrations and backup tooling
            </li>
            <li className="flex gap-2">
              <LayoutDashboard size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden />
              Application shell with navigation and live connection status
            </li>
          </ul>
        </Panel>
        <Panel title="Coming in later phases">
          <p className="text-[13px] leading-relaxed text-muted">
            Scope management, asset discovery, security assessment, intelligence correlation,
            risk prioritization and reporting are being developed in sequential phases. Each
            module will follow the same security-first process before it is switched on.
          </p>
        </Panel>
      </div>
    </div>
  );
}
