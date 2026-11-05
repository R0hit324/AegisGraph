import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppRoutes } from "@/App";
import { NAV_ITEMS } from "@/app/navigation";

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

describe("AppShell", () => {
  it("renders every navigation item in the sidebar", async () => {
    render(
      <MemoryRouter initialEntries={["/app/overview"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    const nav = await screen.findByRole("navigation", { name: "Primary" });
    for (const item of NAV_ITEMS) {
      const link = within(nav).getByRole("link", { name: new RegExp(item.label, "i") });
      expect(link).toHaveAttribute("href", `/app/${item.path}`);
    }
  });

  it("renders the version indicator and connections status area in the topbar", async () => {
    render(
      <MemoryRouter initialEntries={["/app/overview"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/All systems normal/)).toBeInTheDocument();
    expect(screen.getAllByText("v0.1.0").length).toBeGreaterThanOrEqual(1);
  });

  it("shows an operational module honestly on placeholder pages", async () => {
    render(
      <MemoryRouter initialEntries={["/app/assets"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Assets" })).toBeInTheDocument();
    expect(screen.getByText("not yet operational")).toBeInTheDocument();
  });

  it("routes unknown paths to the not-found page", async () => {
    render(
      <MemoryRouter initialEntries={["/nowhere"]}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });
});
