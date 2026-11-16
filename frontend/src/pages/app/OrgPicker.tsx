/**
 * Organization switcher used by the Phase 2 screens.
 * Renders the organizations the signed-in user actually belongs to — the
 * list comes from `GET /organizations`, never invented.
 */

import { Spinner } from "@/components/ui/Primitives";

export function OrgPicker({
  orgs,
  selectedId,
  loading,
  onSelect,
}: {
  orgs: { id: number; name: string }[];
  selectedId: number | null;
  loading: boolean;
  onSelect: (orgId: number) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2.5 text-[13px] text-muted" role="status">
        <Spinner label="Loading organizations" />
        Loading your organizations…
      </div>
    );
  }

  if (orgs.length === 0) {
    return (
      <p className="text-[13px] text-muted">
        You are not a member of any organization. Every registered user gets one
        automatically — if this list is empty, contact a platform administrator.
      </p>
    );
  }

  return (
    <div
      role="group"
      aria-label="Select organization"
      className="flex flex-wrap items-center gap-2"
    >
      {orgs.map((org) => {
        const active = org.id === selectedId;
        return (
          <button
            key={org.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(org.id)}
            className={`rounded-quiet border px-3 py-1.5 text-[13px] font-medium transition-colors ${
              active
                ? "border-accent-dim bg-accent/10 text-accent"
                : "border-border bg-surface-2 text-muted hover:border-border-strong hover:text-text"
            }`}
          >
            {org.name}
          </button>
        );
      })}
    </div>
  );
}
