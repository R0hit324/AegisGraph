/**
 * Phase 3: Discovery Configuration.
 *
 * Lets an authorized user select an organization, pick one of its *authorized
 * scopes* (loaded from `GET /organizations/{id}/scopes` — never invented) and
 * start a discovery job within it via `POST /api/v1/discovery/jobs`.
 *
 * Scope domain patterns are re-validated client-side with the same rules the
 * backend applies; the server remains the authority.
 */

import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Crosshair, Radar, Settings2 } from "lucide-react";
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
  TextInput,
} from "@/components/ui/Primitives";
import { isValidDomainPattern, startDiscoveryJob } from "@/services/discoveryService";
import { listOrganizations, listScopes } from "@/services/organizationsService";
import { describeAuthError } from "@/app/authErrors";
import type { DiscoveryJobCreate } from "@/schemas/discovery";
import type { Scope } from "@/types/api";

const PORT_PROFILES: Array<{ value: string; label: string }> = [
  { value: "standard", label: "Standard (common ports 1-1000)" },
  { value: "limited", label: "Limited (common ports only)" },
  { value: "custom", label: "Custom (user-defined)" },
];

export function DiscoveryConfig() {
  const navigate = useNavigate();

  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [selectedScopeId, setSelectedScopeId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [formBusy, setFormBusy] = useState(false);
  const [formProblem, setFormProblem] = useState<string | null>(null);

  const [jobName, setJobName] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [concurrencyLimit, setConcurrencyLimit] = useState("10");
  const [portProfile, setPortProfile] = useState("standard");

  const loadOrgs = useCallback(() => listOrganizations(), []);
  const orgs = useResource(loadOrgs, 0, describeAuthError);

  const loadScopes = useCallback(
    () =>
      selectedOrgId === null
        ? Promise.resolve<Scope[]>([])
        : listScopes(selectedOrgId),
    [selectedOrgId],
  );
  const scopeKey = `${selectedOrgId ?? "none"}#${reloadKey}`;
  const scopes = useResource(loadScopes, scopeKey, describeAuthError);

  const activeScopes = useMemo(
    () =>
      scopes.loading || scopes.error !== null
        ? []
        : (scopes.data ?? []).filter((s) => s.is_active),
    [scopes.loading, scopes.error, scopes.data],
  );
  const selectedScope = activeScopes.find((s) => s.id === selectedScopeId) ?? null;

  const handleOrgSelect = useCallback((id: number) => {
    setSelectedOrgId(id);
    setSelectedScopeId(null);
    setFormProblem(null);
  }, []);

  const handleScopeSelect = useCallback(
    (value: string) => {
      const id = value === "" ? null : Number.parseInt(value, 10);
      setSelectedScopeId(id);
      setFormProblem(null);
      if (id !== null) {
        const scope = activeScopes.find((s) => s.id === id);
        if (scope && !isValidDomainPattern(scope.domain_pattern)) {
          setFormProblem(
            "This scope's domain pattern is not valid (e.g., example.com or *.example.com). Reserved domains and bare IPs cannot be authorized.",
          );
        }
      }
    },
    [activeScopes],
  );

  const handleStart = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (formBusy || selectedOrgId === null || selectedScopeId === null) return;

      if (jobName.trim().length < 1) {
        setFormProblem("Give the discovery job a name.");
        return;
      }
      const concurrency = Number.parseInt(concurrencyLimit, 10);
      if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 100) {
        setFormProblem("Concurrency limit must be an integer between 1 and 100.");
        return;
      }
      const scope = activeScopes.find((s) => s.id === selectedScopeId);
      if (scope === undefined || !isValidDomainPattern(scope.domain_pattern)) {
        setFormProblem(
          "Select an authorized scope with a valid domain pattern (e.g., example.com or *.example.com).",
        );
        return;
      }

      setFormBusy(true);
      setFormProblem(null);
      try {
        const payload: DiscoveryJobCreate = {
          name: jobName.trim(),
          organization_id: selectedOrgId,
          scope_id: selectedScopeId,
          config: JSON.stringify({
            concurrency_limit: concurrency,
            port_profile: portProfile,
          }),
        };
        if (jobDescription.trim() !== "") payload.description = jobDescription.trim();
        await startDiscoveryJob(payload);
        navigate("/app/discovery/jobs");
      } catch (cause: unknown) {
        setFormProblem(describeAuthError(cause));
      } finally {
        setFormBusy(false);
      }
    },
    [
      formBusy,
      selectedOrgId,
      selectedScopeId,
      jobName,
      jobDescription,
      concurrencyLimit,
      portProfile,
      activeScopes,
      navigate,
    ],
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-text">
          Discovery Configuration
        </h1>
        <p className="mt-1 text-[13px] text-muted">
          Configure discovery modules and start a job within an authorized scope.
          All network operations are organization-isolated and audit-logged.
        </p>
      </div>

      <Panel title="Authorization" description="Select an organization and an authorized scope">
        <OrgPicker
          orgs={orgs.data ?? []}
          selectedId={selectedOrgId}
          loading={orgs.loading}
          onSelect={handleOrgSelect}
        />

        {selectedOrgId !== null && scopes.loading && (
          <div
            className="mt-4 flex items-center gap-2.5 text-[13px] text-muted"
            role="status"
          >
            <Spinner label="Loading scopes" />
            Loading authorized scopes…
          </div>
        )}

        {selectedOrgId !== null && !scopes.loading && scopes.error !== null && (
          <div className="mt-4">
            <ErrorNotice
              title="Scopes could not be loaded"
              detail={scopes.error}
              onRetry={() => setReloadKey((k) => k + 1)}
            />
          </div>
        )}

        {selectedOrgId !== null && !scopes.loading && scopes.error === null && (
          <div className="mt-4">
            <h2 className="mb-2 text-[12px] uppercase tracking-widest text-faint">
              Authorized Scope
            </h2>
            <Field
              label="Scope"
              htmlFor="discovery-scope"
              hint="Only scopes authorized on the Scopes page can be selected."
            >
              <SelectInput
                id="discovery-scope"
                value={selectedScopeId === null ? "" : String(selectedScopeId)}
                onChange={(e) => handleScopeSelect(e.target.value)}
              >
                <option value="">Select a scope</option>
                {activeScopes.map((scope) => (
                  <option key={scope.id} value={String(scope.id)}>
                    {scope.domain_pattern} — {scope.name}
                  </option>
                ))}
              </SelectInput>
            </Field>

            {selectedScope !== null && (
              <div className="mt-2 flex flex-wrap items-center gap-2.5 text-[13px] text-muted">
                <Badge tone="neutral">
                  <Crosshair size={11} aria-hidden /> {selectedScope.domain_pattern}
                </Badge>
                <span className="text-[11px] text-faint">{selectedScope.name}</span>
              </div>
            )}
          </div>
        )}

        {formProblem !== null && (
          <div className="mt-4">
            <ErrorNotice title={formProblem} onRetry={() => setFormProblem(null)} />
          </div>
        )}
      </Panel>

      {selectedOrgId !== null &&
        selectedScopeId !== null &&
        !scopes.loading &&
        scopes.error === null && (
          <Panel
            title="Discovery Configuration"
            description="Configure discovery module settings"
          >
            <form
              onSubmit={handleStart}
              data-testid="discovery-config-form"
              className="flex flex-col gap-4"
            >
              <Field label="Job name" htmlFor="job-name">
                <TextInput
                  id="job-name"
                  name="job_name"
                  required
                  maxLength={200}
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                  placeholder="e.g., Subdomain enumeration run"
                  disabled={formBusy}
                />
              </Field>

              <Field label="Description (optional)" htmlFor="job-description">
                <TextInput
                  id="job-description"
                  name="job_description"
                  maxLength={500}
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Optional description of the discovery run"
                  disabled={formBusy}
                />
              </Field>

              <Field
                label="Concurrency limit"
                htmlFor="concurrency-limit"
                hint="Max concurrent network operations (1-100). Default: 10."
              >
                <TextInput
                  id="concurrency-limit"
                  name="concurrency_limit"
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={concurrencyLimit}
                  onChange={(e) => setConcurrencyLimit(e.target.value)}
                  disabled={formBusy}
                />
              </Field>

              <Field label="Port profile" htmlFor="port-profile">
                <SelectInput
                  id="port-profile"
                  value={portProfile}
                  onChange={(e) => setPortProfile(e.target.value)}
                  disabled={formBusy}
                >
                  {PORT_PROFILES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </SelectInput>
              </Field>

              <div>
                <Button type="submit" disabled={formBusy}>
                  {formBusy ? (
                    <>
                      <Spinner label="Starting discovery" /> Starting…
                    </>
                  ) : (
                    <>
                      <Radar size={14} aria-hidden /> Start Discovery Job
                    </>
                  )}
                </Button>
              </div>
            </form>

            <div className="mt-4 rounded-quiet bg-surface-3/30 p-3 text-[11px] text-faint">
              <strong>Safety controls:</strong> All targets pass centralized authorization
              and address-safety validation before connection. SSRF/DNS rebinding protection
              is enforced. Rate limits and timeouts are applied. Assets discovered outside
              the original authorization scope are recorded as out-of-scope candidates only.
            </div>
          </Panel>
        )}

      {selectedOrgId !== null && !scopes.loading && scopes.error === null && activeScopes.length === 0 && (
        <EmptyState
          icon={<Crosshair size={24} aria-hidden />}
          title="No authorized scopes yet"
          description="Discovery only runs inside an authorized scope. Authorize a domain on the Scopes page first, then come back to configure the job."
          action={
            <Button variant="outline" onClick={() => navigate("/app/scopes")}>
              Go to Scopes
            </Button>
          }
        />
      )}

      {selectedOrgId === null && (
        <EmptyState
          icon={<Settings2 size={24} aria-hidden />}
          title="Select an organization and scope"
          description="Choose an organization and one of its authorized scopes to configure discovery. Scopes define the exact boundary within which discovery may operate — results outside it are recorded but not actively scanned."
        />
      )}

      <p className="text-[12px] text-faint">
        Scopes are managed on the <Link to="/app/scopes" className="text-accent hover:underline">Scopes page</Link>.
      </p>
    </div>
  );
}
