/** Phase 3: Discovery Configuration.

Allows authorized users to select an authorized scope and configure
discovery modules before starting a discovery job.
*/

import { useCallback, useState } from "react";
import {
  Button,
  EmptyState,
  ErrorNotice,
  Field,
  Panel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Input,
  Form,
  FormControl,
} from "@/components/ui/Primitives";
import { useSession } from "@/app/useSession";
import { listScopes, listOrganizations } from "@/services/organizationsService";
import { isValidDomainPattern } from "@/services/discoveryService";
import { describeAuthError } from "@/app/authErrors";

export function DiscoveryConfig() {
  const session = useSession();
  const myUserId = session.user?.id ?? -1;

  // State
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [selectedScopeId, setSelectedScopeId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [formProblem, setFormProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Organisations
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

  // Scopes - load when org changes
  const [scopes, setScopes] = useState<Array<{ id: number; name: string; domain_pattern: string }>>([]);
  const loadScopes = useCallback(async (orgId: number) => {
    try {
      const { listScopes } = await import("@/services/organizationsService");
      const data = await listScopes(orgId);
      setScopes(data.data ?? []);
    } catch (e) {
      setScopes([]);
    }
  }, []);

  useEffect(() => {
    if (selectedOrgId !== null) {
      loadScopes(selectedOrgId);
    }
  }, [selectedOrgId, loadScopes]);

  // Job config form state
  const [jobName, setJobName] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [concurrencyLimit, setConcurrencyLimit] = useState("10");
  const [portProfile, setPortProfile] = useState("standard");

  // Validation
  const handleOrgSelect = useCallback(
    (orgId: number | null) => {
      setSelectedOrgId(orgId);
      setSelectedScopeId(null);
      setScopes([]);
      setFormProblem(null);
    },
    [],
  );

  // Scope validation
  const handleScopeChange = useCallback(
    (domain: string) => {
      if (!isValidDomainPattern(domain)) {
        setFormProblem(
          "Invalid domain pattern. Must be a valid domain or subdomain pattern (e.g., example.com or *.example.com). Reserved domains (localhost, local, invalid, test, example) are not allowed.",
        );
        return false;
      }
      setFormProblem(null);
      return true;
    },
    [],
  );

  // Form submission
  const handleCreate = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (formBusy || selectedOrgId === null || selectedScopeId === null) return;

      // Validate scope domain pattern
      if (!handleScopeChange(jobName)) return;

      setFormBusy(true);
      setFormProblem(null);
      setNotice(null);

      try {
        const { startDiscoveryJob } = await import("@/services/discoveryService");
        const payload = {
          name: jobName,
          description: jobDescription || undefined,
          organization_id: selectedOrgId,
          scope_id: selectedScopeId,
          config: JSON.stringify({
            concurrency_limit: parseInt(concurrencyLimit, 10),
            port_profile: portProfile,
          }),
        };
        await startDiscoveryJob(payload);
        setFormOpen(false);
        setNotice(`Discovery job "${jobName}" started successfully.`);
        setReloadKey((k) => k + 1);
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
      handleScopeChange,
      describeAuthError,
    ],
  );

  // Initialize orgs
  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  // Form problem shown when collapsed
  const showProblem = formProblem !== null && formOpen === false;

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

      {/* Org + Scope selector */}
      <Panel
        title="Authorization"
        description="Select an organization and an authorized scope"
      >
        {selectedOrgId === null && orgs.length === 0 && (
          <div className="text-muted text-[13px]">
            No organizations found. Create or join an organization first.
          </div>
        )}
        {selectedOrgId === null && orgs.length > 0 && (
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

          {/* Scope selector */}
          {selectedOrgId !== null && (
            <div className="mt-3">
              <h2 className="text-[12px] uppercase tracking-widest text-faint mb-2">
                Authorized Scope
              </h2>
              {selectedScopeId !== null && (
                <div className="flex items-center gap-3">
                  <Badge tone="neutral">
                    {scopes.find((s) => s.id === selectedScopeId)?.domain_pattern ?? "—"}
                  </Badge>
                  <span className="text-[11px] text-faint">
                    ({scopes.find((s) => s.id === selectedScopeId)?.name ?? "—"})
                  </span>
                </div>
              )}
              {selectedScopeId === null && scopes.length > 0 && (
                <Select
                  onValueChange={(val: string) => {
                    const id = parseInt(val, 10);
                    setSelectedScopeId(id);
                    // Validate the domain pattern
                    const scope = scopes.find((s) => s.id === id);
                    if (scope) {
                      handleScopeChange(scope.domain_pattern);
                    }
                  }}
                  placeholder="Select a scope"
                >
                  <SelectTrigger>
                    <SelectValue notchedPlaceholder="Select a scope" />
                  </SelectTrigger>
                  <SelectContent>
                    {scopes.map((scope) => (
                      <SelectItem key={scope.id} value={scope.id}>
                        {scope.domain_pattern}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Manual scope entry */}
              {selectedScopeId === null && scopes.length === 0 && (
                <Form onSubmit={handleCreate} className="mt-3">
                  <Field
                    label="Scope domain pattern"
                    htmlFor="scope-pattern-manual"
                  >
                    <Input
                      id="scope-pattern-manual"
                      type="text"
                      placeholder="example.com or *.example.com"
                      onChange={(e) =>
                        handleScopeChange(e.target.value.trim())
                      }
                      disabled={formBusy}
                    />
                  </Field>
                  <div>
                    <Button type="submit" disabled={formBusy}>
                      {formBusy ? (
                        <>
                          <Spinner label="Validating" /> Authorizing
                        </>
                      ) : ("Authorize and Start Discovery"))
                    </Button>
                  </div>
                </Form>
              )}
            </div>
          )}
        )}

        {/* Form when no org selected but orgs exist */}
        {selectedOrgId === null && orgs.length > 0 && formOpen && (
          <form onSubmit={handleCreate} className="mt-5">
            <Field
              label="Scope domain pattern"
              htmlFor="scope-pattern-org-select"
            >
              <Input
                id="scope-pattern-org-select"
                type="text"
                placeholder="example.com or *.example.com"
                onChange={(e) =>
                  handleScopeChange(e.target.value.trim())
                }
                disabled={formBusy}
              />
            </Field>
            <div>
              <Button type="submit" disabled={formBusy}>
                {formBusy ? (
                  <>
                    <Spinner label="Validating" /> Authorizing
                  </>
                ) : ("Authorize and Start Discovery"))
              </Button>
            </div>
          </form>
        )}

        {showProblem && (
          <ErrorNotice title={formProblem} onRetry={() => setFormProblem(null)} />
        )}
        {notice !== null && (
          <div
            role="status"
            className="rounded-quiet border border-ok/40 bg-ok/10 px-4 py-3 text-[13px] text-ok"
          >
            {notice}
          </div>
        )}
      </Panel>

      {/* Discovery modules configuration */}
      {selectedOrgId !== null && selectedScopeId !== null && (
        <Panel
          title="Discovery Configuration"
          description="Configure discovery module settings"
        >
          <Form
            onSubmit={handleCreate}
            className="mt-4 space-y-4"
            data-testid="discovery-config-form"
          >
            <Field
              label="Job name"
              htmlFor="job-name"
            >
              <Input
                id="job-name"
                type="text"
                value={jobName}
                onChange={(e) => setJobName(e.target.value.trim())}
                placeholder="e.g., Subdomain Enumeration Run"
                disabled={formBusy}
                required
              />
            </Field>

            <Field
              label="Description (optional)"
              htmlFor="job-description"
            >
              <Input
                id="job-description"
                type="text"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value.trim())}
                placeholder="Optional description of the discovery run"
                disabled={formBusy}
              />
            </Field>

            <Field
              label="Concurrency limit"
              htmlFor="concurrency-limit"
            >
              <Input
                id="concurrency-limit"
                type="number"
                value={concurrencyLimit}
                onChange={(e) => setConcurrencyLimit(e.target.value.trim())}
                min={1}
                max={100}
                step={1}
                placeholder="10"
                disabled={formBusy}
              />
              <p className="text-[11px] text-faint ml-2">
                Max concurrent network operations. Default: 10.
              </p>
            </Field>

            <Field
              label="Port profile"
              htmlFor="port-profile"
            >
              <Select
                onValueChange={(val: string) => setPortProfile(val)}
                disabled={formBusy}
              >
                <SelectTrigger>
                  <SelectValue notchedPlaceholder="Select port profile" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard (common ports 1-1000)</SelectItem>
                  <SelectItem value="limited">Limited (common ports only)</SelectItem>
                  <SelectItem value="custom">Custom (user-defined)</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <div>
              <Button type="submit" disabled={formBusy}>
                {formBusy ? (
                  <>
                    <Spinner label="Starting discovery" /> Starting…
                  </>
                ) : (
                  "Start Discovery Job"
                )}
              </Button>
            </div>
          </Form>

          {/* Safety notice */}
          <div className="mt-3 p-3 bg-surface-3/30 rounded-quiet text-[11px] text-faint">
            <strong>Safety controls:</strong> All targets pass centralized authorization
            and address-safety validation before connection. SSRF/DNS rebinding protection
            enforced. Rate limits and timeouts applied. Discovered assets outside the
            original authorization scope are recorded as out-of-scope candidates only.
          </div>
        </Panel>
      )}

      {/* Can't configure without org+scope */}
      {selectedOrgId === null && (
        <EmptyState
          icon={<Badge tone="neutral" className="text-2xl"}>⚙️</Badge>
          title="Select an organization and scope"
          description={
            "Choose an organization and an authorized scope to configure discovery. " +
            "Scopes define the exact boundary within which discovery may operate. " +
            "Discovery results outside the scope are recorded but not actively scanned."
        }>
        </EmptyState>
      )}

      {selectedOrgId !== null && selectedScopeId === null && (
        <EmptyState
          icon={<Badge tone="neutral" className="text-2xl"}>📛</Badge>
          title="Select an authorized scope"
          description={
            "You must select an authorized scope (domain pattern) before starting discovery. " +
            "Scopes are validated against reserved domains and IP patterns. " +
            "Discovery never runs outside the authorized boundary."
        }>
        </EmptyState>
      )}
    </div>
  );
}