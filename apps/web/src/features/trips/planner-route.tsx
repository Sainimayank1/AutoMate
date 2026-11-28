import { istToday, tripLabel, type TripPlan } from "@automate/shared";
import { CalendarPlus, Info } from "lucide-react";
import { Link, useSearchParams } from "react-router";

import { Pager } from "@/components/common/pager";
import { Segmented } from "@/components/common/segmented";
import { StatusBadge } from "@/components/common/status-badge";
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
import { vehicleName } from "@/features/garage/constants";
import { useVehicles } from "@/features/garage/hooks/use-vehicles";
import { PlanMenu } from "@/features/trips/components/plan-menu";
import { TripsLayout } from "@/features/trips/components/trips-layout";
import { PLAN_STATUS } from "@/features/trips/constants";
import { useTripPlans } from "@/features/trips/hooks/use-trip-plans";
import { durationText, planTimingText } from "@/features/trips/utils/trip-text";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";
import { formatCurrency, formatDate, formatDistance } from "@/utils/format";

const ALL = "all";
const VIEWS = [
  { value: "upcoming" as const, label: "Upcoming" },
  { value: "cancelled" as const, label: "Cancelled" },
];

/**
 * Stitch "Trips — Planner — Desktop / Mobile": upcoming plans soonest first (or the cancelled
 * ones), each with its route, planned distance and budget estimate; the next one beside them.
 * Plans count nowhere until they're marked done.
 */
export function Component() {
  const garage = useActiveVehicle();
  const vehicles = useVehicles().data ?? [];
  const [params, setParams] = useSearchParams();
  const vehicleParam = params.get("vehicle");
  const vehicleId =
    vehicleParam === ALL ? undefined : (vehicleParam ?? garage.activeVehicle?.id ?? undefined);
  const view = params.get("view") === "cancelled" ? "cancelled" : "upcoming";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const plans = useTripPlans({ view, page, ...(vehicleId && { vehicleId }) });
  const today = istToday(new Date());

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

  const items = plans.data?.items;
  const next = view === "upcoming" && page === 1 ? items?.find((plan) => plan.date >= today) : null;
  return (
    <TripsLayout
      tab="planner"
      actions={
        <>
          <Button variant="outline" asChild>
            <Link to="/trips/new">Log trip</Link>
          </Button>
          <Button asChild>
            <Link to={`/trips/plan${vehicleId ? `?vehicle=${vehicleId}` : ""}`}>
              <CalendarPlus data-icon="inline-start" />
              Plan trip
            </Link>
          </Button>
        </>
      }
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
        <Segmented
          value={view}
          options={VIEWS}
          onChange={(value) => update({ view: value === "upcoming" ? null : value })}
          aria-label="Show"
        />
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-12">
        {next && (
          <Card className="lg:col-span-4 lg:col-start-9 lg:row-start-1">
            <CardHeader>
              <CardTitle>Next trip</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <Link
                to={`/trips/planner/${next.id}`}
                className="font-heading text-lg font-semibold hover:underline"
              >
                {tripLabel(next)}
              </Link>
              <p className="text-muted-foreground tabular-nums">
                {formatDate(next.date)} · {planTimingText(next.date, next.endDate, today)}
              </p>
              {next.budget.total && (
                <p className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Estimated budget</span>
                  <span className="font-medium tabular-nums">
                    {formatCurrency(next.budget.total)}
                  </span>
                </p>
              )}
            </CardContent>
          </Card>
        )}
        <div className="flex flex-col gap-3 lg:col-span-8 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          {plans.isError && !plans.data ? (
            <ErrorState
              title="Couldn't load your plans"
              error={plans.error}
              onRetry={() => void plans.refetch()}
            />
          ) : !items ? (
            <Skeleton className="h-48 rounded-xl" aria-label="Loading plans" />
          ) : items.length === 0 ? (
            <EmptyState
              className="rounded-xl border border-dashed"
              icon={CalendarPlus}
              title={view === "upcoming" ? "No trips planned" : "No cancelled plans"}
              description={
                view === "upcoming"
                  ? "Plan a trip to see its route, distance and budget before you go."
                  : "Plans you cancel stay here, and you can restore them."
              }
              action={
                view === "upcoming" && (
                  <Button asChild>
                    <Link to="/trips/plan">Plan trip</Link>
                  </Button>
                )
              }
            />
          ) : (
            <>
              <ul className="flex flex-col gap-3" aria-label="Plans">
                {items.map((plan) => (
                  <li key={plan.id}>
                    <PlanCard plan={plan} today={today} />
                  </li>
                ))}
              </ul>
              {plans.data!.meta.totalPages > 1 && (
                <Pager
                  page={page}
                  pageCount={plans.data!.meta.totalPages}
                  onPageChange={(value) => update({ page: String(value) })}
                />
              )}
            </>
          )}
        </div>

        <p className="flex gap-2 rounded-xl lg:col-span-4 lg:col-start-9 lg:row-start-2 border bg-card p-4 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Plans don&apos;t count in distance, costs or the odometer until you mark them done.
        </p>
      </div>
    </TripsLayout>
  );
}

function PlanCard({ plan, today }: { plan: TripPlan; today: string }) {
  const status = PLAN_STATUS[plan.status as keyof typeof PLAN_STATUS];
  const day = new Date(`${plan.date}T00:00:00`);
  const places = [plan.origin, ...plan.stops.map((stop) => stop.label), plan.destination].filter(
    Boolean,
  );
  const parts = [
    plan.budget.fuelCost && `Fuel ${formatCurrency(plan.budget.fuelCost)}`,
    plan.estToll && `Toll ${formatCurrency(plan.estToll)}`,
    plan.estAccommodation && `Stay ${formatCurrency(plan.estAccommodation)}`,
  ].filter(Boolean);
  return (
    <article className="flex gap-4 rounded-xl border bg-card p-4">
      <div
        className="flex w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-muted py-2 tabular-nums"
        aria-hidden
      >
        <span className="text-xs font-medium text-muted-foreground uppercase">
          {day.toLocaleDateString("en-IN", { month: "short" })}
        </span>
        <span className="font-heading text-xl font-semibold">{day.getDate()}</span>
        <span className="text-xs text-muted-foreground">
          {day.toLocaleDateString("en-IN", { weekday: "short" })}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Link
              to={`/trips/planner/${plan.id}`}
              className="truncate font-medium hover:underline focus-visible:underline focus-visible:outline-none"
            >
              {tripLabel(plan)}
            </Link>
            <StatusBadge tone={status.tone} icon={status.icon} label={status.label} />
            <Badge variant="secondary">{plan.category.name}</Badge>
          </div>
          <PlanMenu plan={plan} />
        </div>
        {places.length > 0 && (
          <p className="truncate text-sm text-muted-foreground">{places.join(" → ")}</p>
        )}
        <p className="text-sm text-muted-foreground tabular-nums">
          {formatDate(plan.date)}
          {plan.endDate && ` – ${formatDate(plan.endDate)}`}
          {plan.status !== "CANCELLED" && ` · ${planTimingText(plan.date, plan.endDate, today)}`}
          {plan.plannedDistanceKm && ` · ${formatDistance(plan.plannedDistanceKm)}`}
          {plan.plannedDurationMinutes != null &&
            ` · about ${durationText(plan.plannedDurationMinutes)}`}
        </p>
        <p className="text-sm">
          {plan.budget.total ? (
            <>
              <span className="font-medium tabular-nums">{formatCurrency(plan.budget.total)}</span>
              <span className="text-muted-foreground"> estimated</span>
              {parts.length > 0 && (
                <span className="text-muted-foreground tabular-nums"> · {parts.join(" · ")}</span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">No budget yet</span>
          )}
          {plan.estMileage && !plan.estFuelPrice && (
            <span className="text-warning"> · Fuel price not set</span>
          )}
        </p>
      </div>
    </article>
  );
}
