/**
 * Application-wide session state.
 *
 * One source of truth for "who is signed in", resolved purely from the
 * backend (`GET /auth/me` + HttpOnly cookie). Nothing about the session is
 * persisted in localStorage — a closed tab or an expired cookie simply
 * returns the user to the anonymous state.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ApiError } from "@/services/apiClient";
import * as sessionService from "@/services/sessionService";
import { SessionContext, type SessionStatus } from "@/app/sessionContext";
import type { SessionUser } from "@/types/api";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("checking");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checkFailed, setCheckFailed] = useState(false);
  const inFlight = useRef(false);
  const unmounted = useRef(false);

  // Non-async loader (same accepted pattern as `useBackendHealth`): the
  // synchronous "reset" writes happen inside the loader, async results land
  // in promise callbacks that react to the external system (the backend).
  const refreshSession = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    sessionService
      .getSession()
      .then((me) => {
        if (unmounted.current) return;
        setUser(me);
        setStatus("authenticated");
        setCheckFailed(false);
      })
      .catch((cause: unknown) => {
        if (unmounted.current) return;
        setUser(null);
        setStatus("anonymous");
        // Only a 401 is a definitive "not signed in"; anything else is a
        // connectivity failure worth surfacing.
        setCheckFailed(!(cause instanceof ApiError && cause.status === 401));
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, []);

  useEffect(() => {
    unmounted.current = false;
    refreshSession();
    return () => {
      unmounted.current = true;
    };
  }, [refreshSession]);

  const signIn = useCallback(
    (username: string, password: string) =>
      sessionService.login(username, password).then((me) => {
        setUser(me);
        setStatus("authenticated");
        setCheckFailed(false);
        return me;
      }),
    [],
  );

  const signUp = useCallback(
    (input: Parameters<typeof sessionService.register>[0]) =>
      sessionService.register(input).then((me) => {
        setUser(me);
        setStatus("authenticated");
        setCheckFailed(false);
        return me;
      }),
    [],
  );

  const signOut = useCallback(
    () =>
      sessionService
        .logout()
        .catch(() => undefined)
        .then(() => {
          // Even if the logout call fails (network), never keep a stale user.
          setUser(null);
          setStatus("anonymous");
        }),
    [],
  );

  return (
    <SessionContext.Provider value={{ status, user, checkFailed, signIn, signUp, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}
