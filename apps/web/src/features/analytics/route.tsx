import { OWNERSHIP_PERIODS, type OwnershipPeriod } from "@automate/shared";
import { cn } from "cn";
import { ChartNoAxesCombined, Printer } from "lucide-react";
import { Link, useSearchParams } from "react-router";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { Segmented } from "@/components/common/segmented";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAnalytics } from "@/features/analytics/hooks/use-analytics";
import { SpendingSection } from "@/features/dashboard/components/spending-section";
import { ALL_VEHICLES } from "@/features/expenses/hooks/use-expense-filters";
import { FUEL_TYPE_LABELS } from "@/features/garage/constants";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";
import {
  formatCurrency,
  formatDateRange,
  formatDistance,
  formatNumber,
  formatRegistration,
} from "@/utils/format";

const PERIOD_LABELS: Record<OwnershipPeriod, string> = {
  this_month: "This month",
  this_year: "This year",
  all_time: "Lifetime",
};

/**
 * `/analytics` (Stitch "Analytics & TCO"): every vehicle's ownership cost side by side and the
 * fleet's totals, spending trend and breakdown. Deviations: the period offers This month · This
 * year · Lifetime (the ownership periods) instead of a financial year; trip charts live in Trips
 * (`/trips/analytics`).
 */
export function Component() {
  const [params, setParams] = useSearchParams();
  const garage = useActiveVehicle();
  const asked = params.get("period");
  const period = (OWNERSHIP_PERIODS as readonly string[]).includes(asked ?? "")
    ? (asked as OwnershipPeriod)
    : "this_year";
  const analytics = useAnalytics({ period });
  const data = analytics.data;
  const reportFor = garage.activeVehicle?.id ?? data?.vehicles[0]?.vehicleId;

  return (
    <PageContainer>
      <PageHeader
        title="Total cost of ownership"
        description="True cost per km, where the money goes, and your vehicles side by side"
        actions={
          <>
            <Segmented
              aria-label="Period"
              className="grid grid-cols-3"
              value={period}
              onChange={(value) =>
                setParams(
                  (current) => {
                    current.set("period", value);
                    return current;
                  },
                  { replace: true },
                )
              }
              options={OWNERSHIP_PERIODS.map((value) => ({ value, label: PERIOD_LABELS[value] }))}
            />
            {reportFor && (
              <Button asChild>
                <Link to={`/expenses/report?vehicle=${reportFor}&period=${period}`}>
                  <Printer data-icon="inline-start" />
                  Export report
                </Link>
              </Button>
            )}
          </>
        }
      />

      {analytics.isError && !data ? (
        <ErrorState
          title="Couldn't load the analytics"
          error={analytics.error}
          onRetry={() => void analytics.refetch()}
        />
      ) : !data ? (
        <div className="flex flex-col gap-6">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      ) : data.vehicles.length === 0 ? (
        <EmptyState
          className="rounded-xl border border-dashed"
          icon={ChartNoAxesCombined}
          title="No vehicles yet"
          description="Add a vehicle and its fill-ups and expenses to see what it really costs."
          action={
            <Button asChild>
              <Link to="/garage/new">Add vehicle</Link>
            </Button>
          }
        />
      ) : (
        <>
          <section aria-label="Totals" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Tile
              label="Spent"
              value={formatCurrency(data.totals.spent)}
              note={`${formatDateRange(data.window)} · ${data.vehicles.length} vehicle${data.vehicles.length === 1 ? "" : "s"}`}
            />
            <Tile
              label="True cost / km"
              value={data.totals.costPerKm ? formatCurrency(data.totals.costPerKm) : "—"}
              note={
                data.totals.costPerKm
                  ? `Over ${formatDistance(data.totals.distanceKm)}, depreciation included`
                  : "Needs two odometer readings in the period"
              }
              tone="text-primary"
            />
            <Tile
              label="Average mileage"
              value={
                data.totals.mileage
                  ? `${formatNumber(data.totals.mileage.value, { minFractionDigits: 1 })} ${data.totals.mileage.unit}`
                  : "—"
              }
              note={
                data.totals.mileage
                  ? `Weighted over ${data.totals.mileage.cycles} full-tank cycles`
                  : "Needs full-tank fill-ups in one fuel unit"
              }
            />
            <Tile
              label="Estimated resale value"
              value={data.totals.estimatedValue ? formatCurrency(data.totals.estimatedValue) : "—"}
              note={
                data.totals.estimatedValue
                  ? "Estimate on the IRDAI depreciation schedule"
                  : "Add purchase prices to estimate it"
              }
            />
          </section>

          <SpendingSection spending={data.spending} period={data.window} vehicleId={ALL_VEHICLES} />

          <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle role="heading" aria-level={2}>
                Vehicle comparison
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                {data.vehicles.length} active vehicle{data.vehicles.length === 1 ? "" : "s"} ·{" "}
                {formatCurrency(data.totals.perMonth)} a month on average
              </span>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle</TableHead>
                    <TableHead className="text-right max-md:hidden">Odometer</TableHead>
                    <TableHead className="text-right">Mileage</TableHead>
                    <TableHead className="text-right">Cost / km</TableHead>
                    <TableHead className="text-right max-md:hidden">Service spend</TableHead>
                    <TableHead className="text-right">Total cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.vehicles.map((row) => (
                    <TableRow key={row.vehicleId}>
                      <TableCell>
                        <Link
                          to={`/expenses/ownership?vehicle=${row.vehicleId}&period=${period}`}
                          className="font-medium hover:underline"
                        >
                          {row.name}
                        </Link>
                        <p className="font-mono text-xs text-muted-foreground">
                          {formatRegistration(row.registrationNumber)} ·{" "}
                          {FUEL_TYPE_LABELS[row.fuelType]}
                        </p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums max-md:hidden">
                        {formatDistance(row.odometerKm)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.mileage
                          ? `${formatNumber(row.mileage.value, { minFractionDigits: 1 })} ${row.mileage.unit}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.ownership.economicPerKm
                          ? formatCurrency(row.ownership.economicPerKm)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums max-md:hidden">
                        {formatCurrency(row.serviceSpend)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCurrency(row.ownership.economic)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-3 text-xs text-muted-foreground">
                Total cost is the economic ownership cost: running, insurance and taxes, loan
                interest and fees, accessories and depreciation (an estimate). Loan principal is
                never a cost. Trip analytics are in{" "}
                <Link
                  to={`/trips/analytics?period=${period}`}
                  className="font-medium text-primary hover:underline"
                >
                  Trips
                </Link>
                .
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </PageContainer>
  );
}

function Tile({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border bg-card p-4">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className={cn("font-heading text-2xl font-medium tabular-nums", tone)}>{value}</span>
      <span className="text-xs text-muted-foreground">{note}</span>
    </div>
  );
}
