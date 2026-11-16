/**
 * Scopes page tests: honest 4-state regions (loading / empty / error / full),
 * admin-gated affordances, and the no-fake-data rule.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AppRoutes } from "@/App";

const orgsService = vi.hoisted(() => ({
  listOrganizations: vi.fn(),
  createOrganization: vi.fn(),
  listScopes: vi.fn(),
  createScope: vi.fn(),
  updateScope: vi.fn(),
  deleteScope: vi.fn().mockResolvedValue(undefined),
  listMembers: vi.fn(),
  addMember: vi.fn(),
  removeMember: vi.fn(),
  assignRole: vi.fn(),
  listAuditEntries: vi.fn(),
}));
vi.mock("@/services/organizationsService", () => orgsService);

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

const USER_ID = 7;

function mockSession(username: string) {
  sessionMock.getSession.mockResolvedValue({
    id: USER_ID,
    username,
    email: null,
    is_active: true,
    is_superuser: false,
    is_verified: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

const memberFor = (role: "owner" | "admin" | "analyst" | "viewer", username = "scope_admin") => [
  { user_id: 99, username: "other_member", role: "viewer", joined_at: new Date().toISOString() },
  { user_id: USER_ID, username, role, joined_at: new Date().toISOString() },
];

const ORGS = [{ id: 1, name: "Acme Security", description: null, is_active: true, created_at: "", updated_at: "" }];

beforeEach(() => {
  orgsService.listOrganizations.mockResolvedValue(ORGS);
  orgsService.listMembers.mockResolvedValue(memberFor("owner"));
  orgsService.listScopes.mockResolvedValue([]);
});

function renderScopes() {
  return render(
    <MemoryRouter initialEntries={["/app/scopes"]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe("ScopesPage", () => {
  it("shows the honest empty state when no domains are authorized", async () => {
    mockSession("scope_admin");
    orgsService.listScopes.mockResolvedValue([]);
    renderScopes();

    expect(
      await screen.findByRole("heading", { name: "No authorized domains yet" }),
    ).toBeInTheDocument();
  });

  it("offers the authoring form to admins and submits it", async () => {
    const user = userEvent.setup();
    mockSession("scope_admin");
    orgsService.createScope.mockResolvedValue({
      id: 5,
      name: "Corporate web estate",
      description: null,
      domain_pattern: "example.com",
      is_active: true,
      organization_id: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    renderScopes();

    await user.click(await screen.findByRole("button", { name: /Add domain/i }));
    await user.type(await screen.findByLabelText("Scope name"), "Corporate web estate");
    await user.type(screen.getByLabelText(/Domain pattern/i), "example.com");
    await user.click(screen.getByRole("button", { name: /Authorize domain/i }));

    await waitFor(() => {
      expect(orgsService.createScope).toHaveBeenCalledWith(1, {
        name: "Corporate web estate",
        domain_pattern: "example.com",
      });
    });
  });

  it("blocks obviously invalid domain patterns client-side and stays honest about why", async () => {
    const user = userEvent.setup();
    mockSession("scope_admin");
    renderScopes();

    await user.click(await screen.findByRole("button", { name: /Add domain/i }));
    await user.type(await screen.findByLabelText("Scope name"), "Local net");
    await user.type(screen.getByLabelText(/Domain pattern/i), "localhost");
    await user.click(screen.getByRole("button", { name: /Authorize domain/i }));

    expect(
      await screen.findByText(/Single-label hosts and bare IPs are not authorizable/i),
    ).toBeInTheDocument();
    expect(orgsService.createScope).not.toHaveBeenCalled();
  });

  it("renders authorized scopes as rows and nothing invented", async () => {
    mockSession("scope_admin");
    orgsService.listScopes.mockResolvedValue([
      {
        id: 2,
        name: "Corporate web estate",
        description: "The main marketing site",
        domain_pattern: "example.com",
        is_active: true,
        organization_id: 1,
        created_at: "2026-01-01T00:00:00",
        updated_at: "2026-01-01T00:00:00",
      },
    ]);
    renderScopes();

    expect(await screen.findByText("Corporate web estate")).toBeInTheDocument();
    expect(screen.getByText("example.com")).toBeInTheDocument();
    expect(screen.queryByText(/1,240/)).not.toBeInTheDocument();
  });

  it("hides authoring affordances from viewers — the backend enforces the rest", async () => {
    mockSession("plain_viewer");
    orgsService.listMembers.mockResolvedValue(memberFor("viewer", "plain_viewer"));
    orgsService.listScopes.mockResolvedValue([]);
    renderScopes();

    await screen.findByRole("heading", { name: "No authorized domains yet" });
    expect(screen.queryByRole("button", { name: /Add domain/i })).not.toBeInTheDocument();
  });

  it("shows an error state with retry when scopes fail to load", async () => {
    mockSession("scope_admin");
    orgsService.listScopes.mockRejectedValue(new Error("network down"));
    renderScopes();

    expect(await screen.findByText(/Scopes could not be loaded/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try again/i })).toBeInTheDocument();
  });
});
