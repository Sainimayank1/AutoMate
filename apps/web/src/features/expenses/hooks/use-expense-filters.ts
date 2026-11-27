import {
  type ExpenseSort,
  type ExpenseSource,
  type PaymentMethod,
  toPaise,
} from "@automate/shared";
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

const AMOUNT = /^\d+(\.\d{1,2})?$/;

/** A range typed back to front ("from" after "to") is read the way it was meant. */
function ordered(
  low: string | undefined,
  high: string | undefined,
  inverted: (low: string, high: string) => boolean,
) {
  return low && high && inverted(low, high) ? [high, low] : [low, high];
}

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
  const [from, to] = ordered(get("from"), get("to"), (a, b) => a > b);
  const [minAmount, maxAmount] = ordered(get("min"), get("max"), (a, b) =>
    AMOUNT.test(a) && AMOUNT.test(b) ? toPaise(a) > toPaise(b) : false,
  );
  const query: ExpenseListParams = {
    page,
    vehicleId: vehicle === ALL_VEHICLES ? undefined : vehicle,
    from,
    to,
    categoryId: get("category"),
    paymentMethod: get("payment") as PaymentMethod | undefined,
    source: get("source") as ExpenseSource | undefined,
    minAmount,
    maxAmount,
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
