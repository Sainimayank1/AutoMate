import type {
  ActivityItem,
  DashboardActivityQuery,
  DashboardLayout,
  DashboardOverview,
  DashboardOverviewQuery,
} from "@automate/shared";

import { request, requestPage } from "@/lib/api-client";

/** Dashboard endpoints; every figure is computed by the API (docs/architecture/dashboard.md). */
export const dashboardService = {
  overview: (params: Partial<DashboardOverviewQuery>) =>
    request<DashboardOverview>({ url: "/dashboard/overview", params }),
  /** What happened to the vehicle, newest first, a page at a time. */
  activity: (params: DashboardActivityQuery) =>
    requestPage<ActivityItem>({ url: "/dashboard/activity", params }),
  /** The signed-in user's layout (the default until they save one). */
  layout: () => request<DashboardLayout>({ url: "/dashboard/layout" }),
  saveLayout: (layout: DashboardLayout) =>
    request<DashboardLayout>({ url: "/dashboard/layout", method: "PUT", data: layout }),
};
