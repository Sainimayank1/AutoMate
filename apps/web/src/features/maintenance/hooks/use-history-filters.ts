import {
  MAINTENANCE_GROUP_KEYS,
  type MaintenanceGroupKey,
  ServiceRecordType,
  toPaise,
} from "@automate/shared";
import { useSearchParams } from "react-router";

import type { RecordFilterParams } from "@/features/maintenance/services/maintenance-service";

/** URL keys of the history filters (shareable, kept across reloads). */
export const HISTORY_FILTER_KEYS = [
  "q",
  "from",
  "to",
  "group",
  "type",
  "workshop",
  "min",
  "max",
  "minKm",
  "maxKm",
] as const;
export type HistoryFilterKey = (typeof HISTORY_FILTER_KEYS)[number];
export type HistoryView = "timeline" | "list";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const AMOUNT = /^\d+(\.\d{1,2})?$/;
const KM = /^\d+$/;
const oneOf = <T extends string>(values: readonly T[], value: string | null) =>
  values.includes(value as T) ? (value as T) : undefined;

/** A range typed back to front is read the way it was meant. */
function ordered<T>(low: T | undefined, high: T | undefined, inverted: (a: T, b: T) => boolean) {
  return low !== undefined && high !== undefined && inverted(low, high) ? [high, low] : [low, high];
}

/**
 * Service history filters, view and page, kept in the URL; malformed values are ignored rather
 * than sent. Any filter change goes back to page 1.
 */
export function useHistoryFilters() {
  const [params, setParams] = useSearchParams();
  const get = (key: string) => params.get(key) ?? undefined;
  const valid = (key: HistoryFilterKey, pattern: RegExp) => {
    const value = get(key);
    return value && pattern.test(value) ? value : undefined;
  };

  const [from, to] = ordered(valid("from", DATE), valid("to", DATE), (a, b) => a > b);
  const [minAmount, maxAmount] = ordered(
    valid("min", AMOUNT),
    valid("max", AMOUNT),
    (a, b) => toPaise(a) > toPaise(b),
  );
  const km = (key: HistoryFilterKey) => {
    const value = valid(key, KM);
    return value === undefined ? undefined : Number(value);
  };
  const [minKm, maxKm] = ordered(km("minKm"), km("maxKm"), (a, b) => a > b);
  const filters: RecordFilterParams = {
    search: get("q")?.trim() || undefined,
    from,
    to,
    group: oneOf<MaintenanceGroupKey>(MAINTENANCE_GROUP_KEYS, params.get("group")),
    type: oneOf(Object.values(ServiceRecordType), params.get("type")),
    providerId: get("workshop"),
    minAmount,
    maxAmount,
    minKm,
    maxKm,
  };
  const page = Math.max(1, Number(get("page")) || 1);
  const view: HistoryView = get("view") === "list" ? "list" : "timeline";
  const active = HISTORY_FILTER_KEYS.filter((key) => key !== "q" && params.get(key));

  const set = (changes: Partial<Record<HistoryFilterKey | "page" | "view", string | null>>) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        if (!("page" in changes) && !("view" in changes)) next.delete("page");
        return next;
      },
      { replace: true },
    );
  const clear = () =>
    set(
      Object.fromEntries(HISTORY_FILTER_KEYS.map((key) => [key, null])) as Record<
        HistoryFilterKey,
        null
      >,
    );

  return { params, filters, page, view, active, set, clear };
}
