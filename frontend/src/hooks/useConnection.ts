/** Public hook for shared backend-connection state (see app/connection.tsx). */

import { useConnectionValue } from "@/app/connection";
import type { ConnectionValue } from "@/app/connection";

export function useConnection(): ConnectionValue {
  const value = useConnectionValue();
  if (value === null) {
    throw new Error(
      "useConnection() requires a ConnectionProvider — pages must be rendered inside the AppShell.",
    );
  }
  return value;
}
