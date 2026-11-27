import type {
  TripCostListParams,
  TripCostSummaryParams,
  TripFilterParams,
  TripListParams,
  TripOverviewParams,
} from "@/features/trips/services/trips-service";

/** Query keys of the trips module; other modules import these to refresh it. */
export const tripsKeys = {
  all: ["trips"] as const,
  overview: (params: TripOverviewParams) => ["trips", "overview", params] as const,
  lists: ["trips", "list"] as const,
  list: (params: TripListParams) => ["trips", "list", params] as const,
  summary: (params: TripFilterParams) => ["trips", "summary", params] as const,
  detail: (id: string) => ["trips", "detail", id] as const,
  categories: ["trips", "categories"] as const,
  /** One trip's money: costs, linked fill-ups, candidates and spending. */
  money: (tripId: string) => ["trips", "money", tripId] as const,
  costs: (tripId: string) => ["trips", "money", tripId, "costs"] as const,
  spending: (tripId: string) => ["trips", "money", tripId, "spending"] as const,
  fuel: (tripId: string) => ["trips", "money", tripId, "fuel"] as const,
  candidates: (tripId: string) => ["trips", "money", tripId, "candidates"] as const,
  cost: (id: string) => ["trips", "cost", id] as const,
  allCosts: (params: TripCostListParams) => ["trips", "all-costs", params] as const,
  costsSummary: (params: TripCostSummaryParams) => ["trips", "costs-summary", params] as const,
};
