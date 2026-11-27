import { TripMethod, TripSort } from "@automate/shared";
import { useSearchParams } from "react-router";

import type { TripFilterParams } from "@/features/trips/services/trips-service";

/** The popover's filters (search, vehicle and type sit in the toolbar). */
export const TRIP_FILTER_KEYS = [
  "from",
  "to",
  "minKm",
  "maxKm",
  "method",
  "origin",
  "destination",
] as const;
type Key = (typeof TRIP_FILTER_KEYS)[number] | "q" | "vehicle" | "type" | "sort" | "view" | "page";
export type TripHistoryView = "timeline" | "list";
export const ALL_VEHICLES = "all";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KM = /^\d+(\.\d)?$/;

/**
 * Trip history filters, sort, view and page, kept in the URL; malformed values are ignored rather
 * than sent. The vehicle defaults to the active one ("all" for every vehicle). Any change but the
 * page goes back to page 1.
 */
export function useTripHistory(activeVehicleId: string | undefined) {
  const [params, setParams] = useSearchParams();
  const get = (key: Key) => params.get(key)?.trim() || undefined;
  const valid = (key: Key, pattern: RegExp) => {
    const value = get(key);
    return value && pattern.test(value) ? value : undefined;
  };
  const vehicle = get("vehicle");
  const sort = Object.values(TripSort).find((value) => value === get("sort")) ?? TripSort.NEWEST;
  const filters: TripFilterParams = {
    vehicleId: vehicle === ALL_VEHICLES ? undefined : (vehicle ?? activeVehicleId),
    search: get("q"),
    categoryId: get("type"),
    from: valid("from", DATE),
    to: valid("to", DATE),
    minKm: valid("minKm", KM),
    maxKm: valid("maxKm", KM),
    method: Object.values(TripMethod).find((value) => value === get("method")),
    origin: get("origin"),
    destination: get("destination"),
  };
  const active = TRIP_FILTER_KEYS.filter((key) => get(key));

  const set = (changes: Partial<Record<Key, string | null>>) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        if (!("page" in changes)) next.delete("page");
        return next;
      },
      { replace: true },
    );

  return {
    filters,
    sort,
    view: (get("view") === "list" ? "list" : "timeline") as TripHistoryView,
    page: Math.max(1, Number(get("page")) || 1),
    search: params.get("q") ?? "",
    vehicle: vehicle ?? activeVehicleId ?? ALL_VEHICLES,
    raw: (key: (typeof TRIP_FILTER_KEYS)[number]) => get(key) ?? "",
    active,
    set,
    clear: () =>
      set(Object.fromEntries([...TRIP_FILTER_KEYS, "q", "type"].map((key) => [key, null]))),
  };
}
