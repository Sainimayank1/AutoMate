import { ReportingPeriod, type TripAnalytics } from "@automate/shared";
import { cn } from "cn";
import { format } from "date-fns";
import { ArrowLeft, Printer } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router";

import { ErrorState } from "@/components/feedback/error-state";
import { BrandLogo } from "@/components/layout/brand-logo";
import { Button } from "@/components/ui/button";
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
import { LENGTH_BAND_LABELS, TRIP_PERIODS, type TripPeriod } from "@/features/trips/constants";
import { useAllTrips, useTripAnalytics } from "@/features/trips/hooks/use-trips";
import { durationText } from "@/features/trips/utils/trip-text";
import { useLightPage } from "@/hooks/use-light-page";
import {
  formatCurrency,
  formatDate,
  formatDistance,
  formatNumber,
  formatRegistration,
} from "@/utils/format";

const ALL = "all";
const PERIODS = TRIP_PERIODS.filter((period) => period !== ReportingPeriod.CUSTOM);

/**
 * `/trips/report?vehicle=&period=` (Stitch "Trips Report"): a printable sheet outside the shell:
 * the period's figures (the fuel estimate apart), trip lengths, vehicles or destinations, and
 * every trip. The toolbar isn't printed; "Print or save as PDF" uses the browser's own dialog.
 */
export function Component() {
  useLightPage();
  const [params, setParams] = useSearchParams();
  const vehicles = [...(useVehicles().data ?? []), ...(useVehicles({ archived: true }).data ?? [])];
  const vehicleParam = params.get("vehicle");
  const vehicle =
    vehicleParam && vehicleParam !== ALL
      ? vehicles.find((item) => item.id === vehicleParam)
      : undefined;
  const vehicleId = vehicleParam && vehicleParam !== ALL ? vehicleParam : undefined;
  const raw = params.get("period") ?? "";
  const period = (PERIODS as readonly string[]).includes(raw)
    ? (raw as TripPeriod)
    : ReportingPeriod.THIS_YEAR;
  const analytics = useTripAnalytics({ period, ...(vehicleId && { vehicleId }) });
  const data = analytics.data;
  const trips = useAllTrips(
    data
      ? {
          ...(vehicleId && { vehicleId }),
          from: data.period.from,
          to: data.period.to,
          sort: "oldest",
        }
      : undefined,
  );
  const nameOf = (id: string) => {
    const item = vehicles.find((candidate) => candidate.id === id);
    return item ? vehicleName(item) : "Vehicle";
  };

  return (
    <div className="min-h-svh bg-muted/60 py-6 print:bg-background print:py-0">
      <title>Trips report · AutoMate</title>
      <div className="mx-auto flex max-w-[860px] flex-wrap items-center justify-between gap-3 px-4 pb-4 print:hidden">
        <Button variant="ghost" asChild>
          <Link to={`/trips/analytics?vehicle=${vehicleId ?? ALL}&period=${period}`}>
            <ArrowLeft data-icon="inline-start" />
            Back
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={period}
            onValueChange={(value) =>
              setParams(
                (current) => {
                  current.set("period", value);
                  return current;
                },
                { replace: true },
              )
            }
          >
            <SelectTrigger aria-label="Period" className="w-44 bg-background">
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
          <Button onClick={() => window.print()} disabled={!data || trips.isPending}>
            <Printer data-icon="inline-start" />
            Print or save as PDF
          </Button>
        </div>
      </div>

      <article className="mx-auto flex max-w-[860px] flex-col gap-8 bg-background px-10 py-10 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        {analytics.isError && !data ? (
          <ErrorState
            title="Couldn't load the report"
            error={analytics.error}
            onRetry={() => void analytics.refetch()}
          />
        ) : !data ? (
          <Skeleton className="h-[600px] w-full" />
        ) : (
          <Report
            data={data}
            vehicleLabel={
              vehicle
                ? `${vehicleName(vehicle)} · ${formatRegistration(vehicle.registrationNumber)}`
                : "All vehicles"
            }
            trips={trips}
            nameOf={nameOf}
          />
        )}
      </article>
    </div>
  );
}

function Report({
  data,
  vehicleLabel,
  trips,
  nameOf,
}: {
  data: TripAnalytics;
  vehicleLabel: string;
  trips: ReturnType<typeof useAllTrips>;
  nameOf: (id: string) => string;
}) {
  return (
    <>
      <header className="flex flex-col gap-3 border-b-2 border-primary pb-4">
        <BrandLogo size="md" />
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="font-heading text-2xl font-medium">Trips report</h1>
            <p className="text-sm">{vehicleLabel}</p>
          </div>
          <p className="text-sm text-muted-foreground tabular-nums">
            {formatDate(data.period.from)} to {formatDate(data.period.to)} · generated{" "}
            {formatDate(format(new Date(), "yyyy-MM-dd"))}
          </p>
        </div>
      </header>

      <Section title="Summary">
        <dl className="grid grid-cols-2 gap-4 text-sm tabular-nums sm:grid-cols-4 print:grid-cols-4">
          <Figure label="Trips" value={formatNumber(data.current.trips)} />
          <Figure label="Distance" value={formatDistance(data.current.distanceKm)} />
          <Figure
            label="Actual cost"
            value={data.cost.actual ? formatCurrency(data.cost.actual) : "—"}
            note={
              data.cost.perKm ? `${formatCurrency(data.cost.perKm)} per km` : "No costs recorded"
            }
          />
          <Figure
            label="Fuel estimate"
            value={data.cost.fuelEstimate ? formatCurrency(data.cost.fuelEstimate) : "—"}
            note="Estimate, not spending"
          />
        </dl>
      </Section>

      <div className="grid gap-8 sm:grid-cols-2 print:grid-cols-2">
        <Section title="Trip lengths">
          <ReportTable
            head={["Length", "Trips", "Distance"]}
            rows={data.distance.bands.map((row) => [
              LENGTH_BAND_LABELS[row.band],
              formatNumber(row.trips),
              formatDistance(row.distanceKm),
            ])}
            empty="No trips in this period."
          />
        </Section>
        {data.byVehicle.length > 1 ? (
          <Section title="Vehicles">
            <ReportTable
              head={["Vehicle", "Trips", "Distance"]}
              rows={data.byVehicle.map((row) => [
                nameOf(row.vehicleId),
                formatNumber(row.trips),
                formatDistance(row.distanceKm),
              ])}
              empty="No trips in this period."
            />
          </Section>
        ) : (
          <Section title="Frequent destinations">
            <ReportTable
              head={["Destination", "Trips"]}
              rows={data.topDestinations.map((row) => [row.destination, formatNumber(row.trips)])}
              empty="No destination reached twice."
            />
          </Section>
        )}
      </div>

      <Section title="Trips">
        {trips.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <ReportTable
            head={["Date", "Trip", "Type", "Distance", "Duration", "Cost"]}
            rows={(trips.data ?? []).map((trip) => [
              formatDate(trip.date),
              [
                trip.title,
                trip.origin && trip.destination
                  ? `${trip.origin} → ${trip.destination}`
                  : (trip.destination ?? trip.origin),
              ]
                .filter(Boolean)
                .join(" · ") || trip.category.name,
              trip.category.name,
              formatDistance(trip.distanceKm),
              trip.durationMinutes !== null ? durationText(trip.durationMinutes) : "—",
              trip.actualCost ? formatCurrency(trip.actualCost) : "—",
            ])}
            empty="No trips in this period."
            total={[
              `${formatNumber(data.current.trips)} trips · ${formatDistance(data.current.distanceKm)}`,
              data.cost.actual ? formatCurrency(data.cost.actual) : "—",
            ]}
          />
        )}
      </Section>

      <footer className="border-t pt-3 text-xs text-muted-foreground">
        Distance is from odometer readings, entered distances or routes. Actual cost is recorded
        trip costs and linked fill-ups; the fuel estimate uses your average mileage and fuel price
        and isn&apos;t spending.
      </footer>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 break-inside-avoid-page">
      <h2 className="font-heading text-base font-medium">{title}</h2>
      {children}
    </section>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-1 border-l-2 pl-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-heading text-lg font-medium">{value}</dd>
      {note && <dd className="text-xs text-muted-foreground">{note}</dd>}
    </div>
  );
}

function ReportTable({
  head,
  rows,
  empty,
  total,
}: {
  head: string[];
  rows: string[][];
  empty: string;
  total?: [string, string];
}) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <table className="w-full text-sm tabular-nums">
      <thead>
        <tr className="border-b text-left text-xs text-muted-foreground">
          {head.map((cell, index) => (
            <th
              key={cell}
              scope="col"
              className={cn("py-1.5 font-medium", index === head.length - 1 && "text-right")}
            >
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b last:border-b-0">
            {row.map((cell, index) => (
              <td
                key={index}
                className={cn("py-1.5 pr-2 align-top", index === row.length - 1 && "text-right")}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {total && (
        <tfoot>
          <tr className="border-t-2 font-medium">
            <td colSpan={head.length - 1} className="py-1.5">
              {total[0]}
            </td>
            <td className="py-1.5 text-right">{total[1]}</td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}
