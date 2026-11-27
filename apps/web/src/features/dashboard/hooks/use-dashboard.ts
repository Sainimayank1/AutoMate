import type { DashboardOverviewQuery } from "@automate/shared";
import { useQuery } from "@tanstack/react-query";

import { dashboardService } from "@/features/dashboard/services/dashboard-service";

export const dashboardKeys = {
  /** Every dashboard query: fuel, expense and vehicle writes invalidate it. */
  all: ["dashboard"] as const,
  overview: (params: Partial<DashboardOverviewQuery>) => ["dashboard", "overview", params] as const,
};

/**
 * The overview for one vehicle and period. A period change keeps the last figures on screen until
 * the new ones arrive; a vehicle change doesn't (another car's figures would be wrong).
 */
export function useDashboardOverview(
  params: Partial<DashboardOverviewQuery>,
  { enabled = true } = {},
) {
  return useQuery({
    queryKey: dashboardKeys.overview(params),
    queryFn: () => dashboardService.overview(params),
    enabled,
    staleTime: 60 * 1000,
    placeholderData: (previous) =>
      previous?.vehicle.id === params.vehicleId ? previous : undefined,
  });
}
