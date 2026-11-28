import { OWNERSHIP_PERIODS, type OwnershipCost, type OwnershipPeriod } from "@automate/shared";
import { Info, Printer } from "lucide-react";
import { Link, useSearchParams } from "react-router";

import { Segmented } from "@/components/common/segmented";
import { ErrorState } from "@/components/feedback/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ExpensesLayout } from "@/features/expenses/components/expenses-layout";
import { useExpenseFilters } from "@/features/expenses/hooks/use-expense-filters";
import { useOwnershipCost } from "@/features/expenses/hooks/use-expenses";
import { vehicleName } from "@/features/garage/constants";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";
import { formatCurrency, formatDate, formatDistance, formatNumber } from "@/utils/format";

const PERIOD_LABELS: Record<OwnershipPeriod, string> = {
  this_month: "This month",
  this_year: "This year",
  all_time: "Since purchase",
};

/**
 * `/expenses/ownership` (Stitch "Expenses — Ownership"): one vehicle's operating cost, cash outflow
 * and economic ownership cost for a period, where the economic cost goes, per km and per month,
 * and depreciation as a labelled estimate. Every figure comes from the API.
 */
export function Component() {
  const filters = useExpenseFilters();
  const garage = useActiveVehicle();
  const [params, setParams] = useSearchParams();
  const asked = params.get("period");
  const period = (OWNERSHIP_PERIODS as readonly string[]).includes(asked ?? "")
    ? (asked as OwnershipPeriod)
    : "this_year";
  // A single vehicle: the one in scope, else the active one.
  const vehicleId = filters.query.vehicleId ?? garage.activeVehicle?.id;
  const cost = useOwnershipCost(filters.ready && vehicleId ? { vehicleId, period } : undefined);
  const data = cost.data;

  return (
    <ExpensesLayout tab="ownership">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={vehicleId ?? ""} onValueChange={(value) => filters.set("vehicle", value)}>
          <SelectTrigger aria-label="Vehicle" className="w-full sm:w-64 max-md:h-10">
            <SelectValue placeholder="Choose a vehicle" />
          </SelectTrigger>
          <SelectContent>
            {garage.vehicles.map((vehicle) => (
              <SelectItem key={vehicle.id} value={vehicle.id}>
                {vehicleName(vehicle)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
          <Button
            variant="outline"
            asChild
            className="max-md:h-10 max-sm:w-full"
            disabled={!vehicleId}
          >
            <Link to={`/expenses/report?vehicle=${vehicleId ?? ""}&period=${period}`}>
              <Printer data-icon="inline-start" />
              Printable report
            </Link>
          </Button>
          <Segmented
            aria-label="Period"
            className="grid w-full grid-cols-3 sm:w-auto"
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
        </div>
      </div>

      {cost.isError && !data ? (
        <ErrorState
          title="Couldn't load the ownership cost"
          error={cost.error}
          onRetry={() => void cost.refetch()}
        />
      ) : !data ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <>
          <MoneyViews cost={data} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <Breakdown cost={data} />
            <div className="flex flex-col gap-6 lg:col-span-5">
              <Rates cost={data} />
              <Depreciation cost={data} vehicleId={vehicleId!} />
            </div>
          </div>
        </>
      )}
    </ExpensesLayout>
  );
}

function MoneyViews({ cost }: { cost: OwnershipCost }) {
  const views = [
    {
      label: "Operating cost",
      value: cost.operating,
      note: "Running it: fuel, servicing, repairs, tolls, parking, washing. Cost per km uses only this.",
    },
    {
      label: "Cash outflow",
      value: cost.cashOutflow,
      note:
        cost.principal === "0.00"
          ? "Everything paid, a loan's full EMI included."
          : `Everything paid, the full EMI included (${formatCurrency(cost.principal)} of loan principal).`,
    },
    {
      label: "Economic ownership cost",
      value: cost.economic,
      note: "Running + insurance and taxes + loan interest and fees + accessories + depreciation.",
      estimate: !!cost.depreciation,
    },
  ];
  return (
    <Card>
      <CardHeader className="flex flex-col gap-1">
        <CardTitle role="heading" aria-level={2}>
          Three ways to count it
        </CardTitle>
        <p className="text-sm text-muted-foreground tabular-nums">
          {formatDate(cost.window.from)} to {formatDate(cost.window.to)} · loan principal pays the
          loan down, so it&apos;s cash, never cost
        </p>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 md:grid-cols-3">
          {views.map((view) => (
            <div
              key={view.label}
              className="flex flex-col gap-1.5 rounded-lg border bg-elevated p-4"
            >
              <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                {view.label}
                {view.estimate && (
                  <Badge variant="outline" className="text-muted-foreground">
                    Estimate
                  </Badge>
                )}
              </dt>
              <dd className="font-heading text-2xl font-semibold tracking-tight tabular-nums">
                {formatCurrency(view.value)}
              </dd>
              <dd className="text-xs text-muted-foreground">{view.note}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function Breakdown({ cost }: { cost: OwnershipCost }) {
  const rows = [
    { label: "Running cost", value: cost.operating },
    { label: "Insurance & legal", value: cost.ownership },
    { label: "Loan interest & fees", value: cost.financingCharges },
    { label: "Accessories & upgrades", value: cost.capital },
    ...(cost.depreciation
      ? [{ label: "Depreciation (estimate)", value: cost.depreciation.amount }]
      : []),
  ];
  // Bar lengths only; every printed figure is the API's.
  const total = Math.max(Number(cost.economic), 1);
  return (
    <Card className="lg:col-span-7">
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Where the economic cost goes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-4">
          {rows.map((row) => (
            <li key={row.label} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span>{row.label}</span>
                <span className="font-medium tabular-nums">{formatCurrency(row.value)}</span>
              </div>
              <Progress
                value={(Math.max(Number(row.value), 0) / total) * 100}
                aria-label={`${row.label}: ${formatCurrency(row.value)}`}
                className="h-1.5"
              />
            </li>
          ))}
        </ul>
        <p className="mt-4 flex items-baseline justify-between border-t pt-3 text-sm font-medium tabular-nums">
          <span>Economic ownership cost</span>
          <span>{formatCurrency(cost.economic)}</span>
        </p>
      </CardContent>
    </Card>
  );
}

function Rates({ cost }: { cost: OwnershipCost }) {
  return (
    <Card>
      <CardContent>
        <dl className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 rounded-lg border bg-elevated p-3">
            <dt className="text-xs text-muted-foreground">Per km</dt>
            <dd className="font-heading text-xl font-semibold tabular-nums">
              {cost.economicPerKm ? formatCurrency(cost.economicPerKm) : "—"}
            </dd>
            <dd className="text-xs text-muted-foreground tabular-nums">
              {cost.distanceKm
                ? `Over ${formatDistance(cost.distanceKm)}`
                : "Needs two odometer readings"}
            </dd>
          </div>
          <div className="flex flex-col gap-1 rounded-lg border bg-elevated p-3">
            <dt className="text-xs text-muted-foreground">Per month</dt>
            <dd className="font-heading text-xl font-semibold tabular-nums">
              {formatCurrency(cost.perMonth)}
            </dd>
            <dd className="text-xs text-muted-foreground tabular-nums">
              Average over {formatNumber(cost.months, { minFractionDigits: 1 })} months
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function Depreciation({ cost, vehicleId }: { cost: OwnershipCost; vehicleId: string }) {
  const value = cost.depreciation;
  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-2">
        <CardTitle role="heading" aria-level={2}>
          Depreciation
        </CardTitle>
        <Badge variant="outline" className="text-muted-foreground">
          Estimate
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {value ? (
          <>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm tabular-nums">
              <dt className="text-muted-foreground">Bought for</dt>
              <dd className="text-right">{formatCurrency(value.purchasePrice)}</dd>
              <dt className="text-muted-foreground">On</dt>
              <dd className="text-right">{formatDate(value.purchaseDate)}</dd>
              <dt className="text-muted-foreground">Lost so far</dt>
              <dd className="text-right">
                {formatNumber(value.percent, { minFractionDigits: 1 })}% after {value.ageMonths}{" "}
                months
              </dd>
              <dt className="text-muted-foreground">Worth about</dt>
              <dd className="text-right font-heading text-base font-semibold">
                {formatCurrency(value.estimatedValue)}
              </dd>
            </dl>
            <p className="flex gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {value.beyondSchedule
                ? "The IRDAI schedule stops at 5 years; older vehicles are valued by agreement, so nothing more is estimated."
                : "On the IRDAI motor-insurance depreciation schedule, spread evenly within each step. Resale prices vary."}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Add the purchase price and date to the vehicle to estimate depreciation.{" "}
            <Link
              to={`/garage/${vehicleId}/edit`}
              className="font-medium text-primary hover:underline"
            >
              Edit vehicle
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
