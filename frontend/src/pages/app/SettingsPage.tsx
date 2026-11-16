import { useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { useConnection } from "@/hooks/useConnection";
import { useSession } from "@/app/useSession";
import { describeAuthError } from "@/app/authErrors";
import { getApiBaseUrl } from "@/services/apiClient";
import { changePassword as changePasswordApi } from "@/services/sessionService";
import {
  Badge,
  Button,
  ErrorNotice,
  Field,
  KeyValueRow,
  Panel,
  TextInput,
} from "@/components/ui/Primitives";

/**
 * Settings: application information, connection details and the Phase 2
 * account controls. Operational settings below arrive with later phases.
 */
export function SettingsPage() {
  const { phase, health } = useConnection();
  const session = useSession();
  const user = session.user;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-text">Settings</h1>
        <p className="mt-1 text-[13px] text-muted">
          Application, connection and account details.
        </p>
      </div>

      <Panel title="Account" description="The session this browser currently holds.">
        {user === null ? (
          <p className="text-[13px] text-muted" role="status">
            <Badge tone="neutral">checking…</Badge>
          </p>
        ) : (
          <>
            <KeyValueRow label="Username" value={user.username} />
            {user.email !== null && <KeyValueRow label="Email" value={user.email} />}
            <KeyValueRow
              label="Member since"
              value={new Date(user.created_at).toLocaleDateString()}
            />
            {user.email === null && (
              <p className="mt-2 text-[12px] text-faint">
                This account has no email on file. It is only used for identity inside
                AegisGraph.
              </p>
            )}
            {user.is_superuser && (
              <p className="mt-2 text-[12px] text-faint">
                <Badge tone="accent">superuser</Badge>{" "}
                Platform-level account; organization permissions still apply per member.
              </p>
            )}
            <PasswordChangeForm />
          </>
        )}
      </Panel>

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
        <KeyValueRow label="Session transport" value="HttpOnly cookie (aegis_access_token)" />
      </Panel>

      <Panel
        title="Future settings"
        description="Not available yet — listed for transparency."
      >
        <ul className="space-y-1.5 text-[13px] text-muted">
          <li>• Team invitations and a member directory (beyond numeric member IDs)</li>
          <li>• External intelligence provider credentials (backend-only, Phase 6)</li>
          <li>• Session policy configuration (lifetime, forced revocation)</li>
        </ul>
      </Panel>
    </div>
  );
}

/** Phase 2 password change — verified server-side (current password required). */
function PasswordChangeForm() {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [formVisible, setFormVisible] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const current = String(data.get("current") ?? "");
    const next = String(data.get("new") ?? "");
    const confirm = String(data.get("confirm") ?? "");

    if (current === "" || next === "") {
      setProblem("Fill in both the current and the new password.");
      return;
    }
    if (next.length < 8) {
      setProblem("The new password needs at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setProblem("The new passwords do not match.");
      return;
    }

    setBusy(true);
    setProblem(null);
    try {
      await changePasswordApi({ currentPassword: current, newPassword: next });
      setDone(true);
      setFormVisible(false);
      event.currentTarget.reset();
    } catch (cause: unknown) {
      setProblem(describeAuthError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t border-border/60 pt-4">
      {done && (
        <p className="mb-3 text-[13px] text-ok" role="status">
          Password changed. The change is recorded in the activity trail.
        </p>
      )}
      {problem !== null && formVisible && <ErrorNotice title={problem} />}
      {!formVisible ? (
        <Button variant="ghost" onClick={() => { setFormVisible(true); setDone(false); }}>
          <KeyRound size={14} aria-hidden /> Change password
        </Button>
      ) : (
        <form onSubmit={handleSubmit} className="mt-1 flex flex-col gap-3" data-testid="password-form">
          <Field label="Current password" htmlFor="current-password">
            <TextInput
              id="current-password"
              name="current"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="New password" htmlFor="new-password" hint="Minimum 8 characters.">
              <TextInput
                id="new-password"
                name="new"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
              />
            </Field>
            <Field label="Confirm new password" htmlFor="confirm-password">
              <TextInput
                id="confirm-password"
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
              />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Updating…" : "Update password"}
            </Button>
            <Button variant="ghost" onClick={() => setFormVisible(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
