import { type DrivingOverview, type DrivingTrips, istToday } from "@automate/shared";
import { CalendarDays } from "lucide-react";
import { Link } from "react-router";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { typeColor } from "@/features/trips/constants";
import { planTimingText } from "@/features/trips/utils/trip-text";
import {
  formatCurrency,
  formatDate,
  formatDateRange,
  formatDistance,
  formatNumber,
} from "@/utils/format";

/** "24 Nov" (the year only when it isn't this one), as in Stitch. */
const shortDate = (date: string) => formatDateRange({ from: date, to: date });

/**
 * Stitch "Dashboard" driving (and "Dashboard — Driving & Trips Card"): distance from odometer
 * readings (never assumed when readings are missing), and below it the period's trips with their
 * own distance, never added to the odometer's.
 */
export function DrivingCard({
  driving,
  range,
  vehicleId,
}: {
  driving: DrivingOverview;
  range: string;
  vehicleId: string;
}) {
  const rows = [
    {
      label: "Per day",
      value: driving.perDay ? `~${formatDistance(driving.perDay)}` : "—",
    },
    { label: "Readings", value: formatNumber(driving.readings) },
    {
      label: "Last reading",
      value: driving.lastReading
        ? `${formatDistance(driving.lastReading.km)} on ${shortDate(driving.lastReading.date)}`
        : "—",
    },
  ];
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Driving
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div>
          <p className="font-heading text-2xl font-medium tabular-nums">
            {driving.distanceKm === null ? "—" : formatDistance(driving.distanceKm)}
            <span className="text-sm font-normal text-muted-foreground"> in {range}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {driving.distanceKm === null
              ? "Needs two odometer readings in the period"
              : "From odometer readings"}
          </p>
        </div>
        <dl className="flex flex-col divide-y">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3 py-2 text-sm">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="font-medium tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>
        <TripsSummary trips={driving.trips} vehicleId={vehicleId} />
      </CardContent>
    </Card>
  );
}

function TripsSummary({ trips, vehicleId }: { trips: DrivingTrips | null; vehicleId: string }) {
  const log = (
    <Link
      to={`/trips/new?vehicle=${vehicleId}`}
      className="text-sm font-medium text-primary hover:underline max-md:inline-flex max-md:h-10 max-md:items-center"
    >
      Log trip
    </Link>
  );
  const next = trips?.nextPlan && <NextTrip plan={trips.nextPlan} />;
  if (!trips || trips.count === 0) {
    return (
      <div className="mt-auto flex flex-col gap-3 border-t pt-3">
        {next}
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {trips ? "No trips this period" : "No trips logged yet"}
          </p>
          {log}
        </div>
      </div>
    );
  }
  const total = Number(trips.distanceKm);
  return (
    <div className="mt-auto flex flex-col gap-2.5 border-t pt-3">
      <p className="text-xs font-medium text-muted-foreground">Trips</p>
      <p className="text-sm tabular-nums">
        {trips.count} {trips.count === 1 ? "trip" : "trips"}
        {trips.averageKm && ` · avg ${formatDistance(trips.averageKm)}`}
        {trips.longestKm && ` · longest ${formatDistance(trips.longestKm)}`}
      </p>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
        {trips.byCategory.map((row) => (
          <span
            key={row.name}
            className="h-full"
            style={{
              width: `${total > 0 ? (Number(row.distanceKm) / total) * 100 : 0}%`,
              backgroundColor: typeColor(row.key),
            }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {trips.byCategory.slice(0, 3).map((row) => (
          <li key={row.name} className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: typeColor(row.key) }}
              aria-hidden
            />
            {row.name}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground tabular-nums">
        {formatDistance(trips.distanceKm)} logged in trips
      </p>
      {next}
      <div className="flex gap-4">
        {log}
        <Link
          to={`/trips?vehicle=${vehicleId}`}
          className="text-sm font-medium text-primary hover:underline max-md:inline-flex max-md:h-10 max-md:items-center"
        >
          View trips
        </Link>
      </div>
    </div>
  );
}

/** Stitch "Driving & Trips Card — Next Trip": the vehicle's next plan, or the one under way. */
function NextTrip({ plan }: { plan: NonNullable<DrivingTrips["nextPlan"]> }) {
  const today = istToday(new Date());
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
        <CalendarDays className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 text-sm">
        <p className="text-xs text-muted-foreground">Next trip</p>
        <Link
          to={`/trips/planner/${plan.id}`}
          className="block truncate font-medium text-primary hover:underline"
        >
          {plan.label}
        </Link>
        <p className="text-xs text-muted-foreground tabular-nums">
          {[
            formatDate(plan.date),
            planTimingText(plan.date, plan.endDate, today),
            plan.plannedDistanceKm && `${formatDistance(plan.plannedDistanceKm)} planned`,
            plan.budget && `${formatCurrency(plan.budget)} estimated`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </div>
  );
}
