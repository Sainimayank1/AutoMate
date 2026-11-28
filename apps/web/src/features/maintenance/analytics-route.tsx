import {
  type MaintenanceAnalytics,
  type MaintenanceAnalyticsQuery,
  ReportingPeriod,
} from "@automate/shared";
import { BarChart3, Car, Lightbulb } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { StatCard } from "@/components/common/stat-card";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { vehicleName } from "@/features/garage/constants";
import { LogServiceButton } from "@/features/maintenance/components/add-schedule-button";
import { MaintenanceLayout } from "@/features/maintenance/components/maintenance-layout";
import { SpendChart } from "@/features/maintenance/components/spend-chart";
import { useMaintenanceAnalytics } from "@/features/maintenance/hooks/use-maintenance";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";
import {
  formatCurrency,
  formatDate,
  formatDateRange,
  formatDistance,
  formatNumber,
} from "@/utils/format";

type Period = MaintenanceAnalyticsQuery["period"];
const PERIODS: { value: Period; label: string }[] = [
  { value: ReportingPeriod.LAST_12_MONTHS, label: "Last 12 months" },
  { value: ReportingPeriod.THIS_YEAR, label: "This year" },
  { value: ReportingPeriod.ALL_TIME, label: "All time" },
];

/**
 * Stitch "Maintenance Analytics — Desktop / Mobile": spending from Expenses, visits and their
 * frequency, the category breakdown, parts replaced against their estimated life, the vehicle
 * comparison (with more than one vehicle) and rule-based insights, all from
 * `/maintenance-analytics`. Deviations: the period picker sits in the header actions; insights
 * without a target the user never set (Stitch's "within your 100-day target").
 */
export function Component() {
  const garage = useActiveVehicle();
  const vehicle = garage.activeVehicle;
  const [period, setPeriod] = useState<Period>(ReportingPeriod.LAST_12_MONTHS);
  const analytics = useMaintenanceAnalytics(vehicle?.id, period);
  const data = analytics.data;

  if (!garage.isPending && !vehicle) {
    return (
      <MaintenanceLayout tab="analytics" description="Service schedules and history.">
        <EmptyState
          className="rounded-xl border border-dashed"
          icon={Car}
          title="Add a vehicle first"
          description="Maintenance is tracked per vehicle in your garage."
          action={
            <Button asChild>
              <Link to="/garage/new">Add vehicle</Link>
            </Button>
          }
        />
      </MaintenanceLayout>
    );
  }

  return (
    <MaintenanceLayout
      tab="analytics"
      description={vehicle && `${vehicleName(vehicle)} · Spending comes from Expenses`}
      actions={
        vehicle && (
          <>
            <Select value={period} onValueChange={(next) => setPeriod(next as Period)}>
              <SelectTrigger aria-label="Analytics period" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <LogServiceButton />
          </>
        )
      }
    >
      {analytics.isError && !data ? (
        <ErrorState
          title="Couldn't load maintenance analytics"
          error={analytics.error}
          onRetry={() => void analytics.refetch()}
        />
      ) : !data ? (
        <AnalyticsSkeleton />
      ) : data.totals.services === 0 && Number(data.totals.spend) === 0 ? (
        <EmptyState
          className="rounded-xl border border-dashed"
          icon={BarChart3}
          title="No maintenance spending yet"
          description={`Nothing logged ${PERIODS.find((option) => option.value === period)!.label.toLowerCase()}. Services and repairs you log show up here.`}
          action={<LogServiceButton />}
        />
      ) : (
        <Figures
          data={data}
          periodLabel={PERIODS.find((option) => option.value === period)!.label}
        />
      )}
    </MaintenanceLayout>
  );
}

function Figures({ data, periodLabel }: { data: MaintenanceAnalytics; periodLabel: string }) {
  const { totals } = data;
  const spend = Number(totals.spend);
  const share = (value: string) => (spend ? Math.round((Number(value) / spend) * 100) : 0);
  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Maintenance figures" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total maintenance spend"
          value={formatCurrency(totals.spend)}
          hint={`From Expenses · ${periodLabel}`}
          href="/expenses/transactions"
        />
        <StatCard
          label="Services"
          value={formatNumber(totals.services)}
          hint={`${formatNumber(totals.services - totals.repairVisits)} scheduled · ${formatNumber(totals.repairVisits)} ${totals.repairVisits === 1 ? "repair" : "repairs"}`}
        />
        <StatCard
          label="Average per service"
          value={totals.averagePerService ? formatCurrency(totals.averagePerService) : "—"}
          hint={`Across ${formatNumber(totals.services)} visits`}
        />
        <StatCard
          label="Cost per km"
          value={totals.costPerKm ? formatCurrency(totals.costPerKm) : "—"}
          hint={
            totals.distanceKm
              ? `Over ${formatDistance(totals.distanceKm)}`
              : "Needs two odometer readings"
          }
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle role="heading" aria-level={2}>
                Monthly spend
              </CardTitle>
              <CardDescription>Service vs repair · {formatDateRange(data.period)}</CardDescription>
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">
              Service {share(totals.maintenance)}% · Repair {share(totals.repairs)}%
            </p>
          </CardHeader>
          <CardContent>
            <SpendChart months={data.months} />
          </CardContent>
        </Card>
        <div className="flex flex-col gap-6 lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle role="heading" aria-level={2}>
                Service frequency
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {data.frequency.intervals ? (
                <>
                  <dl className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border bg-muted/40 p-3">
                      <dt className="text-xs text-muted-foreground">Avg. time</dt>
                      <dd className="font-heading text-xl font-semibold tabular-nums">
                        {formatNumber(data.frequency.averageDays ?? 0)} days
                      </dd>
                    </div>
                    <div className="rounded-lg border bg-muted/40 p-3">
                      <dt className="text-xs text-muted-foreground">Avg. distance</dt>
                      <dd className="font-heading text-xl font-semibold tabular-nums">
                        {data.frequency.averageKm !== null
                          ? formatDistance(data.frequency.averageKm)
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                  <p className="text-xs text-muted-foreground">
                    Between {formatNumber(data.frequency.intervals + 1)} service visits
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Log two services to see the time and distance between them.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle role="heading" aria-level={2}>
                Insights
              </CardTitle>
              <Badge variant="outline">Based on your records</Badge>
            </CardHeader>
            <CardContent>
              {data.insights.length ? (
                <ul className="flex flex-col gap-3">
                  {data.insights.map((insight) => (
                    <li key={insight} className="flex gap-2.5 text-sm">
                      <Lightbulb className="mt-0.5 size-4 shrink-0 text-insight" aria-hidden />
                      {insight}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Insights appear once there&apos;s enough history to compare.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>
              Category breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.categories.length ? (
              <ul className="flex flex-col gap-4">
                {data.categories.map((row) => (
                  <li key={row.name} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span>{row.name}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {formatCurrency(row.total)} · {row.percent}%
                      </span>
                    </div>
                    <Progress value={row.percent} aria-label={`${row.name}, ${row.percent}%`} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No spending in this period.</p>
            )}
          </CardContent>
        </Card>
        <div className="flex flex-col gap-6 lg:col-span-7">
          <Replacements rows={data.replacements} />
          {data.comparison.length > 0 && <Comparison rows={data.comparison} />}
        </div>
      </div>
    </div>
  );
}

function lifeText(row: MaintenanceAnalytics["replacements"][number]) {
  if (row.lifeKm === null) return "—";
  return row.expectedLifeKm
    ? `${formatNumber(row.lifeKm)} / ${formatDistance(row.expectedLifeKm)} (${row.percentOfLife}%)`
    : formatDistance(row.lifeKm);
}

function Replacements({ rows }: { rows: MaintenanceAnalytics["replacements"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Component replacements
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!rows.length ? (
          <p className="text-sm text-muted-foreground">
            No tracked parts were replaced in this period.
          </p>
        ) : (
          <>
            <Table className="hidden md:table">
              <TableHeader>
                <TableRow>
                  <TableHead>Part</TableHead>
                  <TableHead>Replaced on</TableHead>
                  <TableHead className="text-right">Km</TableHead>
                  <TableHead className="text-right">Life achieved vs est.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={`${row.name}-${row.replacedOn}`}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="tabular-nums">{formatDate(row.replacedOn)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.replacedKm !== null ? formatDistance(row.replacedKm) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{lifeText(row)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ul className="flex flex-col divide-y md:hidden">
              {rows.map((row) => (
                <li key={`${row.name}-${row.replacedOn}`} className="flex flex-col gap-0.5 py-2.5">
                  <span className="text-sm font-medium">{row.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatDate(row.replacedOn)}
                    {row.replacedKm !== null && ` · ${formatDistance(row.replacedKm)}`} · Life{" "}
                    {lifeText(row)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Comparison({ rows }: { rows: MaintenanceAnalytics["comparison"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Vehicle comparison
        </CardTitle>
        <CardDescription>Same period, every vehicle in your garage</CardDescription>
      </CardHeader>
      <CardContent>
        <Table className="hidden md:table">
          <TableHeader>
            <TableRow>
              <TableHead>Vehicle</TableHead>
              <TableHead className="text-right">Spend</TableHead>
              <TableHead className="text-right">Services</TableHead>
              <TableHead className="text-right">Cost per km</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.vehicleId}>
                <TableCell>
                  <span className="font-medium">{row.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {row.registrationNumber}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(row.spend)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(row.services)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.costPerKm ? formatCurrency(row.costPerKm) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <ul className="flex flex-col divide-y md:hidden">
          {rows.map((row) => (
            <li key={row.vehicleId} className="flex flex-col gap-0.5 py-2.5">
              <span className="text-sm font-medium">{row.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatCurrency(row.spend)} · {formatNumber(row.services)} services ·{" "}
                {row.costPerKm ? `${formatCurrency(row.costPerKm)}/km` : "no cost per km"}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-12">
        <Skeleton className="h-72 rounded-xl lg:col-span-8" />
        <Skeleton className="h-72 rounded-xl lg:col-span-4" />
      </div>
    </div>
  );
}
