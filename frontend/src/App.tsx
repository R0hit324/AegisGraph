/**
 * Route table.
 * `AppRoutes` is exported separately from the `App` root so tests can mount
 * the same tree inside a MemoryRouter.
 *
 * Phase 2: `/app/*` is protected — every visit re-checks the session against
 * the backend (HttpOnly cookie); anonymous visitors are sent to /login.
 */

import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { AppShell } from "@/layouts/AppShell";
import { WelcomePage } from "@/pages/WelcomePage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { OverviewPage } from "@/pages/app/OverviewPage";
import { ScopesPage } from "@/pages/app/ScopesPage";
import { OrganizationPage } from "@/pages/app/OrganizationPage";
import { DiscoveryDashboard } from "@/pages/app/DiscoveryDashboard";
import { DiscoveryConfig } from "@/pages/app/DiscoveryConfig";
import { DiscoveryJobsPage } from "@/pages/app/DiscoveryJobs";
import { AssetInventoryPage } from "@/pages/app/AssetInventory";
import { AssetDetailsPage } from "@/pages/app/AssetDetails";
import { ModulePlaceholderPage } from "@/pages/app/ModulePlaceholderPage";
import { SettingsPage } from "@/pages/app/SettingsPage";
import { NAV_ITEMS } from "@/app/navigation";
import { SessionProvider } from "@/app/session";
import { useSession } from "@/app/useSession";
import { Spinner } from "@/components/ui/Primitives";

/** Renders children only for signed-in visitors; others go to /login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const session = useSession();
  const location = useLocation();

  if (session.status === "checking") {
    return (
      <div
        role="status"
        aria-label="Checking your session"
        className="flex min-h-screen items-center justify-center bg-bg text-text"
      >
        <span className="flex items-center gap-2.5 text-[13px] text-muted">
          <Spinner label="Checking session" />
          Checking your session…
        </span>
      </div>
    );
  }

  if (session.status === "anonymous") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

/** Keeps signed-in users away from the auth screens. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const session = useSession();
  if (session.status === "authenticated") {
    return <Navigate to="/app/overview" replace />;
  }
  return <>{children}</>;
}

export function AppRoutes() {
  return (
    <SessionProvider>
      <Routes>
        <Route path="/" element={<WelcomePage />} />

        <Route
          path="/login"
          element={
            <GuestOnly>
              <LoginPage />
            </GuestOnly>
          }
        />
        <Route
          path="/register"
          element={
            <GuestOnly>
              <RegisterPage />
            </GuestOnly>
          }
        />

        <Route
          path="/app"
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/app/overview" replace />} />
          <Route path="overview" element={<OverviewPage />} />
          <Route path="scopes" element={<ScopesPage />} />
          <Route path="organization" element={<OrganizationPage />} />
          <Route path="discovery/config" element={<DiscoveryConfig />} />
          <Route path="discovery/jobs" element={<DiscoveryJobsPage />} />
          <Route path="discovery/assets" element={<AssetInventoryPage />} />
          <Route path="discovery/asset-details/:assetId" element={<AssetDetailsPage />} />
          <Route path="dashboard" element={<DiscoveryDashboard />} />
          <Route path="settings" element={<SettingsPage />} />
          {/* Future-phase modules: honest placeholder UI, no fake functionality. */}
          {NAV_ITEMS.filter(
            (item) =>
              item.path !== "overview" &&
              item.path !== "settings" &&
              item.path !== "scopes" &&
              item.path !== "organization" &&
              item.path !== "discovery",
          ).map((item) => (
            <Route
              key={item.path}
              path={item.path}
              element={<ModulePlaceholderPage definition={item} />}
            />
          ))}
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </SessionProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
