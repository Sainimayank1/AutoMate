import { render } from "@testing-library/react";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";

import { AppProviders } from "@/app/providers/app-providers";
import { routes } from "@/app/router/routes";

/** Renders the real app (providers + full route tree) at `path`. Returns the router to inspect or navigate. */
export function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}
