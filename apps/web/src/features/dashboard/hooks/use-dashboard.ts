import type { DashboardActivityQuery, DashboardOverviewQuery } from "@automate/shared";
import { useQuery } from "@tanstack/react-query";

import { dashboardService } from "@/features/dashboard/services/dashboard-service";

export const dashboardKeys = {
  /** Every dashboard query: fuel, expense and vehicle writes invalidate it. */
  all: ["dashboard"] as const,
  overview: (params: Partial<DashboardOverviewQuery>) => ["dashboard", "overview", params] as const,
  activity: (params: DashboardActivityQuery) => ["dashboard", "activity", params] as const,
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

/** One page of the activity feed; the next page keeps this one on screen until it arrives. */
export function useDashboardActivity(params: DashboardActivityQuery) {
  return useQuery({
    queryKey: dashboardKeys.activity(params),
    queryFn: () => dashboardService.activity(params),
    staleTime: 60 * 1000,
    placeholderData: (previous) => previous,
  });
}
