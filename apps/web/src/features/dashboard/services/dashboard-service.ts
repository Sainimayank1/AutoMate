import type { DashboardOverview, DashboardOverviewQuery } from "@automate/shared";

import { request } from "@/lib/api-client";

/** Dashboard endpoints; every figure is computed by the API (docs/architecture/dashboard.md). */
export const dashboardService = {
  overview: (params: Partial<DashboardOverviewQuery>) =>
    request<DashboardOverview>({ url: "/dashboard/overview", params }),
};
