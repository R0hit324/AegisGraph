/**
 * Centralized HTTP client.
 *
 * Configuration and security rules:
 * - The backend base URL comes from `VITE_API_BASE_URL` ONLY (public value).
 *   Never hardcode URLs at call sites. Secrets NEVER pass through this client.
 * - Every request carries a hard timeout through `AbortSignal`.
 * - Every request sends credentials: the Phase 2 session lives in an
 *   HttpOnly cookie (`aegis_access_token`) that JavaScript can never read;
 *   the browser attaches it automatically when CORS allow-credentials and
 *   the explicit origin allowlist permit it.
 * - Error bodies are parsed defensively; unknown shapes never crash callers.
 */

import type { ApiErrorPayload } from "@/types/api";

const DEFAULT_TIMEOUT_MS = 10_000;

export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (typeof configured === "string" && configured.trim() !== "") {
    return configured.trim().replace(/\/+$/, "");
  }
  // Local development default. Safe to publish — it is a public endpoint URL.
  return "http://localhost:8000";
}

/** Structured error thrown by every failed API call. */
export class ApiError extends Error {
  readonly status: number | undefined;
  readonly code: string;
  readonly kind: "network" | "timeout" | "http" | "parse";

  constructor(
    kind: ApiError["kind"],
    message: string,
    options?: { status?: number; code?: string; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "ApiError";
    this.kind = kind;
    this.status = options?.status;
    this.code = options?.code ?? "unknown";
  }
}

function resolveUrl(path: string): string {
  if (!path.startsWith("/")) {
    throw new ApiError("parse", `Request path must be absolute within the API: got '${path}'`);
  }
  const base = getApiBaseUrl();
  if (base === "") return path; // same origin backend (reverse proxy scenario)
  try {
    return new URL(base + path).toString();
  } catch {
    throw new ApiError("parse", "Configured backend base URL is not a valid URL");
  }
}

/**
 * Minimal JSON request helper. Success is asserted by HTTP status; the caller
 * owns schema expectations.
 */
export async function request<T>(
  path: string,
  init: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    /** JSON body — serialized with Content-Type: application/json. */
    body?: unknown;
    /** Pre-encoded body (e.g. form login) sent with an explicit content type. */
    bodyText?: string;
    contentType?: string;
    timeoutMs?: number;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    bodyText,
    contentType,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
  } = init;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (bodyText !== undefined) {
    headers["Content-Type"] = contentType ?? "application/x-www-form-urlencoded";
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let timedOut = false;
  const timeoutSignal = new AbortController();
  const externalAbort = () => {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    timeoutSignal.abort();
  };
  if (signal) {
    signal.addEventListener("abort", externalAbort, { once: true });
  }
  const timeoutHandle = setTimeout(() => {
    timedOut = true;
    timeoutSignal.abort();
  }, timeoutMs);

  // URL resolution happens BEFORE the network try-block so that configuration
  // errors (invalid path/base URL) keep their precise error kind.
  const url = resolveUrl(path);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      ...(bodyText !== undefined
        ? { body: bodyText }
        : body !== undefined
          ? { body: JSON.stringify(body) }
          : {}),
      signal: timeoutSignal.signal,
      credentials: "include",
      referrerPolicy: "strict-origin-when-cross-origin",
    });
  } catch (cause) {
    clearTimeout(timeoutHandle);
    if (timedOut) {
      throw new ApiError("timeout", `The API did not respond within ${timeoutMs}ms.`);
    }
    if (signal?.aborted) {
      throw new ApiError("network", "Request cancelled.");
    }
    throw new ApiError("network", `Could not reach the backend at ${getApiBaseUrl()}.`, {
      cause: cause as Error,
    });
  }
  clearTimeout(timeoutHandle);

  // 204 No Content (delete endpoints) has no body to parse.
  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    // The backend error envelope is {"error": {"code", "message"}} for the
    // versioned API routes, but FastAPI's built-in HTTPException responses
    // (auth and organizations) use {"detail": "..."}. Parse both defensively;
    // unknown shapes never crash callers.
    let code = `http_${response.status}`;
    let message = `The API responded with HTTP ${response.status}.`;
    try {
      const payload = (await response.json()) as Partial<ApiErrorPayload> & {
        detail?: unknown;
      };
      const envelope = payload.error;
      if (
        envelope &&
        typeof envelope.message === "string" &&
        typeof envelope.code === "string"
      ) {
        code = envelope.code;
        message = envelope.message;
      } else if (typeof payload.detail === "string" && payload.detail !== "") {
        message = payload.detail;
      }
    } catch {
      // Non-JSON body — keep generic message.
    }
    throw new ApiError("http", message, { status: response.status, code });
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError("parse", "The API returned a malformed response body.", {
      status: response.status,
    });
  }
}
