/**
 * Session hook and role helpers.
 * Plain functions in a non-component module (fast-refresh friendly); the
 * context object itself lives in `app/sessionContext.ts`.
 */

import { useContext } from "react";
import { SessionContext } from "@/app/sessionContext";
import type { SessionValue } from "@/app/sessionContext";

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (value === null) {
    throw new Error("useSession must be used inside <SessionProvider>.");
  }
  return value;
}

/**
 * Convenience flag for role-gated UI affordances. Mirrors the backend
 * hierarchy (viewer < analyst < admin < owner) — presentation only; every
 * privileged operation is re-enforced server-side.
 */
export function roleAtLeast(
  role: string,
  minimum: "viewer" | "analyst" | "admin" | "owner",
): boolean {
  const hierarchy: Record<string, number> = { viewer: 1, analyst: 2, admin: 3, owner: 4 };
  return (hierarchy[role] ?? 0) >= hierarchy[minimum];
}
