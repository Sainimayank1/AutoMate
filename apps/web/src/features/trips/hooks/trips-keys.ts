import type { TripListParams, TripOverviewParams } from "@/features/trips/services/trips-service";

/** Query keys of the trips module; other modules import these to refresh it. */
export const tripsKeys = {
  all: ["trips"] as const,
  overview: (params: TripOverviewParams) => ["trips", "overview", params] as const,
  lists: ["trips", "list"] as const,
  list: (params: TripListParams) => ["trips", "list", params] as const,
  detail: (id: string) => ["trips", "detail", id] as const,
  categories: ["trips", "categories"] as const,
};
