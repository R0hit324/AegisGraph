/**
 * Scopes — authorized domain patterns for an organization.
 *
 * This is the Phase 2 capability: defining where AegisGraph is permitted to
 * operate. Before Phase 3, no discovery engine exists, so a scope is declared
 * here and nothing more is promised about it.
 *
 * HONEST-DATA RULE: every row comes from `GET /organizations/{id}/scopes`;
 * empty stays empty. Admin/owner-only affordances are hidden — and enforced
 * again server-side, so hiding them is presentation, not security.
 */

import { useCallback, useMemo, useState } from "react";
import { Crosshair, Plus, Trash2 } from "lucide-react";
import { roleAtLeast, useSession } from "@/app/useSession";
import { OrgPicker } from "@/pages/app/OrgPicker";
import { useResource } from "@/hooks/useResource";
import {
  Button,
  EmptyState,
  ErrorNotice,
  Field,
  Panel,
  Spinner,
  TextInput,
} from "@/components/ui/Primitives";
import {
  createScope,
  deleteScope,
  listMembers,
  listOrganizations,
  listScopes,
} from "@/services/organizationsService";
import { describeAuthError } from "@/app/authErrors";
import type { OrganizationMember, OrganizationRole, Scope } from "@/types/api";

export function ScopesPage() {
  const session = useSession();
  const myUserId = session.user?.id ?? -1;

  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [formProblem, setFormProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadOrgs = useCallback(() => listOrganizations(), []);
  const orgs = useResource(loadOrgs, 0, describeAuthError);

  const loadScopes = useCallback(
    () =>
      selectedOrgId === null
        ? Promise.resolve<Scope[]>([])
        : listScopes(selectedOrgId),
    [selectedOrgId],
  );
  const loadMembers = useCallback(
    () =>
      selectedOrgId === null
        ? Promise.resolve<OrganizationMember[]>([])
        : listMembers(selectedOrgId),
    [selectedOrgId],
  );

  const orgKey = `${selectedOrgId ?? "none"}#${reloadKey}`;
  const scopes = useResource(loadScopes, orgKey, describeAuthError);
  const members = useResource(loadMembers, orgKey, describeAuthError);

  const role: OrganizationRole | null = useMemo(
    () =>
      members.data?.find((m) => m.user_id === myUserId)?.role ??
      // On a role-load failure the affordances stay hidden; the backend
      // still enforces each operation's real permission requirement.
      (members.error !== null ? "viewer" : null),
    [members.data, members.error, myUserId],
  );
  const isAdmin = roleAtLeast(role ?? "viewer", "admin");

  const handleCreate = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (formBusy || selectedOrgId === null) return;
      const data = new FormData(event.currentTarget);
      const name = String(data.get("name") ?? "").trim();
      const domainPattern = String(data.get("domain_pattern") ?? "").trim();
      const description = String(data.get("description") ?? "").trim();

      if (name.length < 3) {
        setFormProblem("Give the scope a name of at least 3 characters.");
        return;
      }
      // Client-side pre-check mirroring the backend rule, so obvious mistakes
      // never round-trip. The server re-validates everything.
      const host = domainPattern.startsWith("*.") ? domainPattern.slice(2) : domainPattern;
      if (host === "" || !host.includes(".")) {
        setFormProblem(
          "Use a dotted domain such as example.com or *.example.com. Single-label hosts and bare IPs are not authorizable.",
        );
        return;
      }
      const finalLabel = host.replace(/\.$/, "").split(".").pop()?.toLowerCase() ?? "";
      if (["localhost", "local", "invalid", "test", "example"].includes(finalLabel)) {
        setFormProblem(
          "Reserved special-use domains (localhost, local, invalid, test, example) can never be authorized.",
        );
        return;
      }

      setFormBusy(true);
      setFormProblem(null);
      setNotice(null);
      try {
        const payload: Parameters<typeof createScope>[1] = {
          name,
          domain_pattern: domainPattern,
        };
        if (description !== "") payload.description = description;
        await createScope(selectedOrgId, payload);
        setFormOpen(false);
        setNotice(`Authorized “${domainPattern}”. Discovery itself arrives in Phase 3.`);
        setReloadKey((k) => k + 1);
      } catch (cause: unknown) {
        setFormProblem(describeAuthError(cause));
      } finally {
        setFormBusy(false);
      }
    },
    [formBusy, selectedOrgId],
  );

  const handleDeactivate = useCallback(
    async (scope: Scope) => {
      if (selectedOrgId === null) return;
      try {
        await deleteScope(selectedOrgId, scope.id);
        setNotice(`“${scope.domain_pattern}” was deactivated.`);
        setReloadKey((k) => k + 1);
      } catch (cause: unknown) {
        setNotice(null);
        setFormProblem(describeAuthError(cause));
      }
    },
    [selectedOrgId],
  );

  const scopeList = scopes.loading || scopes.error !== null ? [] : (scopes.data ?? []);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-text">Scopes</h1>
        <p className="mt-1 text-[13px] text-muted">
          Authorized internet-facing domains. Discovery never runs outside them.
        </p>
      </div>

      <OrgPicker
        orgs={orgs.data ?? []}
        selectedId={selectedOrgId}
        loading={orgs.loading}
        onSelect={(id) => {
          setSelectedOrgId(id);
          setFormOpen(false);
          setNotice(null);
          setFormProblem(null);
        }}
      />

      {formProblem !== null && formOpen === false && (
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

      <Panel
        title="Authorized domains"
        description="Subdomain wildcards include every subdomain. Exact patterns match only themselves."
        action={
          isAdmin && selectedOrgId !== null ? (
            <Button variant="ghost" onClick={() => { setFormOpen((open) => !open); setFormProblem(null); }}>
              {formOpen ? (
                "Cancel"
              ) : (
                <>
                  <Plus size={14} aria-hidden /> Add domain
                </>
              )}
            </Button>
          ) : undefined
        }
      >
        {formOpen && isAdmin && selectedOrgId !== null && (
          <form
            onSubmit={handleCreate}
            data-testid="scope-create-form"
            className="mb-5 flex flex-col gap-4 rounded-quiet border border-border bg-surface-3/30 p-4"
          >
            {formProblem !== null && <ErrorNotice title={formProblem} />}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Scope name" htmlFor="scope-name">
                <TextInput
                  id="scope-name"
                  name="name"
                  required
                  minLength={3}
                  maxLength={200}
                  placeholder="Corporate web estate"
                />
              </Field>
              <Field
                label="Domain pattern"
                htmlFor="scope-pattern"
                hint="example.com or *.example.com — dotted domains only."
              >
                <TextInput
                  id="scope-pattern"
                  name="domain_pattern"
                  required
                  maxLength={255}
                  spellCheck={false}
                  placeholder="example.com"
                />
              </Field>
            </div>
            <Field label="Description (optional)" htmlFor="scope-description">
              <TextInput
                id="scope-description"
                name="description"
                maxLength={500}
                placeholder="Why this domain is authorized"
              />
            </Field>
            <div>
              <Button type="submit" disabled={formBusy}>
                {formBusy ? (
                  <>
                    <Spinner label="Authorizing" /> Authorizing…
                  </>
                ) : (
                  "Authorize domain"
                )}
              </Button>
            </div>
          </form>
        )}

        {scopes.loading && (
          <div className="flex items-center gap-2.5 py-3 text-[13px] text-muted" role="status">
            <Spinner label="Loading scopes" />
            Loading authorized domains…
          </div>
        )}

        {!scopes.loading && scopes.error !== null && (
          <ErrorNotice
            title="Scopes could not be loaded"
            detail={scopes.error}
            onRetry={() => setReloadKey((k) => k + 1)}
          />
        )}

        {!scopes.loading && scopes.error === null && scopeList.length === 0 && (
          <EmptyState
            icon={<Crosshair size={24} />}
            title="No authorized domains yet"
            action={
              isAdmin ? undefined : (
                <p className="text-[11px] text-faint">
                  Only members with the admin or owner role can authorize domains.
                </p>
              )
            }
          >
            {isAdmin
              ? "Authorize your first domain so that Phase 3 discovery has a defined, safe boundary to work inside."
              : "This organization has not authorized any domains yet. An admin or owner must do this before discovery can run in Phase 3."}
          </EmptyState>
        )}

        {!scopes.loading && scopes.error === null && scopeList.length > 0 && (
          <ul className="flex flex-col" data-testid="scope-list">
            {scopeList.map((scope) => (
              <ScopeRow
                key={scope.id}
                scope={scope}
                isAdmin={isAdmin}
                onDeactivate={handleDeactivate}
              />
            ))}
          </ul>
        )}
      </Panel>

      <p className="text-[12px] leading-relaxed text-faint">
        Phase 2 ships scope infrastructure only: authorization, validation and the audit
        trail. Scanning and discovery arrive in Phase 3 — nothing here visits or probes a
        domain yet.
      </p>
    </div>
  );
}

function ScopeRow({
  scope,
  isAdmin,
  onDeactivate,
}: {
  scope: Scope;
  isAdmin: boolean;
  onDeactivate: (scope: Scope) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <li className="flex items-center justify-between gap-4 border-b border-border/60 py-3 last:border-none">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5">
          <span className="truncate text-[14px] font-medium text-text break-words" title={scope.name}>
            {scope.name}
          </span>
          <code className="rounded-quiet bg-surface-3/60 px-1.5 py-0.5 text-[12px] text-accent">
            {scope.domain_pattern}
          </code>
        </div>
        <p className="mt-0.5 truncate break-words text-[12px] text-faint">
          {scope.description ?? `Since ${new Date(scope.created_at).toLocaleDateString()}`}
        </p>
      </div>
      {isAdmin && (
        <div className="shrink-0">
          {confirming ? (
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                onClick={() => void onDeactivate(scope)}
                title="Deactivate this scope"
              >
                <Trash2 size={13} aria-hidden /> Confirm
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Keep
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              onClick={() => setConfirming(true)}
              title={`Deactivate ${scope.domain_pattern}`}
            >
              Remove
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
