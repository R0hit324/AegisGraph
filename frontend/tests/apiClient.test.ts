import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, getApiBaseUrl, request } from "@/services/apiClient";

describe("getApiBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to the documented local backend", () => {
    vi.stubEnv("VITE_API_BASE_URL", undefined as unknown as string);
    expect(getApiBaseUrl()).toBe("http://localhost:8000");
  });

  it("uses the configured value and strips trailing slashes", () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com/");
    expect(getApiBaseUrl()).toBe("https://api.example.com");
  });
});

describe("request", () => {
  it("builds absolute URLs against the configured base", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await request<{ ok: boolean }>("/api/v1/health");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe("http://localhost:8000/api/v1/health");
  });

  it("rejects unsafe paths instead of guessing", async () => {
    await expect(request<unknown>("api/v1/health")).rejects.toMatchObject({
      kind: "parse",
    });
  });

  it("surfaces the backend error envelope on HTTP failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "database_unavailable",
              message: "The database is currently unavailable.",
            },
          }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const error = await request<unknown>("/api/v1/health").catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("database_unavailable");
    expect((error as ApiError).status).toBe(503);
  });

  it("reports network failures with a calm message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("net::ERR")));
    const error = await request<unknown>("/api/v1/health").catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).kind).toBe("network");
    expect((error as ApiError).message).toContain("Could not reach the backend");
  });

  it("does not send credentials with requests", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await request<unknown>("/api/v1/health");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.credentials).toBe("omit");
  });
});
