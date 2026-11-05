/**
 * Shared backend-connection state.
 * The AppShell owns a single `useBackendHealth` subscription and exposes it to
 * pages through this context. Pages must be rendered under the AppShell
 * provider (which is true for every application route).
 */

import { createContext, useContext, type ReactNode } from "react";
import type { ConnectionState } from "@/hooks/useBackendHealth";

export type ConnectionValue = ConnectionState & { refresh: () => void };

const ConnectionContext = createContext<ConnectionValue | null>(null);

export function ConnectionProvider({
  value,
  children,
}: {
  value: ConnectionValue;
  children: ReactNode;
}) {
  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

/** Internal hook — prefer the public facade in `hooks/useConnection.ts`. */
export function useConnectionValue(): ConnectionValue | null {
  return useContext(ConnectionContext);
}
