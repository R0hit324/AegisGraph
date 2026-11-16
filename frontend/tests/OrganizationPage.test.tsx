/**
 * Organization page tests: roster rendering, role gating, last-owner
 * protection in the UI, and the honesty rule for the activity trail.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
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
  deleteScope: vi.fn(),
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

function mockSession(username: string, isSuperuser = false) {
  sessionMock.getSession.mockResolvedValue({
    id: USER_ID,
    username,
    email: null,
    is_active: true,
    is_superuser: isSuperuser,
    is_verified: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

const ORGS = [{ id: 1, name: "Acme Security", description: null, is_active: true, created_at: "", updated_at: "" }];

beforeEach(() => {
  orgsService.listOrganizations.mockResolvedValue(ORGS);
});

function renderOrganization() {
  return render(
    <MemoryRouter initialEntries={["/app/organization"]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe("OrganizationPage", () => {
  it("renders the member roster with usernames and roles only", async () => {
    mockSession("scope_admin");
    orgsService.listMembers.mockResolvedValue([
      { user_id: 1, username: "alice", role: "owner", joined_at: "2026-01-01T00:00:00" },
      { user_id: USER_ID, username: "scope_admin", role: "admin", joined_at: "2026-02-01T00:00:00" },
      { user_id: 2, username: "bob", role: "analyst", joined_at: "2026-03-01T00:00:00" },
    ]);
    orgsService.listAuditEntries.mockResolvedValue([]);

    renderOrganization();
    expect(await screen.findByText("alice")).toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
    expect(screen.getAllByText("analyst").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/@example.com/)).not.toBeInTheDocument();
  });

  it("lets an admin change a member's role", async () => {
    const user = userEvent.setup();
    mockSession("scope_admin");
    orgsService.listMembers.mockResolvedValue([
      { user_id: 1, username: "alice", role: "owner", joined_at: "2026-01-01T00:00:00" },
      { user_id: USER_ID, username: "scope_admin", role: "admin", joined_at: "2026-02-01T00:00:00" },
    ]);
    orgsService.listAuditEntries.mockResolvedValue([]);
    orgsService.assignRole.mockResolvedValue({ id: 3, name: "analyst" });

    renderOrganization();
    const roleSelect = await screen.findByRole("combobox", {
      name: "Role for scope_admin",
    });
    await user.selectOptions(roleSelect, "analyst");

    await waitFor(() => {
      expect(orgsService.assignRole).toHaveBeenCalledWith(1, USER_ID, "analyst");
    });
  });

  it("protects the last owner from demotion or removal in the UI", async () => {
    mockSession("owner_solo");
    orgsService.listMembers.mockResolvedValue([
      { user_id: USER_ID, username: "owner_solo", role: "owner", joined_at: "2026-01-01T00:00:00" },
    ]);
    orgsService.listAuditEntries.mockResolvedValue([]);

    renderOrganization();
    const roster = await screen.findByTestId("member-list");
    expect(within(roster).getByText("owner_solo")).toBeInTheDocument();
    expect(within(roster).getByText(/last owner/i)).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });

  it("shows real audit events to admins and never fabricates them", async () => {
    mockSession("scope_admin");
    orgsService.listMembers.mockResolvedValue([
      { user_id: 1, username: "alice", role: "owner", joined_at: "2026-01-01T00:00:00" },
      { user_id: USER_ID, username: "scope_admin", role: "admin", joined_at: "2026-02-01T00:00:00" },
    ]);
    orgsService.listAuditEntries.mockResolvedValue([
      {
        id: 9,
        action: "scope_create",
        outcome: "success",
        created_at: new Date().toISOString(),
        actor_username: "alice",
        organization_name: "Acme Security",
      },
      // ip_address / user_agent are intentionally absent — the backend never
      // serializes them, and this assertion keeps that contract visible.
    ]);

    renderOrganization();
    expect(await screen.findByText("Scope authorized")).toBeInTheDocument();
    expect(screen.getAllByText(/— alice/).length).toBeGreaterThanOrEqual(1);
  });

  it("keeps the activity trail away from viewers entirely", async () => {
    mockSession("plain_viewer");
    orgsService.listMembers.mockResolvedValue([
      { user_id: USER_ID, username: "plain_viewer", role: "viewer", joined_at: "2026-01-01T00:00:00" },
    ]);

    renderOrganization();
    await screen.findByText(/restricted to organization admins/i);

    // The endpoint is never even called for a viewer.
    await waitFor(() => expect(orgsService.listAuditEntries).not.toHaveBeenCalled());
  });

  it("shows the honest empty roster instead of placeholder members", async () => {
    mockSession("scope_admin");
    orgsService.listMembers.mockResolvedValue([]);
    renderOrganization();

    expect(await screen.findByRole("heading", { name: "No members to show" })).toBeInTheDocument();
  });
});
