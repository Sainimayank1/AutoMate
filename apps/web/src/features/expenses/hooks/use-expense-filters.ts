import { type ExpenseSort, type ExpenseSource, type PaymentMethod } from "@automate/shared";
import { useSearchParams } from "react-router";

import type { ExpenseListParams } from "@/features/expenses/services/expense-service";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";

/** URL keys of the transactions filters (shareable, and kept across reloads and tabs). */
export const FILTER_KEYS = [
  "vehicle",
  "from",
  "to",
  "category",
  "payment",
  "source",
  "min",
  "max",
  "q",
  "sort",
] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

/** "All vehicles" in the `vehicle` param; absent means the active vehicle. */
export const ALL_VEHICLES = "all";

/**
 * Transactions filters, kept in the URL. The vehicle scope defaults to the active vehicle;
 * any change goes back to page 1.
 */
export function useExpenseFilters() {
  const [params, setParams] = useSearchParams();
  const { activeVehicle, isPending } = useActiveVehicle();
  const get = (key: FilterKey | "page") => params.get(key) ?? undefined;

  const vehicle = get("vehicle") ?? activeVehicle?.id ?? ALL_VEHICLES;
  const page = Math.max(1, Number(get("page")) || 1);
  const query: ExpenseListParams = {
    page,
    vehicleId: vehicle === ALL_VEHICLES ? undefined : vehicle,
    from: get("from"),
    to: get("to"),
    categoryId: get("category"),
    paymentMethod: get("payment") as PaymentMethod | undefined,
    source: get("source") as ExpenseSource | undefined,
    minAmount: get("min"),
    maxAmount: get("max"),
    search: get("q"),
    sort: get("sort") as ExpenseSort | undefined,
  };
  /** Filters besides the vehicle scope (they decide "no expenses yet" vs "no match"). */
  const narrowed = FILTER_KEYS.some(
    (key) => key !== "vehicle" && key !== "sort" && params.has(key),
  );

  const update = (changes: Partial<Record<FilterKey | "page", string | undefined>>) =>
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
    vehicle,
    page,
    query,
    narrowed,
    /** Wait for the garage before asking: the default scope is the active vehicle. */
    ready: !isPending,
    get,
    set: (key: FilterKey, value: string | undefined) => update({ [key]: value }),
    setPage: (next: number) => update({ page: next > 1 ? String(next) : undefined }),
    clear: () =>
      update(
        Object.fromEntries(
          FILTER_KEYS.filter((key) => key !== "vehicle").map((key) => [key, undefined]),
        ),
      ),
  };
}
