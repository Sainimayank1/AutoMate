import {
  customWindow,
  ReportingPeriod,
  type TripGranularity,
  type TripOverview,
} from "@automate/shared";
import { format, parseISO } from "date-fns";
import { Car, Gauge, Plus, Route } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router";

import { DatePicker } from "@/components/common/date-picker";
import { Segmented } from "@/components/common/segmented";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
import { DistanceChart } from "@/features/trips/components/distance-chart";
import { TripRow } from "@/features/trips/components/trip-row";
import { TripsLayout } from "@/features/trips/components/trips-layout";
import { TRIP_PERIODS, type TripPeriod, typeColor } from "@/features/trips/constants";
import { useTripOverview, useTrips } from "@/features/trips/hooks/use-trips";
import { durationText } from "@/features/trips/utils/trip-text";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";
import { formatCurrency, formatDistance, formatNumber } from "@/utils/format";

const ALL = "all";
const GRANULARITIES: { value: TripGranularity; label: string }[] = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
];
const iso = (date: Date | undefined) => (date ? format(date, "yyyy-MM-dd") : undefined);

/**
 * Stitch "Trips Overview — Desktop / Mobile": distance, trips, average and driving time for one
 * vehicle or all, distance over time, trips by type and the latest trips. Every figure comes from
 * the API (aggregated there); the vehicle, period and chart grouping live in the URL.
 */
export function Component() {
  const garage = useActiveVehicle();
  const vehicles = useVehicles().data ?? [];
  const [params, setParams] = useSearchParams();
  const vehicleParam = params.get("vehicle");
  const vehicleId =
    vehicleParam === ALL ? undefined : (vehicleParam ?? garage.activeVehicle?.id ?? undefined);
  const raw = params.get("period") ?? "";
  const period = (TRIP_PERIODS as readonly string[]).includes(raw)
    ? (raw as TripPeriod)
    : ReportingPeriod.THIS_MONTH;
  const custom =
    period === ReportingPeriod.CUSTOM
      ? customWindow(params.get("from") ?? undefined, params.get("to") ?? undefined, new Date())
      : undefined;
  const granularityParam = params.get("by");
  const granularity = GRANULARITIES.some((item) => item.value === granularityParam)
    ? (granularityParam as TripGranularity)
    : undefined;
  const overview = useTripOverview(
    { period, ...custom, ...(vehicleId && { vehicleId }), ...(granularity && { granularity }) },
    !garage.isPending,
  );
  // Whether there's any trip at all: the empty state differs from "none this period".
  const any = useTrips({ pageSize: 1 });

  const update = (changes: Record<string, string | undefined>) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true },
    );

  if (!garage.isPending && vehicles.length === 0 && !garage.activeVehicle) {
    return (
      <TripsLayout tab="overview">
        <EmptyState
          className="rounded-xl border border-dashed"
          icon={Car}
          title="Add a vehicle first"
          description="Trips are recorded per vehicle in your garage."
          action={
            <Button asChild>
              <Link to="/garage/new">Add vehicle</Link>
            </Button>
          }
        />
      </TripsLayout>
    );
  }

  const selected = vehicles.find((vehicle) => vehicle.id === vehicleId);
  const logButton = (
    <Button asChild>
      <Link to={`/trips/new${vehicleId ? `?vehicle=${vehicleId}` : ""}`}>
        <Plus data-icon="inline-start" />
        Log trip
      </Link>
    </Button>
  );
  const data = overview.data;
  return (
    <TripsLayout
      tab="overview"
      description={
        selected
          ? `${vehicleName(selected)} · ${formatDistance(selected.odometerKm)}`
          : "All vehicles"
      }
      actions={logButton}
    >
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
        <Select
          value={period}
          onValueChange={(value) => {
            const next = value as TripPeriod;
            if (next !== ReportingPeriod.CUSTOM) {
              return update({ period: next, from: undefined, to: undefined });
            }
            const start = customWindow(data?.period.from, data?.period.to, new Date());
            update({ period: next, ...start });
          }}
        >
          <SelectTrigger aria-label="Period" className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRIP_PERIODS.map((value) => (
              <SelectItem key={value} value={value}>
                {PERIOD_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {custom && (
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Label htmlFor="trips-from" className="sr-only">
              Start date
            </Label>
            <DatePicker
              id="trips-from"
              value={parseISO(custom.from)}
              onChange={(date) => update({ from: iso(date) })}
              disabledDates={{ after: parseISO(custom.to) }}
              placeholder="From"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <Label htmlFor="trips-to" className="sr-only">
              End date
            </Label>
            <DatePicker
              id="trips-to"
              value={parseISO(custom.to)}
              onChange={(date) => update({ to: iso(date) })}
              disabledDates={[{ before: parseISO(custom.from) }, { after: new Date() }]}
              placeholder="To"
            />
          </div>
        )}
      </section>

      {overview.isError && !data ? (
        <ErrorState
          title="Couldn't load your trips"
          error={overview.error}
          onRetry={() => void overview.refetch()}
        />
      ) : !data ? (
        <OverviewSkeleton />
      ) : any.data?.meta.total === 0 ? (
        <EmptyState
          className="rounded-xl border border-dashed"
          icon={Route}
          title="No trips yet"
          description="Your journeys will appear here as you start recording trips."
          action={
            <Button asChild>
              <Link to={`/trips/new${vehicleId ? `?vehicle=${vehicleId}` : ""}`}>
                <Plus data-icon="inline-start" />
                Log your first trip
              </Link>
            </Button>
          }
        />
      ) : (
        <Overview
          data={data}
          vehicleName={(id) => {
            const vehicle = vehicles.find((item) => item.id === id);
            return vehicle ? vehicleName(vehicle) : null;
          }}
          granularity={data.series.granularity}
          onGranularity={(value) => update({ by: value })}
          odometerHref={selected && `/garage/${selected.id}/edit`}
        />
      )}
    </TripsLayout>
  );
}

function Overview({
  data,
  vehicleName,
  granularity,
  onGranularity,
  odometerHref,
}: {
  data: TripOverview;
  vehicleName: (id: string) => string | null;
  granularity: TripGranularity;
  onGranularity: (value: TripGranularity) => void;
  odometerHref?: string;
}) {
  const noneInPeriod = data.trips === 0;
  return (
    <>
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5" aria-label="Key figures">
        <Metric
          label="Distance"
          value={formatDistance(data.distanceKm)}
          caption={`from ${data.trips} ${data.trips === 1 ? "trip" : "trips"}`}
        />
        <Metric
          label="Trips"
          value={formatNumber(data.trips)}
          caption={data.perWeek ? `~${data.perWeek} per week` : "—"}
        />
        <Metric
          label="Average trip"
          value={data.averageKm ? formatDistance(data.averageKm) : "—"}
          caption={data.longest ? `Longest ${formatDistance(data.longest.distanceKm)}` : "—"}
        />
        <Metric
          label="Driving time"
          value={data.drivingMinutes !== null ? durationText(data.drivingMinutes) : "—"}
          caption={
            data.timedTrips
              ? `from ${data.timedTrips} ${data.timedTrips === 1 ? "trip" : "trips"} with times`
              : "Add start and end times to see it"
          }
        />
        <Metric
          label="Trip costs"
          value={data.cost.total ? formatCurrency(data.cost.total) : "—"}
          caption={
            data.cost.total
              ? data.cost.perKm
                ? `${formatCurrency(data.cost.perKm)} per km`
                : "Actual costs recorded"
              : "Add costs on a trip to see them"
          }
        />
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHeader>
            <CardTitle>Distance driven</CardTitle>
            <CardAction>
              <Segmented
                value={granularity}
                options={GRANULARITIES}
                onChange={onGranularity}
                aria-label="Group distance by"
              />
            </CardAction>
          </CardHeader>
          <CardContent>
            {noneInPeriod ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No trips in this period.
              </p>
            ) : (
              <DistanceChart series={data.series} />
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>By trip type</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {noneInPeriod ? (
              <p className="text-sm text-muted-foreground">No trips in this period.</p>
            ) : (
              <TypeBreakdown data={data} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent trips</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No trips in this period.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {data.recent.map((trip) => (
                <li key={trip.id}>
                  <TripRow
                    trip={trip}
                    vehicle={data.vehicleId ? null : vehicleName(trip.vehicleId)}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <section className="flex flex-wrap gap-2" aria-label="Quick actions">
        <Button variant="outline" asChild>
          <Link to="/trips/new">
            <Plus data-icon="inline-start" />
            Log trip
          </Link>
        </Button>
        {odometerHref && (
          <Button variant="outline" asChild>
            <Link to={odometerHref}>
              <Gauge data-icon="inline-start" />
              Update odometer
            </Link>
          </Button>
        )}
      </section>
    </>
  );
}

function Metric({ label, value, caption }: { label: string; value: ReactNode; caption: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-heading text-2xl font-medium tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{caption}</span>
    </div>
  );
}

function TypeBreakdown({ data }: { data: TripOverview }) {
  const total = Number(data.distanceKm);
  const share = (km: string) => (total > 0 ? (Number(km) / total) * 100 : 0);
  return (
    <>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
        {data.byCategory.map((row) => (
          <span
            key={row.categoryId}
            className="h-full"
            style={{ width: `${share(row.distanceKm)}%`, backgroundColor: typeColor(row.key) }}
          />
        ))}
      </div>
      <ul className="flex flex-col gap-2.5 text-sm">
        {data.byCategory.map((row) => (
          <li key={row.categoryId} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: typeColor(row.key) }}
                aria-hidden
              />
              <span className="truncate">{row.name}</span>
            </span>
            <span className="shrink-0 text-muted-foreground tabular-nums">
              {formatDistance(row.distanceKm)} · {row.trips} {row.trips === 1 ? "trip" : "trips"} ·{" "}
              {Math.round(share(row.distanceKm))}%
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading trips">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-12">
        <Skeleton className="h-72 rounded-xl lg:col-span-8" />
        <Skeleton className="h-72 rounded-xl lg:col-span-4" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
