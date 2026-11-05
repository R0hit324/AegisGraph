/** Client-side hook tracking backend reachability for the whole app. */

import { useCallback, useEffect, useRef, useState } from "react";
import { getHealth } from "@/services/healthService";
import { ApiError } from "@/services/apiClient";
import type { HealthResponse } from "@/types/api";

export interface ConnectionState {
  phase: "loading" | "online" | "offline";
  health: HealthResponse | null;
  error: string | null;
  lastCheckedAt: string | null;
}

const POLL_INTERVAL_MS = 30_000;

/** Map low-level ApiError kinds to calm, human-facing status text. */
export function describeConnectionError(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case "timeout":
        return "The backend did not respond in time.";
      case "network":
        return "Could not reach the backend.";
      case "http":
        return `The backend responded with an error (${error.code}).`;
      case "parse":
        return "The backend sent an unexpected response.";
    }
  }
  return "An unexpected error occurred while contacting the backend.";
}

export function useBackendHealth(): ConnectionState & { refresh: () => void } {
  const [state, setState] = useState<ConnectionState>({
    phase: "loading",
    health: null,
    error: null,
    lastCheckedAt: null,
  });
  const inFlight = useRef(false);
  const unmounted = useRef(false);

  const refresh = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    setState((previous) => ({
      ...previous,
      phase: previous.health === null ? "loading" : previous.phase,
      error: null,
    }));
    getHealth()
      .then((health) => {
        if (!unmounted.current) {
          setState({
            phase: "online",
            health,
            error: null,
            lastCheckedAt: new Date().toISOString(),
          });
        }
      })
      .catch((cause: unknown) => {
        if (!unmounted.current) {
          setState({
            phase: "offline",
            health: null,
            error: describeConnectionError(cause),
            lastCheckedAt: new Date().toISOString(),
          });
        }
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, []);

  useEffect(() => {
    unmounted.current = false;
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      unmounted.current = true;
      clearInterval(interval);
    };
  }, [refresh]);

  return { ...state, refresh };
}
