import type {
  CreateTripCostValues,
  CreateTripValues,
  PaginationQuery,
  Trip,
  TripBulkValues,
  TripCategory,
  TripCategoryValues,
  TripCost,
  TripCostListQuery,
  TripCostsSummary,
  TripCostSummaryQuery,
  TripFilters,
  TripFuelEntry,
  TripListQuery,
  TripOverview,
  TripOverviewQuery,
  TripSpending,
  TripSummary,
  UpdateTripCostValues,
  UpdateTripValues,
} from "@automate/shared";

import { request, requestAllPages, requestPage } from "@/lib/api-client";

export type TripListParams = Partial<TripListQuery>;
export type TripCostListParams = Partial<TripCostListQuery>;
export type TripCostSummaryParams = Partial<TripCostSummaryQuery>;
export type TripFilterParams = Partial<TripFilters>;
export type TripOverviewParams = Partial<TripOverviewQuery>;
export type CategoryListParams = Partial<PaginationQuery>;

const CATEGORIES = "/trip-categories";

/** Trips endpoints; every call is scoped to the signed-in user. */
export const tripsService = {
  overview: (params: TripOverviewParams) =>
    request<TripOverview>({ url: "/trips/overview", params }),
  list: (params: TripListParams = {}) => requestPage<Trip>({ url: "/trips", params }),
  /** The filtered history's count and distance (every page). */
  summary: (params: TripFilterParams = {}) =>
    request<TripSummary>({ url: "/trips/summary", params }),
  bulk: (values: TripBulkValues) =>
    request<{ count: number }>({ method: "POST", url: "/trips/bulk", data: values }),
  get: (id: string) => request<Trip>({ url: `/trips/${id}` }),
  create: (values: CreateTripValues) =>
    request<Trip>({ method: "POST", url: "/trips", data: values }),
  update: (id: string, values: UpdateTripValues) =>
    request<Trip>({ method: "PATCH", url: `/trips/${id}`, data: values }),
  remove: (id: string) => request<void>({ method: "DELETE", url: `/trips/${id}` }),
  /** A trip's costs (a handful; read whole). */
  costs: (tripId: string) => requestAllPages<TripCost>({ url: `/trips/${tripId}/costs` }),
  cost: (id: string) => request<TripCost>({ url: `/trip-costs/${id}` }),
  createCost: (tripId: string, values: CreateTripCostValues) =>
    request<TripCost>({ method: "POST", url: `/trips/${tripId}/costs`, data: values }),
  updateCost: (tripId: string, id: string, values: UpdateTripCostValues) =>
    request<TripCost>({ method: "PATCH", url: `/trips/${tripId}/costs/${id}`, data: values }),
  removeCost: (tripId: string, id: string) =>
    request<void>({ method: "DELETE", url: `/trips/${tripId}/costs/${id}` }),
  spending: (tripId: string) => request<TripSpending>({ url: `/trips/${tripId}/spending` }),
  fuelEntries: (tripId: string) =>
    requestAllPages<TripFuelEntry>({ url: `/trips/${tripId}/fuel-entries` }),
  fuelCandidates: (tripId: string) =>
    requestAllPages<TripFuelEntry>({ url: `/trips/${tripId}/fuel-candidates` }),
  linkFuel: (tripId: string, fuelEntryId: string) =>
    request<void>({ method: "POST", url: `/trips/${tripId}/fuel-entries`, data: { fuelEntryId } }),
  unlinkFuel: (tripId: string, fuelEntryId: string) =>
    request<void>({ method: "DELETE", url: `/trips/${tripId}/fuel-entries/${fuelEntryId}` }),
  /** Costs across trips (the Costs tab), a page at a time. */
  allCosts: (params: TripCostListParams = {}) =>
    requestPage<TripCost>({ url: "/trip-costs", params }),
  costsSummary: (params: TripCostSummaryParams = {}) =>
    request<TripCostsSummary>({ url: "/trip-costs/summary", params }),
  /** The system types and the user's own (a handful; read whole). */
  categories: () => requestAllPages<TripCategory>({ url: CATEGORIES }),
  createCategory: (values: TripCategoryValues) =>
    request<TripCategory>({ method: "POST", url: CATEGORIES, data: values }),
  renameCategory: (id: string, values: TripCategoryValues) =>
    request<TripCategory>({ method: "PATCH", url: `${CATEGORIES}/${id}`, data: values }),
  setCategoryArchived: (id: string, archived: boolean) =>
    request<TripCategory>({
      method: "POST",
      url: `${CATEGORIES}/${id}/${archived ? "archive" : "restore"}`,
    }),
};
