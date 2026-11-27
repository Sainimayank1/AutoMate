import { Navigate, type RouteObject } from "react-router";

import { type AppModule, appModules } from "@/app/modules";
import { RequireAuth, RequireGuest, SessionGate } from "@/app/router/guards";
import type { RouteHandle } from "@/app/router/route-handle";
import { LoadingState } from "@/components/feedback/loading-state";
import { NotFoundState, RouteError } from "@/components/feedback/route-error";
import { AppShell } from "@/components/layout/app-shell";

// Widened from the `as const` registry so optional fields (children, taskRoutes) are visible.
const modules: readonly AppModule[] = appModules;

export const routes: RouteObject[] = [
  {
    element: <SessionGate />,
    // Catches errors outside the app shell (e.g. on the sign-in page).
    errorElement: <RouteError />,
    hydrateFallbackElement: <LoadingState fullScreen />,
    children: [
      {
        element: <RequireGuest />,
        children: [
          { path: "/login", lazy: () => import("@/features/auth/login-route") },
          { path: "/register", lazy: () => import("@/features/auth/register-route") },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          // Full-page task flows (wizards) render without the sidebar shell.
          ...modules.flatMap((appModule) => appModule.taskRoutes ?? []),
          {
            element: <AppShell />,
            children: [
              {
                // Page errors render inside the shell, so navigation keeps working.
                errorElement: <RouteError />,
                children: [
                  { index: true, element: <Navigate to="/dashboard" replace /> },
                  ...modules.map((appModule): RouteObject => ({
                    path: appModule.path,
                    handle: { title: appModule.title } satisfies RouteHandle,
                    children: [
                      { index: true, lazy: appModule.lazy },
                      ...(appModule.children ?? []),
                    ],
                  })),
                  {
                    path: "*",
                    element: <NotFoundState />,
                    handle: { title: "Not found" } satisfies RouteHandle,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];
