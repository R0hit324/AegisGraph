import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "@/App";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/services/apiClient";

const getHealthMock = vi.hoisted(() => vi.fn());
vi.mock("@/services/healthService", () => ({ getHealth: getHealthMock }));

const health = {
  status: "ok" as const,
  application: "AegisGraph",
  version: "0.1.0",
  environment: "development",
  database: "connected" as const,
  timestamp: new Date().toISOString(),
};

beforeEach(() => {
  getHealthMock.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("OverviewPage", () => {
  it("shows a loading state while the backend connection is being established", async () => {
    getHealthMock.mockImplementation(() => new Promise(() => undefined)); // never resolves
    render(
      <MemoryRouter initialEntries={["/app/overview"]}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Checking backend connection/i)).toBeInTheDocument();
  });

  it("shows live backend health values when connected", async () => {
    getHealthMock.mockResolvedValue(health);
    render(
      <MemoryRouter initialEntries={["/app/overview"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Connected to backend")).toBeInTheDocument();
    expect(screen.getAllByText("v0.1.0").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("connected").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("development").length).toBeGreaterThanOrEqual(1);
  });

  it("shows the error state with a working retry action when the backend is down", async () => {
    getHealthMock.mockRejectedValue(
      new ApiError("network", "Could not reach the backend at http://localhost:8000."),
    );
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/app/overview"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Backend unreachable/);
    expect(alert).toHaveTextContent(/Could not reach the backend/);

    getHealthMock.mockResolvedValue(health);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    await screen.findByText("Connected to backend");
    expect(getHealthMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("never fabricates asset or vulnerability metrics", async () => {
    getHealthMock.mockResolvedValue(health);
    render(
      <MemoryRouter initialEntries={["/app/overview"]}>
        <AppRoutes />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByText("No assessment data yet")).toBeInTheDocument(),
    );
    const body = document.body.textContent ?? "";
    for (const fabricated of [
      "Total assets:",
      "Security score:",
      "Critical vulnerabilities:",
    ]) {
      expect(body).not.toContain(fabricated);
    }
  });
});
