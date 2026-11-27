import { ErrorBoundary } from "react-error-boundary";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";

import { AppProviders } from "@/app/providers/app-providers";
import { routes } from "@/app/router/routes";
import { AppErrorFallback } from "@/components/feedback/app-error-fallback";

const router = createBrowserRouter(routes);

export function App() {
  return (
    <ErrorBoundary FallbackComponent={AppErrorFallback}>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </ErrorBoundary>
  );
}
