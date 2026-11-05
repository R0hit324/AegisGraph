/** Persistent application chrome: sidebar navigation + topbar + content outlet. */

import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { CircleUserRound, Menu, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Badge, StatusDot } from "@/components/ui/Primitives";
import { NAV_ITEMS } from "@/app/navigation";
import { ConnectionProvider } from "@/app/connection";
import { useBackendHealth } from "@/hooks/useBackendHealth";
import { getApiBaseUrl } from "@/services/apiClient";

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const connection = useBackendHealth();

  // Determine page title from the second path segment (/app/<segment>).
  const segment = location.pathname.split("/")[2] ?? "";
  const pageTitle = NAV_ITEMS.find((item) => item.path === segment)?.title ?? "AegisGraph";

  const statusTone =
    connection.phase === "online" && connection.health?.database === "connected"
      ? "ok"
      : connection.phase === "online"
        ? "warn"
        : connection.phase === "loading"
          ? "idle"
          : "danger";
  const statusLabel =
    connection.phase === "loading"
      ? "Connecting"
      : connection.phase === "offline"
        ? "Backend offline"
        : connection.health?.database === "connected"
          ? "All systems normal"
          : "Database unreachable";

  const navList = (
    <nav aria-label="Primary" className="flex flex-1 flex-col gap-0.5 p-3">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.path}
          to={`/app/${item.path}`}
          end={false}
          onClick={() => setSidebarOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-2.5 rounded-quiet px-3 py-2 text-[13px] font-medium transition-colors ${
              isActive
                ? "bg-accent/10 text-accent"
                : "text-muted hover:bg-surface-3/60 hover:text-text"
            }`
          }
        >
          <item.icon size={16} strokeWidth={1.8} aria-hidden />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-bg text-text">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <BrandRow />
        {navList}
        <PlatformStatus connectionPhase={connection.phase} health={connection.health} />
      </aside>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-bg/80 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border bg-surface">
            <BrandRow />
            {navList}
            <PlatformStatus connectionPhase={connection.phase} health={connection.health} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="rounded-quiet border border-border p-1.5 text-muted hover:text-text md:hidden"
              onClick={() => setSidebarOpen((open) => !open)}
              aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
            <Badge tone="neutral">{pageTitle}</Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 rounded-quiet border border-border bg-surface-2 px-2.5 py-1 text-[11px] text-muted sm:flex">
              <StatusDot tone={statusTone} />
              {statusLabel}
            </span>
            <span className="hidden text-[11px] text-faint sm:inline">v{__APP_VERSION__}</span>
            <span
              title="User profiles arrive with a future authentication phase"
              className="text-muted"
            >
              <CircleUserRound size={20} aria-hidden />
              <span className="sr-only">Profile placeholder</span>
            </span>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">
          <ConnectionProvider value={connection}>
            <Outlet />
          </ConnectionProvider>
        </main>
      </div>
    </div>
  );
}

function BrandRow() {
  return (
    <div className="flex items-center gap-2.5 px-5 py-4">
      <Logo size={26} className="text-accent" />
      <div className="leading-tight">
        <div className="text-[15px] font-semibold tracking-tight text-text">AegisGraph</div>
        <div className="text-[10px] uppercase tracking-widest text-faint">
          Security Platform
        </div>
      </div>
    </div>
  );
}

function PlatformStatus({
  connectionPhase,
  health,
}: {
  connectionPhase: "loading" | "online" | "offline";
  health: ReturnType<typeof useBackendHealth>["health"];
}) {
  return (
    <div className="mt-auto border-t border-border p-3 text-[11px] text-faint">
      <div className="flex items-center justify-between px-1">
        <span>API base</span>
        <span className="max-w-32 truncate text-muted" title={getApiBaseUrl()}>
          {getApiBaseUrl().replace(/^https?:\/\//, "")}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between px-1">
        <span>Connection</span>
        <span className="text-muted">
          {connectionPhase === "online"
            ? `v${health?.version ?? "?"}`
            : connectionPhase === "loading"
              ? "checking…"
              : "offline"}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between px-1">
        <span>Release</span>
        <span className="text-muted">Phase 1 foundation</span>
      </div>
    </div>
  );
}
