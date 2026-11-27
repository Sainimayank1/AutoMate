import { FUEL_UNIT, FUELS_FOR_VEHICLE, type FuelSummary } from "@automate/shared";
import { Car, Fuel } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { SectionHeader } from "@/components/common/section-header";
import { StatCard } from "@/components/common/stat-card";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FuelHistory } from "@/features/fuel/components/fuel-history";
import { MileageChart } from "@/features/fuel/components/mileage-chart";
import { efficiencyUnit } from "@/features/fuel/constants";
import { useFuelSummary } from "@/features/fuel/hooks/use-fuel";
import { vehicleName } from "@/features/garage/constants";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";
import {
  formatCurrency,
  formatDate,
  formatEfficiency,
  formatNumber,
  formatVolume,
} from "@/utils/format";

const addFuel = (
  <Button asChild>
    <Link to="/fuel/new">
      <Fuel data-icon="inline-start" />
      Add fuel
    </Link>
  </Button>
);

/**
 * Stitch "Fuel": six instruments, mileage trend and benchmarks, then the history, for the active
 * vehicle. Every figure comes from the API (`/fuel-summary`). Deviation: the "ARAI claimed" line
 * is dropped (we hold no claimed figure to compare against); phones skip the chart, as in Stitch.
 */
export function Component() {
  const garage = useActiveVehicle();
  const vehicle = garage.activeVehicle;
  // The summary decides the page's state (fillCount); the history loads its own pages.
  const summary = useFuelSummary(vehicle?.id);

  const header = (description: ReactNode) => (
    <PageHeader title="Fuel & mileage" description={description} actions={vehicle && addFuel} />
  );

  if (garage.isError) {
    return (
      <PageContainer>
        {header(null)}
        <ErrorState
          title="Couldn't load your garage"
          error={garage.error}
          onRetry={() => void garage.refetch()}
        />
      </PageContainer>
    );
  }
  if (!garage.isPending && !vehicle) {
    return (
      <PageContainer>
        {header("Track fill-ups, mileage and fuel spend.")}
        <EmptyState
          className="rounded-xl border border-dashed"
          icon={Car}
          title="Add a vehicle first"
          description="Fill-ups are logged against a vehicle in your garage."
          action={
            <Button asChild>
              <Link to="/garage/new">Add vehicle</Link>
            </Button>
          }
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {header(vehicle ? `Full-tank mileage tracking · ${vehicleName(vehicle)}` : "Loading…")}

      {summary.isError ? (
        <ErrorState
          title="Couldn't load fuel records"
          error={summary.error}
          onRetry={() => void summary.refetch()}
        />
      ) : !vehicle || !summary.data ? (
        <>
          <FuelStats loading />
          <Skeleton className="h-72 rounded-xl max-md:hidden" />
          <Skeleton className="h-64 rounded-xl" />
        </>
      ) : summary.data.fillCount === 0 ? (
        <FuelEmptyState />
      ) : (
        <>
          <FuelStats summary={summary.data} />
          <div className="grid gap-6 max-md:hidden lg:grid-cols-12">
            <MileageTrend summary={summary.data} />
            <Benchmarks summary={summary.data} />
          </div>
          <FuelHistory
            // A different vehicle starts at page 1 with no filters.
            key={vehicle.id}
            vehicleId={vehicle.id}
            showFuel={FUELS_FOR_VEHICLE[vehicle.fuelType].length > 1}
          />
        </>
      )}
    </PageContainer>
  );
}

/** Stitch "Fuel — Empty State": one centred card with the next step. */
function FuelEmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center py-8">
      <div className="flex w-full max-w-xl flex-col items-center gap-5 rounded-xl border border-dashed bg-card p-6 text-center sm:p-10">
        <div className="flex size-16 items-center justify-center rounded-xl border bg-muted">
          <Fuel className="size-7 text-muted-foreground" aria-hidden />
        </div>
        <div className="flex max-w-md flex-col gap-2">
          <h2 className="font-heading text-xl font-semibold tracking-tight">No fill-ups yet</h2>
          <p className="text-sm text-pretty text-muted-foreground">
            Log every fill-up to track real-world mileage and fuel spend. Mileage appears after two
            full-tank fills.
          </p>
        </div>
        {addFuel}
      </div>
    </div>
  );
}

/** The API counts "this month" in IST; label it the same way whatever the browser's zone. */
const IST_MONTH = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

/** Stitch's six instruments; phones keep four (2 × 2), as in "Fuel — Mobile". */
function FuelStats({ summary, loading }: { summary?: FuelSummary; loading?: boolean }) {
  const unit = summary ? FUEL_UNIT[summary.fuelType] : "L";
  const efficiency = summary ? efficiencyUnit(summary.fuelType) : "km/L";
  const fills = summary?.thisMonth.fillCount ?? 0;
  const stats: { label: string; value: string; hint: string; phone?: false }[] = [
    {
      label: "Avg. mileage",
      value: formatEfficiency(summary?.averageMileage, efficiency),
      hint: summary?.mileageSequences
        ? `From ${formatNumber(summary.mileageSequences)} full-tank ${summary.mileageSequences === 1 ? "sequence" : "sequences"}`
        : "Needs 2 full-tank fills",
    },
    {
      label: "Last mileage",
      value: formatEfficiency(summary?.lastMileage?.mileage, efficiency),
      hint: summary?.lastMileage
        ? formatDate(summary.lastMileage.date)
        : "No full-tank sequence yet",
    },
    {
      label: "This month",
      value: formatCurrency(summary?.thisMonth.spend),
      hint: `${formatNumber(fills)} ${fills === 1 ? "fill-up" : "fill-ups"}`,
    },
    {
      label: "Fuel this month",
      value: formatVolume(summary?.thisMonth.quantity, unit),
      hint: IST_MONTH.format(new Date()),
      phone: false,
    },
    {
      label: `Avg. price / ${unit}`,
      value: formatCurrency(summary?.averagePrice),
      hint: "All fill-ups",
      phone: false,
    },
    {
      label: "Fuel cost / km",
      value: formatCurrency(summary?.costPerKm),
      hint: "Over measured full tanks",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      {stats.map((stat) => (
        <StatCard
          key={stat.label}
          label={stat.label}
          value={stat.value}
          hint={stat.hint}
          loading={loading}
          className={stat.phone === false ? "max-md:hidden" : undefined}
        />
      ))}
    </div>
  );
}

function MileageTrend({ summary }: { summary: FuelSummary }) {
  const efficiency = efficiencyUnit(summary.fuelType);
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 lg:col-span-8">
      <SectionHeader
        title={`Mileage trend (${efficiency})`}
        description="Partial fill-ups roll into the next full tank"
        actions={
          summary.averageMileage && (
            <span className="font-mono text-sm text-muted-foreground tabular-nums">
              {formatEfficiency(summary.averageMileage, efficiency)} avg
            </span>
          )
        }
      />
      {summary.trend.length >= 2 ? (
        <MileageChart points={summary.trend} unit={efficiency} />
      ) : (
        <p className="flex h-48 items-center justify-center rounded-lg border border-dashed px-6 text-center text-sm text-muted-foreground">
          The trend appears after three full-tank fills: each pair gives one mileage figure.
        </p>
      )}
    </section>
  );
}

function Benchmarks({ summary }: { summary: FuelSummary }) {
  const efficiency = efficiencyUnit(summary.fuelType);
  const rows = [
    { label: "Best mileage", point: summary.bestMileage, tone: "text-success" },
    { label: "Lowest mileage", point: summary.worstMileage, tone: "text-warning" },
  ];
  return (
    <section className="flex flex-col justify-between gap-4 rounded-xl border bg-card p-5 lg:col-span-4">
      <SectionHeader title="Efficiency benchmarks" />
      {summary.mileageSequences >= 2 ? (
        <div className="flex flex-col gap-3">
          {rows.map(({ label, point, tone }) => (
            <div
              key={label}
              className="flex items-center justify-between gap-3 rounded-lg border bg-muted p-3.5"
            >
              <div>
                <p className="text-xs font-semibold text-muted-foreground">{label}</p>
                <p className="text-sm text-muted-foreground tabular-nums">
                  {formatDate(point?.date)}
                </p>
              </div>
              <span className={`font-heading text-lg font-semibold tabular-nums ${tone}`}>
                {formatEfficiency(point?.mileage, efficiency)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Best and lowest appear once two full-tank sequences are measured.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Based on {formatNumber(summary.mileageSequences)} measured full-tank{" "}
        {summary.mileageSequences === 1 ? "sequence" : "sequences"}.
      </p>
    </section>
  );
}
