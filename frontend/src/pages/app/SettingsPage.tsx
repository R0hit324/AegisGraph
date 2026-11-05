import { useConnection } from "@/hooks/useConnection";
import { getApiBaseUrl } from "@/services/apiClient";
import { Badge, KeyValueRow, Panel } from "@/components/ui/Primitives";

/**
 * Settings (Phase 1 partial): application information and connection details.
 * Operational settings (scope configuration, provider keys, user management)
 * arrive with later phases — nothing here pretends otherwise.
 */
export function SettingsPage() {
  const { phase, health } = useConnection();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-text">Settings</h1>
        <p className="mt-1 text-[13px] text-muted">
          Application information and connection details.
        </p>
      </div>

      <Panel title="Application" description="Version and deployment information.">
        <KeyValueRow label="Application" value="AegisGraph" />
        <KeyValueRow label="Frontend version" value={`v${__APP_VERSION__}`} />
        <KeyValueRow
          label="Backend version"
          value={
            phase === "online" ? (
              `v${health?.version ?? "unknown"}`
            ) : (
              <Badge tone="warn">{phase === "loading" ? "checking…" : "offline"}</Badge>
            )
          }
        />
        <KeyValueRow label="Deployment model" value="Local-first, self-hosted (localhost)" />
      </Panel>

      <Panel title="Connection" description="How this browser reaches the backend API.">
        <KeyValueRow
          label="API base URL"
          value={<code className="text-accent">{getApiBaseUrl()}</code>}
        />
        <KeyValueRow
          label="API documentation"
          value={<code className="text-accent">{getApiBaseUrl()}/docs</code>}
        />
        <KeyValueRow
          label="Health path"
          value={<code className="text-accent">/api/v1/health</code>}
        />
      </Panel>

      <Panel
        title="Future settings"
        description="Not available in Phase 1 — listed for transparency."
      >
        <ul className="space-y-1.5 text-[13px] text-muted">
          <li>• Scope and authorization configuration (Phase 2)</li>
          <li>• External intelligence provider credentials (backend-only, Phase 6)</li>
          <li>• User authentication and account management (later phase)</li>
        </ul>
      </Panel>
    </div>
  );
}
