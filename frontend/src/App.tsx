/**
 * Route table.
 * `AppRoutes` is exported separately from the `App` root so tests can mount
 * the same tree inside a MemoryRouter.
 */

import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/layouts/AppShell";
import { WelcomePage } from "@/pages/WelcomePage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { OverviewPage } from "@/pages/app/OverviewPage";
import { ModulePlaceholderPage } from "@/pages/app/ModulePlaceholderPage";
import { SettingsPage } from "@/pages/app/SettingsPage";
import { NAV_ITEMS } from "@/app/navigation";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<WelcomePage />} />

      <Route path="/app" element={<AppShell />}>
        <Route index element={<Navigate to="/app/overview" replace />} />
        <Route path="overview" element={<OverviewPage />} />
        <Route path="settings" element={<SettingsPage />} />
        {/* Future-phase modules: honest placeholder UI, no fake functionality. */}
        {NAV_ITEMS.filter((item) => item.path !== "overview" && item.path !== "settings").map(
          (item) => (
            <Route
              key={item.path}
              path={item.path}
              element={<ModulePlaceholderPage definition={item} />}
            />
          ),
        )}
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
