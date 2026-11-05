import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppRoutes } from "@/App";

// AppShell polls the backend through the health service; keep it isolated.
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

describe("WelcomePage", () => {
  it("renders product name, tagline and the honest foundation note", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "AegisGraph" })).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: "AegisGraph logo" }).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Unified Attack Surface Discovery/i)).toBeInTheDocument();
    expect(screen.getByText(/never invented/i)).toBeInTheDocument();
  });

  it("navigates into the application via the Enter Application CTA", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId("enter-application"));

    expect(await screen.findByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByText(/Backend connection/)).toBeInTheDocument();
  });

  it("shows the truthful empty state in the app Overview", async () => {
    render(
      <MemoryRouter initialEntries={["/app/overview"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByText("No assessment data yet")).toBeInTheDocument();
    expect(screen.queryByText(/1,240/)).not.toBeInTheDocument();
  });
});
