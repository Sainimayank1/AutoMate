import { customWindow, type DateWindow, ReportingPeriod } from "@automate/shared";
import { useSearchParams } from "react-router";

const PERIODS = Object.values(ReportingPeriod) as string[];

/**
 * The dashboard period, kept in the URL (`?period=last_month`, custom adds `from` and `to`), so a
 * reload or a shared link shows the same figures. This month is the default. A custom range is
 * always usable: missing or bad dates fall back to this month's, a backwards range is turned
 * round and dates stay between 2000 and today, so the API is never asked for something invalid.
 */
export function useDashboardPeriod() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("period") ?? "";
  const period = (PERIODS.includes(raw) ? raw : ReportingPeriod.THIS_MONTH) as ReportingPeriod;
  const custom =
    period === ReportingPeriod.CUSTOM
      ? customWindow(params.get("from") ?? undefined, params.get("to") ?? undefined, new Date())
      : undefined;

  const write = (next: Record<string, string | undefined>) =>
    setParams(
      () => {
        const search = new URLSearchParams();
        for (const [key, value] of Object.entries(next)) if (value) search.set(key, value);
        return search;
      },
      { replace: true },
    );

  return {
    period,
    from: custom?.from,
    to: custom?.to,
    /** A new custom range starts from the window on screen (or this month). */
    setPeriod: (next: ReportingPeriod, current?: DateWindow) => {
      if (next === ReportingPeriod.THIS_MONTH) return write({});
      if (next !== ReportingPeriod.CUSTOM) return write({ period: next });
      const start = customWindow(current?.from, current?.to, new Date());
      return write({ period: next, ...start });
    },
    setRange: (range: Partial<DateWindow>) => {
      const next = customWindow(range.from ?? custom?.from, range.to ?? custom?.to, new Date());
      return write({ period: ReportingPeriod.CUSTOM, ...next });
    },
  };
}
