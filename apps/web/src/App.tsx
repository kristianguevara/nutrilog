import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { PullToRefresh } from "@/components/PullToRefresh.js";
import { AppShell } from "@/layouts/AppShell.js";
import { AppStateProvider, useAppState } from "@/providers/AppStateProvider.js";
import { FoodFormPage } from "@/pages/FoodFormPage.js";
import { OnboardingPage } from "@/pages/OnboardingPage.js";
import { ReportPage } from "@/pages/ReportPage.js";
import { ScanPage } from "@/pages/ScanPage.js";
import { SettingsPage } from "@/pages/SettingsPage.js";
import { SplashPage } from "@/pages/SplashPage.js";
import { TodayPage } from "@/pages/TodayPage.js";

function RequireProfile({ children }: { children: ReactNode }) {
  const { profile } = useAppState();
  if (!profile) return <Navigate to="/onboarding" replace />;
  return children;
}

function OnboardingRoute() {
  const { profile } = useAppState();
  if (profile) return <Navigate to="/" replace />;
  return <OnboardingPage />;
}

function ProtectedLayout() {
  return (
    <RequireProfile>
      <AppShell />
    </RequireProfile>
  );
}

function AppRoutes() {
  const { ready } = useAppState();
  if (!ready) return <SplashPage />;
  return (
    <Routes>
      <Route path="/onboarding" element={<OnboardingRoute />} />
      <Route path="/" element={<ProtectedLayout />}>
        <Route index element={<TodayPage />} />
        <Route path="reports" element={<ReportPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="/report" element={<Navigate to="/reports" replace />} />
      <Route
        path="/food/new"
        element={
          <RequireProfile>
            <FoodFormPage mode="create" />
          </RequireProfile>
        }
      />
      <Route
        path="/food/:id/edit"
        element={
          <RequireProfile>
            <FoodFormPage mode="edit" />
          </RequireProfile>
        }
      />
      <Route
        path="/scan"
        element={
          <RequireProfile>
            <ScanPage />
          </RequireProfile>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <AppStateProvider>
        <PullToRefresh>
          <AppRoutes />
        </PullToRefresh>
      </AppStateProvider>
    </div>
  );
}
