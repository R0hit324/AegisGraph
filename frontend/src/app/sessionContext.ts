/**
 * Session context object and contract.
 * Kept separate from the provider component so the `useSession` hook and
 * plain helpers can live in non-component modules without tripping
 * fast-refresh lint rules.
 */

import { createContext } from "react";
import type { SessionUser } from "@/types/api";

export type SessionStatus = "checking" | "anonymous" | "authenticated";

export interface SessionValue {
  status: SessionStatus;
  user: SessionUser | null;
  /** True when the session check itself failed (backend unreachable). */
  checkFailed: boolean;
  signIn: (username: string, password: string) => Promise<SessionUser>;
  signUp: (input: { username: string; email?: string; password: string }) => Promise<SessionUser>;
  signOut: () => Promise<void>;
}

export const SessionContext = createContext<SessionValue | null>(null);
