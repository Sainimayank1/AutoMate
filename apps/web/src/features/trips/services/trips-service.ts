import type {
  CreateTripValues,
  PaginationQuery,
  Trip,
  TripCategory,
  TripCategoryValues,
  TripListQuery,
  TripOverview,
  TripOverviewQuery,
  UpdateTripValues,
} from "@automate/shared";

import { request, requestAllPages, requestPage } from "@/lib/api-client";

export type TripListParams = Partial<TripListQuery>;
export type TripOverviewParams = Partial<TripOverviewQuery>;
export type CategoryListParams = Partial<PaginationQuery>;

const CATEGORIES = "/trip-categories";

/** Trips endpoints; every call is scoped to the signed-in user. */
export const tripsService = {
  overview: (params: TripOverviewParams) =>
    request<TripOverview>({ url: "/trips/overview", params }),
  list: (params: TripListParams = {}) => requestPage<Trip>({ url: "/trips", params }),
  get: (id: string) => request<Trip>({ url: `/trips/${id}` }),
  create: (values: CreateTripValues) =>
    request<Trip>({ method: "POST", url: "/trips", data: values }),
  update: (id: string, values: UpdateTripValues) =>
    request<Trip>({ method: "PATCH", url: `/trips/${id}`, data: values }),
  remove: (id: string) => request<void>({ method: "DELETE", url: `/trips/${id}` }),
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
