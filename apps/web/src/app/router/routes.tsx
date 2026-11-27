import { Navigate, type RouteObject } from "react-router";

import { appModules } from "@/app/modules";
import { RequireAuth } from "@/app/router/require-auth";
import type { RouteHandle } from "@/app/router/route-handle";
import { LoadingState } from "@/components/feedback/loading-state";
import { NotFoundState, RouteError } from "@/components/feedback/route-error";
import { AppShell } from "@/components/layout/app-shell";

export const routes: RouteObject[] = [
  {
    // Catches errors outside the app shell (e.g. on the login page).
    errorElement: <RouteError />,
    hydrateFallbackElement: <LoadingState fullScreen />,
    children: [
      { path: "/login", lazy: () => import("@/features/auth/route") },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppShell />,
            children: [
              {
                // Page errors render inside the shell, so navigation keeps working.
                errorElement: <RouteError />,
                children: [
                  { index: true, element: <Navigate to="/dashboard" replace /> },
                  ...appModules.map((appModule): RouteObject => ({
                    path: appModule.path,
                    lazy: appModule.lazy,
                    handle: { title: appModule.title } satisfies RouteHandle,
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
