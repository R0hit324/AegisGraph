/**
 * Resource hook for "load list for key X" panels (scopes, members, audit...).
 *
 * All state writes happen inside promise callbacks — never synchronously in
 * the effect body — so switching keys goes through render-time derivation:
 * `loading` is simply "the stored data belongs to an older key", which keeps
 * stale rows from ever being displayed while the new request is in flight.
 *
 * Callers pass a STABLE loader (useCallback) whose identity changes exactly
 * when the inputs change; the key must change with it (it encodes the same
 * inputs), so each combination loads exactly once.
 */

import { useEffect, useState } from "react";

export interface ResourceResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface Stored<T> {
  key: number | string;
  data: T | null;
  error: string | null;
}

export function useResource<T>(
  load: () => Promise<T>,
  key: number | string,
  mapError: (cause: unknown) => string,
): ResourceResult<T> {
  const [stored, setStored] = useState<Stored<T>>({ key: NaN, data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => {
        if (!cancelled) setStored({ key, data, error: null });
      })
      .catch((cause: unknown) => {
        if (!cancelled) setStored({ key, data: null, error: mapError(cause) });
      });
    return () => {
      cancelled = true;
    };
  }, [load, key, mapError]);

  const settled = stored.key === key;
  return {
    data: settled ? stored.data : null,
    loading: !settled,
    error: settled ? stored.error : null,
  };
}
