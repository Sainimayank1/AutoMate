import { istToday, tripDays, tripLabel } from "@automate/shared";
import { ArrowLeft, Info, SearchX } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";

import { PageContainer } from "@/components/common/page-container";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFuelSummary } from "@/features/fuel/hooks/use-fuel";
import { vehicleName } from "@/features/garage/constants";
import { useVehicles } from "@/features/garage/hooks/use-vehicles";
import { ItineraryTimeline } from "@/features/trips/components/itinerary-timeline";
import { JourneyPoint } from "@/features/trips/components/journey-point";
import { LazyTripMap } from "@/features/trips/components/lazy-trip-map";
import { PlanBudget } from "@/features/trips/components/plan-budget";
import { PlanMenu } from "@/features/trips/components/plan-menu";
import { TripAttachments } from "@/features/trips/components/trip-attachments";
import type { MapPlace } from "@/features/trips/components/trip-map";
import { PLAN_STATUS } from "@/features/trips/constants";
import { useTripPlan } from "@/features/trips/hooks/use-trip-plans";
import { durationText, planTimingText } from "@/features/trips/utils/trip-text";
import { formatDate, formatDistance } from "@/utils/format";

/**
 * Stitch "Planned Trip Details — Desktop / Mobile": the plan's route on the map, its itinerary,
 * the budget estimate and notes; mark it done, edit, cancel or delete it.
 */
export function Component() {
  const { planId = "" } = useParams();
  const navigate = useNavigate();
  const { data: plan, isPending } = useTripPlan(planId);
  const vehicles = [...(useVehicles().data ?? []), ...(useVehicles({ archived: true }).data ?? [])];
  const fuel = useFuelSummary(plan?.vehicleId).data;

  if (isPending) {
    return (
      <PageContainer>
        <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading plan">
          <Skeleton className="h-16 w-80" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </PageContainer>
    );
  }
  if (!plan) {
    return (
      <PageContainer>
        <EmptyState
          className="rounded-xl border border-dashed"
          icon={SearchX}
          title="Plan not found"
          description="It may have been deleted, or marked done (it's in your history then)."
          action={
            <Button variant="outline" asChild>
              <Link to="/trips/planner">Back to the planner</Link>
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const vehicle = vehicles.find((item) => item.id === plan.vehicleId);
  const status = PLAN_STATUS[plan.status as keyof typeof PLAN_STATUS];
  const today = istToday(new Date());
  const multiDay = tripDays(plan.date, plan.endDate) > 1;
  const pinned = [
    plan.originPoint && { label: plan.origin ?? "From", ...plan.originPoint },
    ...plan.stops.map(
      (stop) =>
        stop.latitude != null &&
        stop.longitude != null && {
          label: stop.label,
          latitude: stop.latitude,
          longitude: stop.longitude,
        },
    ),
    plan.destinationPoint && { label: plan.destination ?? "To", ...plan.destinationPoint },
  ].filter((place): place is MapPlace => !!place);
  const when = [
    formatDate(plan.date),
    plan.startTime,
    plan.endDate && `– ${formatDate(plan.endDate)}`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <PageContainer>
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <Link
            to="/trips/planner"
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Planner
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {tripLabel(plan)}
            </h1>
            <StatusBadge tone={status.tone} icon={status.icon} label={status.label} />
            <Badge variant="secondary">{plan.category.name}</Badge>
          </div>
          <p className="text-sm text-muted-foreground tabular-nums">
            {[when, vehicle && vehicleName(vehicle)].filter(Boolean).join(" · ")}
            {plan.status !== "CANCELLED" && (
              <Badge variant="outline" className="ml-2">
                {planTimingText(plan.date, plan.endDate, today)}
              </Badge>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <PlanMenu
            plan={plan}
            inline
            onDeleted={() => navigate("/trips/planner", { replace: true })}
          />
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-7">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Itinerary</CardTitle>
              {multiDay && plan.status !== "CANCELLED" && (
                <Button variant="link" size="sm" asChild className="h-auto p-0">
                  <Link to={`/trips/planner/${plan.id}/itinerary`}>Edit itinerary</Link>
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {pinned.length > 0 && <LazyTripMap places={pinned} geometry={plan.route?.geometry} />}
              {multiDay ? (
                <ItineraryTimeline trip={plan} />
              ) : (
                <ol className="relative flex flex-col gap-6 border-l pl-6">
                  <JourneyPoint
                    label={plan.origin ?? "Start not set"}
                    detail={[formatDate(plan.date), plan.startTime].filter(Boolean).join(" · ")}
                    tone="muted"
                  />
                  {plan.stops.map((stop, index) => (
                    <JourneyPoint
                      key={stop.id}
                      label={`${index + 1}. ${stop.label}`}
                      detail="Stop"
                      tone="muted"
                    />
                  ))}
                  <JourneyPoint
                    label={plan.destination ?? "End not set"}
                    detail={plan.endDate ? `Back ${formatDate(plan.endDate)}` : ""}
                    tone="primary"
                  />
                </ol>
              )}
              <p className="text-sm text-muted-foreground tabular-nums">
                {[
                  plan.plannedDistanceKm
                    ? `${formatDistance(plan.plannedDistanceKm)} planned`
                    : "Distance not planned",
                  plan.plannedDurationMinutes != null &&
                    `about ${durationText(plan.plannedDurationMinutes)}`,
                  plan.route && `Route by ${plan.route.provider}, no live traffic`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-col gap-6 lg:col-span-5">
          <Card>
            <CardHeader>
              <CardTitle>Budget estimate</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <PlanBudget plan={plan} fuelType={fuel?.fuelType} />
              <p className="flex gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                Estimates only. When you mark the trip done, enter what actually happened; tolls,
                fuel and other costs are added on the done trip.
              </p>
            </CardContent>
          </Card>
          <TripAttachments tripId={plan.id} readOnly={plan.status === "CANCELLED"} />
          {plan.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-line">{plan.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
