/**
 * Auth flow tests: the session guard, the login screen and its honest
 * error surface. No fake data — failures are real failures, mocked at the
 * service boundary.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppRoutes } from "@/App";
import { ApiError } from "@/services/apiClient";

const sessionMock = vi.hoisted(() => ({
  getSession: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn().mockResolvedValue({ detail: "ok" }),
  changePassword: vi.fn(),
}));
vi.mock("@/services/sessionService", () => sessionMock);

vi.mock("@/services/healthService", () => ({
  getHealth: vi.fn().mockResolvedValue({
    status: "ok",
    application: "AegisGraph",
    version: "0.1.0",
    environment: "development",
    database: "connected",
    timestamp: new Date().toISOString(),
  }),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe("RequireAuth", () => {
  it("redirects anonymous visitors from /app to /login", async () => {
    sessionMock.getSession.mockRejectedValue(
      new ApiError("http", "Not authenticated", { status: 401, code: "http_401" }),
    );
    renderAt("/app/overview");
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("shows a checking state while the session is being resolved", async () => {
    sessionMock.getSession.mockImplementation(() => new Promise(() => undefined));
    renderAt("/app/overview");
    expect(await screen.findByText(/Checking your session/i)).toBeInTheDocument();
  });
});

describe("LoginPage", () => {
  it("surfaces a calm, specific message on wrong credentials", async () => {
    const user = userEvent.setup();
    sessionMock.getSession.mockRejectedValue(
      new ApiError("http", "Not authenticated", { status: 401, code: "http_401" }),
    );
    sessionMock.login.mockRejectedValue(
      new ApiError("http", "Incorrect username or password", { status: 401, code: "http_401" }),
    );

    renderAt("/login");
    await user.type(await screen.findByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: /Sign in/i }));

    expect(
      await screen.findByText(/not recognized/i),
    ).toBeInTheDocument();
    // No password material is ever echoed into the error surface.
    expect(screen.queryByText(/wrong-password/)).not.toBeInTheDocument();
  });

  it("signs in and enters the application on success", async () => {
    const user = userEvent.setup();
    // The boot check starts anonymous; only the login call establishes the session.
    sessionMock.getSession.mockRejectedValue(
      new ApiError("http", "Not authenticated", { status: 401, code: "http_401" }),
    );
    sessionMock.login.mockResolvedValue({
      id: 1,
      username: "alice",
      email: null,
      is_active: true,
      is_superuser: false,
      is_verified: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    sessionMock.login.mockResolvedValue({
      id: 1,
      username: "alice",
      email: null,
      is_active: true,
      is_superuser: false,
      is_verified: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    renderAt("/login");
    await user.type(await screen.findByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Password"), "correct-horse");
    await user.click(screen.getByRole("button", { name: /Sign in/i }));

    expect(await screen.findByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByTestId("user-menu-button")).toHaveTextContent("alice");
  });

  it("blocks empty submissions before touching the backend", async () => {
    const user = userEvent.setup();
    sessionMock.getSession.mockRejectedValue(
      new ApiError("http", "Not authenticated", { status: 401, code: "http_401" }),
    );

    renderAt("/login");
    await user.click(await screen.findByRole("button", { name: /Sign in/i }));

    expect(sessionMock.login).not.toHaveBeenCalled();
  });
});
