import { useMatches } from "react-router";

import type { RouteHandle } from "@/app/router/route-handle";

/** Crumbs for the current route, from each matched route's `handle.title`. */
export function useBreadcrumbs() {
  return useMatches()
    .filter((match) => typeof (match.handle as RouteHandle | undefined)?.title === "string")
    .map((match) => ({ path: match.pathname, title: (match.handle as RouteHandle).title }));
}
