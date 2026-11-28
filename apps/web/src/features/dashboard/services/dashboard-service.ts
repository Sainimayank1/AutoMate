import type {
  ActivityItem,
  DashboardActivityQuery,
  DashboardLayout,
  DashboardOverview,
  DashboardOverviewQuery,
  DismissDashboardItemValues,
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
  /** Hide an information-only action-centre item for a vehicle. */
  dismiss: (values: DismissDashboardItemValues) =>
    request<void>({ method: "POST", url: "/dashboard/dismissals", data: values }),
  saveLayout: (layout: DashboardLayout) =>
    request<DashboardLayout>({ url: "/dashboard/layout", method: "PUT", data: layout }),
};
