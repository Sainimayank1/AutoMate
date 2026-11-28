import {
  ReportingPeriod,
  TIMES_OF_DAY,
  type TripAnalytics,
  type TripInsight,
} from "@automate/shared";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  IndianRupee,
  type LucideIcon,
  MapPin,
  PieChart,
  Route,
  TrendingUp,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
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
import { LengthChart, WeekdayChart } from "@/features/trips/components/analytics-charts";
import { TripsLayout } from "@/features/trips/components/trips-layout";
import { TIME_OF_DAY_LABELS, TRIP_PERIODS, type TripPeriod } from "@/features/trips/constants";
import { useTripAnalytics } from "@/features/trips/hooks/use-trips";
import { durationText } from "@/features/trips/utils/trip-text";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";
import { formatCurrency, formatDistance, formatNumber } from "@/utils/format";

const ALL = "all";
const PERIODS = TRIP_PERIODS.filter((period) => period !== ReportingPeriod.CUSTOM);
const INSIGHT_ICONS: Record<TripInsight["key"], LucideIcon> = {
  distance_change: TrendingUp,
  long_trips: Route,
  category_share: PieChart,
  cost_per_km: IndianRupee,
  weekdays: CalendarDays,
  trend: ChartNoAxesCombined,
};
const SLOT_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

/**
 * Stitch "Trips — Analytics — Desktop": the period against the one before, insights from the
 * records, weekday and trip-length patterns, distance and time, actual costs (the fuel estimate
 * apart), vehicles and frequent destinations. Every figure comes from the API.
 */
export function Component() {
  const garage = useActiveVehicle();
  const vehicles = [...(useVehicles().data ?? []), ...(useVehicles({ archived: true }).data ?? [])];
  const [params, setParams] = useSearchParams();
  const vehicleParam = params.get("vehicle");
  const vehicleId =
    vehicleParam === ALL ? undefined : (vehicleParam ?? garage.activeVehicle?.id ?? undefined);
  const raw = params.get("period") ?? "";
  const period = (PERIODS as readonly string[]).includes(raw)
    ? (raw as TripPeriod)
    : ReportingPeriod.THIS_MONTH;
  const analytics = useTripAnalytics({ period, ...(vehicleId && { vehicleId }) });
  const update = (key: string, value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set(key, value);
        return next;
      },
      { replace: true },
    );
  const data = analytics.data;

  return (
    <TripsLayout
      tab="analytics"
      actions={
        <Button variant="outline" asChild>
          <Link to="/trips/new">Log trip</Link>
        </Button>
      }
    >
      <section className="flex flex-wrap items-center gap-2" aria-label="Filters">
        <Select value={vehicleId ?? ALL} onValueChange={(value) => update("vehicle", value)}>
          <SelectTrigger aria-label="Vehicle" className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {vehicles
              .filter((vehicle) => !vehicle.archivedAt)
              .map((vehicle) => (
                <SelectItem key={vehicle.id} value={vehicle.id}>
                  {vehicleName(vehicle)}
                </SelectItem>
              ))}
            <SelectItem value={ALL}>All vehicles</SelectItem>
          </SelectContent>
        </Select>
        <Select value={period} onValueChange={(value) => update("period", value)}>
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

      {analytics.isError && !data ? (
        <ErrorState
          title="Couldn't load trip analytics"
          error={analytics.error}
          onRetry={() => void analytics.refetch()}
        />
      ) : !data ? (
        <Skeleton className="h-96 rounded-xl" aria-label="Loading analytics" />
      ) : data.current.trips === 0 ? (
        <EmptyState
          className="rounded-xl border border-dashed"
          icon={ChartNoAxesCombined}
          title="No trips in this period"
          description="Analytics are worked out from the trips you log. Pick another period, or log a trip."
          action={
            <Button asChild>
              <Link to="/trips/new">Log trip</Link>
            </Button>
          }
        />
      ) : (
        <Analytics
          data={data}
          vehicleName={(id) => {
            const vehicle = vehicles.find((item) => item.id === id);
            return vehicle ? vehicleName(vehicle) : "Vehicle";
          }}
        />
      )}
    </TripsLayout>
  );
}

function Analytics({
  data,
  vehicleName: nameOf,
}: {
  data: TripAnalytics;
  vehicleName: (id: string) => string;
}) {
  const timed = data.time.byTimeOfDay.reduce((sum, row) => sum + row.trips, 0);
  return (
    <>
      <section
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
        aria-label="Against the period before"
      >
        <Tile
          label="Distance"
          value={formatDistance(data.current.distanceKm)}
          change={data.change.distance}
          previous={`vs ${formatDistance(data.previous.distanceKm)}`}
        />
        <Tile
          label="Trips"
          value={formatNumber(data.current.trips)}
          change={data.change.trips}
          previous={`vs ${formatNumber(data.previous.trips)}`}
        />
        <Tile
          label="Actual cost"
          value={data.current.actualCost ? formatCurrency(data.current.actualCost) : "—"}
          change={data.change.cost}
          previous={
            data.previous.actualCost ? `vs ${formatCurrency(data.previous.actualCost)}` : null
          }
        />
        <Tile
          label="Cost per km"
          value={data.cost.perKm ? formatCurrency(data.cost.perKm) : "—"}
          previous={
            data.cost.perKm
              ? `Over ${data.cost.tripsWithCost} trips with costs`
              : "No costs recorded"
          }
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Insights</CardTitle>
        </CardHeader>
        <CardContent>
          {data.insights.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Insights need at least 3 trips in the period, and only appear when your trips show
              something worth saying.
            </p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2" aria-label="Insights">
              {data.insights.map((insight) => {
                const Icon = INSIGHT_ICONS[insight.key];
                const body = (
                  <>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{insight.title}</span>
                      <span className="block text-sm text-muted-foreground">{insight.detail}</span>
                    </span>
                    {insight.link && (
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    )}
                  </>
                );
                return (
                  <li key={insight.key}>
                    {insight.link ? (
                      <Link
                        to={insight.link}
                        className="flex h-full items-start gap-3 rounded-lg border p-3 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="flex h-full items-start gap-3 rounded-lg border p-3">
                        {body}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Trips by weekday</CardTitle>
          </CardHeader>
          <CardContent>
            <WeekdayChart rows={data.time.byWeekday} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Trip lengths</CardTitle>
          </CardHeader>
          <CardContent>
            <LengthChart rows={data.distance.bands} />
          </CardContent>
        </Card>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle>Distance and time</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Figure label="Average a trip">
                {data.distance.averageKm ? formatDistance(data.distance.averageKm) : "—"}
              </Figure>
              <Figure label="A day">
                {data.distance.perDayKm ? formatDistance(data.distance.perDayKm) : "—"}
              </Figure>
              <Figure label="Shortest">
                {data.distance.shortest ? formatDistance(data.distance.shortest.distanceKm) : "—"}
              </Figure>
              <Figure
                label="Longest"
                link={data.distance.longest ? `/trips/${data.distance.longest.id}` : undefined}
                caption={data.distance.longest?.label}
              >
                {data.distance.longest ? formatDistance(data.distance.longest.distanceKm) : "—"}
              </Figure>
              <Figure
                label="Average drive"
                caption={
                  data.time.averageMinutes === null ? "Needs start and end times" : undefined
                }
              >
                {data.time.averageMinutes !== null ? durationText(data.time.averageMinutes) : "—"}
              </Figure>
              <Figure
                label="Longest drive"
                link={data.time.longest ? `/trips/${data.time.longest.id}` : undefined}
                caption={data.time.longest?.label}
              >
                {data.time.longest ? durationText(data.time.longest.minutes) : "—"}
              </Figure>
            </dl>
            {timed > 0 && (
              <div className="flex flex-col gap-2 border-t pt-4">
                <p className="text-sm text-muted-foreground">
                  Time of day
                  {data.time.untimedTrips > 0 &&
                    ` (${data.time.untimedTrips} without a start time)`}
                </p>
                <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  {data.time.byTimeOfDay.map((row, index) => (
                    <span
                      key={row.slot}
                      className="h-full"
                      style={{
                        width: `${(row.trips / timed) * 100}%`,
                        backgroundColor: SLOT_COLORS[index],
                      }}
                    />
                  ))}
                </div>
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {data.time.byTimeOfDay.map((row) => (
                    <li key={row.slot} className="flex items-center gap-1.5">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: SLOT_COLORS[TIMES_OF_DAY.indexOf(row.slot)] }}
                        aria-hidden
                      />
                      {TIME_OF_DAY_LABELS[row.slot]}{" "}
                      <span className="font-medium tabular-nums">{row.trips}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Costs</CardTitle>
            <Button variant="link" size="sm" asChild className="h-auto p-0">
              <Link to="/trips/costs">By category</Link>
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <p className="font-heading text-3xl font-semibold tabular-nums">
                {data.cost.actual ? formatCurrency(data.cost.actual) : "—"}
              </p>
              <p className="text-sm text-muted-foreground">
                {data.cost.actual
                  ? "Actual costs and linked fill-ups"
                  : "No costs recorded on these trips"}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-4">
              <Figure label="A trip">
                {data.cost.perTrip ? formatCurrency(data.cost.perTrip) : "—"}
              </Figure>
              <Figure label="A km">
                {data.cost.perKm ? formatCurrency(data.cost.perKm) : "—"}
              </Figure>
            </dl>
            <p className="border-t border-dashed pt-3 text-sm text-muted-foreground">
              {data.cost.fuelEstimate ? (
                <>
                  Fuel estimate{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {formatCurrency(data.cost.fuelEstimate)}
                  </span>
                  , from your average mileage and fuel price; not counted as spending.
                </>
              ) : (
                "No fuel estimate: it needs each vehicle's average mileage and price from Fuel."
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {(data.byVehicle.length > 1 || data.topDestinations.length > 0) && (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          {data.byVehicle.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Vehicles</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr>
                      <th className="pb-2 font-normal">Vehicle</th>
                      <th className="pb-2 text-right font-normal">Trips</th>
                      <th className="pb-2 text-right font-normal">Distance</th>
                      <th className="pb-2 text-right font-normal">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y tabular-nums">
                    {data.byVehicle.map((row) => (
                      <tr key={row.vehicleId}>
                        <td className="py-2">{nameOf(row.vehicleId)}</td>
                        <td className="py-2 text-right">{formatNumber(row.trips)}</td>
                        <td className="py-2 text-right">{formatDistance(row.distanceKm)}</td>
                        <td className="py-2 text-right">
                          {row.actualCost ? formatCurrency(row.actualCost) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
          {data.topDestinations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Frequent destinations</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col divide-y text-sm">
                  {data.topDestinations.map((row) => (
                    <li
                      key={row.destination}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="truncate">{row.destination}</span>
                      </span>
                      <span className="shrink-0 text-muted-foreground tabular-nums">
                        {row.trips} trips
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </>
  );
}

function Tile({
  label,
  value,
  change,
  previous,
}: {
  label: string;
  value: ReactNode;
  change?: number | null;
  previous: string | null;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-heading text-xl font-semibold tabular-nums">{value}</span>
      <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
        {change != null && change !== 0 && (
          <span className="inline-flex items-center font-medium text-foreground">
            {change > 0 ? (
              <ArrowUpRight className="size-3.5" aria-hidden />
            ) : (
              <ArrowDownRight className="size-3.5" aria-hidden />
            )}
            {Math.abs(change)}%<span className="sr-only">{change > 0 ? " up" : " down"}</span>
          </span>
        )}
        {previous}
      </span>
    </div>
  );
}

function Figure({
  label,
  caption,
  link,
  children,
}: {
  label: string;
  caption?: string;
  link?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-heading font-semibold tabular-nums">{children}</dd>
      {caption &&
        (link ? (
          <Link to={link} className="truncate text-xs text-primary hover:underline">
            {caption}
          </Link>
        ) : (
          <span className="truncate text-xs text-muted-foreground">{caption}</span>
        ))}
    </div>
  );
}
