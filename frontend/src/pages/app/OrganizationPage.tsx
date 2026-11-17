/**
 * Organization — members, roles and the security activity trail.
 *
 * Membership is readable by every member (viewer+); the activity trail is
 * admin+ only, on both sides of the glass: the backend refuses other roles
 * with 403, and the UI simply does not offer it to them.
 */

import { useCallback, useMemo, useState } from "react";
import { ClipboardList, Trash2, Users } from "lucide-react";
import { roleAtLeast, useSession } from "@/app/useSession";
import { OrgPicker } from "@/pages/app/OrgPicker";
import { useResource } from "@/hooks/useResource";
import {
  Badge,
  Button,
  EmptyState,
  ErrorNotice,
  Panel,
  SelectInput,
  Spinner,
} from "@/components/ui/Primitives";
import {
  assignRole,
  listAuditEntries,
  listMembers,
  listOrganizations,
  removeMember,
} from "@/services/organizationsService";
import { describeAuthError } from "@/app/authErrors";
import type {
  AuditEntry,
  OrganizationMember,
  OrganizationRole,
} from "@/types/api";

const ROLES: OrganizationRole[] = ["owner", "admin", "analyst", "viewer"];

const ACTION_LABELS: Record<string, string> = {
  user_register: "Account registered",
  user_login: "Signed in",
  user_login_failed: "Sign-in failed",
  user_logout: "Signed out",
  user_password_change: "Password changed",
  org_create: "Organization created",
  org_member_add: "Member added",
  org_member_remove: "Member removed",
  scope_create: "Scope authorized",
  scope_update: "Scope updated",
  scope_delete: "Scope deactivated",
  role_assign: "Role assigned",
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replaceAll("_", " ");
}

const ROLE_TONES: Record<OrganizationRole, "accent" | "ok" | "neutral" | "warn"> = {
  owner: "accent",
  admin: "warn",
  analyst: "ok",
  viewer: "neutral",
};

export function OrganizationPage() {
  const session = useSession();
  const myUserId = session.user?.id ?? -1;

  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [actionProblem, setActionProblem] = useState<string | null>(null);

  const loadOrgs = useCallback(() => listOrganizations(), []);
  const orgs = useResource(loadOrgs, 0, describeAuthError);

  // Default to the first organization during render — most users belong to
  // exactly one, and an explicit pick from the picker always wins.
  const fallbackOrgId = (orgs.data ?? [])[0]?.id ?? null;
  const activeOrgId = selectedOrgId ?? fallbackOrgId;

  const loadMembers = useCallback(
    () =>
      activeOrgId === null
        ? Promise.resolve<OrganizationMember[]>([])
        : listMembers(activeOrgId),
    [activeOrgId],
  );

  const members = useResource(
    loadMembers,
    `${activeOrgId ?? "none"}#${reloadKey}`,
    describeAuthError,
  );

  // Resolve the signed-in member's role; a failure keeps privileges hidden.
  const role: OrganizationRole | null = useMemo(
    () =>
      members.data?.find((m) => m.user_id === myUserId)?.role ??
      (members.error !== null ? "viewer" : null),
    [members.data, members.error, myUserId],
  );
  const canManageOrg = roleAtLeast(role ?? "viewer", "admin");
  const canViewAudit = canManageOrg;

  const loadAudit = useCallback(
    () =>
      !canViewAudit || activeOrgId === null
        ? Promise.resolve<AuditEntry[]>([])
        : listAuditEntries(activeOrgId),
    [canViewAudit, activeOrgId],
  );

  const audit = useResource(
    loadAudit,
    `${activeOrgId ?? "none"}#${canViewAudit}#${reloadKey}`,
    describeAuthError,
  );

  const ownerCount = (members.data ?? []).filter((m) => m.role === "owner").length;

  const handleRoleChange = useCallback(
    async (member: OrganizationMember, nextRole: OrganizationRole) => {
      if (activeOrgId === null || member.role === nextRole) return;
      setActionProblem(null);
      try {
        await assignRole(activeOrgId, member.user_id, nextRole);
        setReloadKey((k) => k + 1);
      } catch (cause: unknown) {
        setActionProblem(describeAuthError(cause));
      }
    },
    [activeOrgId],
  );

  const handleRemove = useCallback(
    async (member: OrganizationMember) => {
      if (activeOrgId === null) return;
      setActionProblem(null);
      try {
        await removeMember(activeOrgId, member.user_id);
        setReloadKey((k) => k + 1);
      } catch (cause: unknown) {
        setActionProblem(describeAuthError(cause));
      }
    },
    [activeOrgId],
  );

  const memberList = members.loading || members.error !== null ? [] : (members.data ?? []);
  const auditList = audit.loading || audit.error !== null ? [] : (audit.data ?? []);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-text">Organization</h1>
        <p className="mt-1 text-[13px] text-muted">
          Members, their roles and the security activity of the current organization.
        </p>
      </div>

      <OrgPicker
        orgs={orgs.data ?? []}
        selectedId={activeOrgId}
        loading={orgs.loading}
        onSelect={(id) => {
          setSelectedOrgId(id);
          setActionProblem(null);
        }}
      />

      {actionProblem !== null && (
        <ErrorNotice title={actionProblem} onRetry={() => setActionProblem(null)} />
      )}

      <Panel
        title="Members"
        description="Usernames and roles only — this screen never exposes emails."
      >
        {members.loading && (
          <div className="flex items-center gap-2.5 py-3 text-[13px] text-muted" role="status">
            <Spinner label="Loading members" />
            Loading roster…
          </div>
        )}

        {!members.loading && members.error !== null && (
          <ErrorNotice
            title="Members could not be loaded"
            detail={members.error}
            onRetry={() => setReloadKey((k) => k + 1)}
          />
        )}

        {!members.loading && members.error === null && memberList.length === 0 && (
          <EmptyState icon={<Users size={24} />} title="No members to show">
            This list appears as soon as the organization has members.
          </EmptyState>
        )}

        {!members.loading && members.error === null && memberList.length > 0 && (
          <ul className="flex flex-col" data-testid="member-list">
            {memberList.map((member) => {
              const isLastOwner = member.role === "owner" && ownerCount <= 1;
              const canManage = canViewAudit && !isLastOwner;
              return (
                <li
                  key={member.user_id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 py-3 last:border-none"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface-3/60 text-[12px] font-semibold text-accent"
                    >
                      {member.username.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="truncate text-[14px] font-medium text-text">
                          {member.username}
                        </span>
                        {member.user_id === myUserId && (
                          <span className="text-[11px] text-faint">(you)</span>
                        )}
                      </div>
                      <span className="text-[12px] text-faint">
                        Joined {new Date(member.joined_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2.5">
                    <Badge tone={ROLE_TONES[member.role]}>{member.role}</Badge>
                    {canManage ? (
                      <>
                        <SelectInput
                          aria-label={`Role for ${member.username}`}
                          className="w-28 px-2 py-1 text-[12px]"
                          value={member.role}
                          onChange={(event) =>
                            void handleRoleChange(
                              member,
                              event.target.value as OrganizationRole,
                            )
                          }
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </SelectInput>
                        <RemoveButton onConfirm={() => void handleRemove(member)} />
                      </>
                    ) : (
                      isLastOwner && (
                        <span
                          className="text-[11px] text-faint"
                          title="The last owner cannot be demoted or removed"
                        >
                          last owner
                        </span>
                      )
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {!canViewAudit && memberList.length > 0 && activeOrgId !== null && (
          <p className="mt-4 text-[12px] text-faint">
            Only members with the admin or owner role can change roles or remove members.
          </p>
        )}
      </Panel>

      <Panel
        title="Activity"
        description={
          canViewAudit && activeOrgId !== null
            ? "Security events recorded for this organization — no IP addresses, agents or secrets."
            : "The activity trail is restricted to organization admins and owners."
        }
      >
        {!canViewAudit ? (
          <p className="flex items-center gap-2 py-3 text-[13px] text-muted">
            <ClipboardList size={15} className="shrink-0 text-accent" aria-hidden />
            Ask an admin if you need to review recent activity.
          </p>
        ) : audit.loading ? (
          <div className="flex items-center gap-2.5 py-3 text-[13px] text-muted" role="status">
            <Spinner label="Loading activity" />
            Loading activity…
          </div>
        ) : audit.error !== null ? (
          <ErrorNotice
            title="Activity could not be loaded"
            detail={audit.error}
            onRetry={() => setReloadKey((k) => k + 1)}
          />
        ) : auditList.length === 0 ? (
          <EmptyState icon={<ClipboardList size={24} />} title="No activity recorded yet">
            Events appear here as members sign in and scopes or roles change. Entries carry
            only the action, outcome, time and acting username.
          </EmptyState>
        ) : (
          <ul className="flex flex-col" data-testid="audit-list">
            {auditList.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-4 border-b border-border/60 py-2.5 last:border-none"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="shrink-0 text-[13px] break-words text-text">
                    {actionLabel(entry.action)}
                  </span>
                  {entry.outcome !== "success" && <Badge tone="danger">{entry.outcome}</Badge>}
                  {entry.actor_username !== null && (
                    <span className="truncate text-[12px] text-faint">
                      — {entry.actor_username}
                    </span>
                  )}
                </div>
                <time className="shrink-0 text-[12px] text-faint" dateTime={entry.created_at}>
                  {formatEventTime(entry.created_at)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function formatEventTime(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function RemoveButton({ onConfirm }: { onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button
        variant="ghost"
        onClick={() => setConfirming(true)}
        title="Remove this member"
        className="px-2.5 py-1.5 text-[12px]"
      >
        Remove
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <Button variant="ghost" onClick={onConfirm} className="border-danger/40 px-2.5 py-1.5 text-[12px] text-danger">
        <Trash2 size={13} aria-hidden /> Confirm
      </Button>
      <Button
        variant="ghost"
        onClick={() => setConfirming(false)}
        className="px-2.5 py-1.5 text-[12px]"
      >
        Keep
      </Button>
    </div>
  );
}
