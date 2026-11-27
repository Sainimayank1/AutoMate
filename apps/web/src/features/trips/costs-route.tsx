import { ReportingPeriod, TripCostCategory } from "@automate/shared";
import { IndianRupee } from "lucide-react";
import { Link, useSearchParams } from "react-router";

import { Pager } from "@/components/common/pager";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PERIOD_LABELS } from "@/features/dashboard/constants";
import { vehicleName } from "@/features/garage/constants";
import { useVehicles } from "@/features/garage/hooks/use-vehicles";
import { TripsLayout } from "@/features/trips/components/trips-layout";
import {
  COST_COLORS,
  COST_LABELS,
  isVehicleCost,
  TRIP_PERIODS,
  type TripPeriod,
} from "@/features/trips/constants";
import { useAllTripCosts, useTripCostsSummary } from "@/features/trips/hooks/use-trips";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";
import { formatCurrency, formatDate } from "@/utils/format";

const ALL = "all";
// A custom range lives on the overview; the Costs tab keeps to the named periods.
const PERIODS = TRIP_PERIODS.filter((period) => period !== ReportingPeriod.CUSTOM);

/**
 * The Costs tab (built from the trips screens' design; its own Stitch screen comes when credits
 * allow): actual trip costs in a period by their date, linked fuel included, by category, with
 * per km over the trips that have a cost, and every cost opening its trip.
 */
export function Component() {
  const garage = useActiveVehicle();
  const vehicles = useVehicles().data ?? [];
  const [params, setParams] = useSearchParams();
  const vehicleParam = params.get("vehicle");
  const vehicleId =
    vehicleParam === ALL ? undefined : (vehicleParam ?? garage.activeVehicle?.id ?? undefined);
  const raw = params.get("period") ?? "";
  const period = (PERIODS as readonly string[]).includes(raw)
    ? (raw as TripPeriod)
    : ReportingPeriod.THIS_MONTH;
  const rawCategory = params.get("category");
  const category = Object.values(TripCostCategory).find((value) => value === rawCategory);
  const page = Math.max(1, Number(params.get("page")) || 1);
  const scope = { period, ...(vehicleId && { vehicleId }) };
  const summary = useTripCostsSummary(scope);
  const list = useAllTripCosts({ ...scope, page, ...(category && { category }) });

  const update = (changes: Record<string, string | null>) =>
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

  const items = list.data?.items;
  const total = Number(summary.data?.total ?? 0);
  return (
    <TripsLayout tab="costs">
      <section className="flex flex-wrap items-center gap-2" aria-label="Filters">
        <Select value={vehicleId ?? ALL} onValueChange={(value) => update({ vehicle: value })}>
          <SelectTrigger aria-label="Vehicle" className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {vehicles.map((vehicle) => (
              <SelectItem key={vehicle.id} value={vehicle.id}>
                {vehicleName(vehicle)}
              </SelectItem>
            ))}
            <SelectItem value={ALL}>All vehicles</SelectItem>
          </SelectContent>
        </Select>
        <Select value={period} onValueChange={(value) => update({ period: value })}>
          <SelectTrigger aria-label="Period" className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((value) => (
              <SelectItem key={value} value={value}>
                {PERIOD_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      {summary.isError && !summary.data ? (
        <ErrorState
          title="Couldn't load trip costs"
          error={summary.error}
          onRetry={() => void summary.refetch()}
        />
      ) : !summary.data ? (
        <Skeleton className="h-40 rounded-xl" aria-label="Loading trip costs" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Trip costs</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <p className="font-heading text-2xl font-semibold tabular-nums">
                {formatCurrency(summary.data.total)}
              </p>
              <p className="text-sm text-muted-foreground">
                Actual costs and linked fill-ups
                {summary.data.perKm && ` · ${formatCurrency(summary.data.perKm)} per km`}
              </p>
            </div>
            {summary.data.byCategory.length > 0 && (
              <>
                <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  {summary.data.byCategory.map((row) => (
                    <span
                      key={row.category}
                      className="h-full"
                      style={{
                        width: `${total > 0 ? (Number(row.amount) / total) * 100 : 0}%`,
                        backgroundColor: COST_COLORS[row.category],
                      }}
                    />
                  ))}
                </div>
                <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  {summary.data.byCategory.map((row) => (
                    <li key={row.category} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: COST_COLORS[row.category] }}
                          aria-hidden
                        />
                        {COST_LABELS[row.category]}
                      </span>
                      <span className="font-medium tabular-nums">{formatCurrency(row.amount)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Cost type">
        {[null, ...Object.values(TripCostCategory)].map((value) => (
          <Button
            key={value ?? "all"}
            size="sm"
            variant={category === (value ?? undefined) ? "default" : "outline"}
            aria-pressed={category === (value ?? undefined)}
            className="rounded-full"
            onClick={() => update({ category: value })}
          >
            {value ? COST_LABELS[value] : "All"}
          </Button>
        ))}
      </div>

      {list.isError && !list.data ? (
        <ErrorState
          title="Couldn't load trip costs"
          error={list.error}
          onRetry={() => void list.refetch()}
        />
      ) : !items ? (
        <Skeleton className="h-48 rounded-xl" aria-label="Loading costs" />
      ) : items.length === 0 ? (
        <EmptyState
          className="rounded-xl border border-dashed"
          icon={IndianRupee}
          title="No trip costs in this period"
          description="Add tolls, parking and other costs on a trip; fuel counts when you link a fill-up."
        />
      ) : (
        <>
          <ul className="divide-y rounded-xl border bg-card">
            {items.map((cost) => (
              <li key={cost.id}>
                <Link
                  to={`/trips/${cost.tripId}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {COST_LABELS[cost.category]}
                      {cost.vendor && (
                        <span className="font-normal text-muted-foreground">{cost.vendor}</span>
                      )}
                      <Badge variant={isVehicleCost(cost.category) ? "secondary" : "outline"}>
                        {isVehicleCost(cost.category) ? "In Expenses" : "Trip only"}
                      </Badge>
                    </p>
                    <p className="truncate text-sm text-muted-foreground tabular-nums">
                      {formatDate(cost.date)} · {cost.trip.label}
                    </p>
                  </div>
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatCurrency(cost.amount)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {list.data!.meta.totalPages > 1 && (
            <Pager
              page={page}
              pageCount={list.data!.meta.totalPages}
              onPageChange={(next) => update({ page: String(next) })}
            />
          )}
        </>
      )}
    </TripsLayout>
  );
}
