import { tripDays, tripLabel } from "@automate/shared";
import { ArrowLeft, Copy, MoreVertical, Pencil, SearchX, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { PageContainer } from "@/components/common/page-container";
import { EmptyState } from "@/components/feedback/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { vehicleName } from "@/features/garage/constants";
import { useVehicles } from "@/features/garage/hooks/use-vehicles";
import { ItineraryTimeline } from "@/features/trips/components/itinerary-timeline";
import { JourneyPoint } from "@/features/trips/components/journey-point";
import { LazyTripMap } from "@/features/trips/components/lazy-trip-map";
import { PlannedVsActual } from "@/features/trips/components/planned-vs-actual";
import { RoadTripSummary } from "@/features/trips/components/road-trip-summary";
import { TripAttachments } from "@/features/trips/components/trip-attachments";
import type { MapPlace } from "@/features/trips/components/trip-map";
import { CostsCard, FuelCard, SpendingCard } from "@/features/trips/components/trip-money";
import { METHOD_LABELS } from "@/features/trips/constants";
import { useDeleteTrip, useTrip, useTripCosts } from "@/features/trips/hooks/use-trips";
import { durationText } from "@/features/trips/utils/trip-text";
import { formatDate, formatDateTime, formatDistance, formatNumber } from "@/utils/format";

/**
 * Stitch "Trip Details — Desktop / Mobile": distance (and how it was measured), duration, average
 * speed when both are known, the odometer range, the journey (map, from, stops, to), costs, fuel,
 * notes and details. The map draws a route only from the provider's route data; places chosen
 * from the search show as markers; nothing is invented.
 */
export function Component() {
  const { tripId = "" } = useParams();
  const navigate = useNavigate();
  const { data: trip, isPending } = useTrip(tripId);
  const vehicles = [...(useVehicles().data ?? []), ...(useVehicles({ archived: true }).data ?? [])];
  const remove = useDeleteTrip();
  const { data: costs } = useTripCosts(tripId);
  const [deleting, setDeleting] = useState(false);

  if (isPending) {
    return (
      <PageContainer>
        <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading trip">
          <Skeleton className="h-16 w-80" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </PageContainer>
    );
  }
  if (!trip) {
    return (
      <PageContainer>
        <EmptyState
          className="rounded-xl border border-dashed"
          icon={SearchX}
          title="Trip not found"
          description="It may have been deleted."
          action={
            <Button variant="outline" asChild>
              <Link to="/trips">Back to trips</Link>
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const vehicle = vehicles.find((item) => item.id === trip.vehicleId);
  // Only places chosen from the search have coordinates; the rest are just names.
  const pinned = [
    trip.originPoint && { label: trip.origin ?? "From", ...trip.originPoint },
    ...trip.stops.map(
      (stop) =>
        stop.latitude != null &&
        stop.longitude != null && {
          label: stop.label,
          latitude: stop.latitude,
          longitude: stop.longitude,
        },
    ),
    trip.destinationPoint && { label: trip.destination ?? "To", ...trip.destinationPoint },
  ].filter((place): place is MapPlace => !!place);
  // An archived vehicle's trips are read-only (the API refuses changes).
  const readOnly = !!vehicle?.archivedAt;
  const multiDay = tripDays(trip.date, trip.endDate) > 1;
  const speed =
    trip.durationMinutes && trip.durationMinutes > 0
      ? Math.round(Number(trip.distanceKm) / (trip.durationMinutes / 60))
      : null;
  const times = trip.startTime
    ? `${trip.startTime}${trip.endTime ? ` – ${trip.endTime}` : ""}`
    : null;
  const when = [formatDate(trip.date), trip.endDate && `to ${formatDate(trip.endDate)}`, times]
    .filter(Boolean)
    .join(" · ");
  return (
    <PageContainer>
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <Link
            to="/trips"
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Trips
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {tripLabel(trip)}
            </h1>
            <Badge variant="secondary">{trip.category.name}</Badge>
          </div>
          <p className="text-sm text-muted-foreground tabular-nums">
            {[vehicle && vehicleName(vehicle), when].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" asChild>
            <Link to={`/trips/${trip.id}/edit`}>
              <Pencil data-icon="inline-start" />
              Edit
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions">
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to={`/trips/new?duplicate=${trip.id}`}>
                  <Copy />
                  Duplicate
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Trip figures">
        <Stat
          label="Distance"
          caption={
            trip.method === "ODOMETER"
              ? "From odometer readings"
              : trip.method === "ROUTE"
                ? `From the route (${trip.route?.provider ?? "OpenStreetMap"})`
                : "Distance entered"
          }
        >
          {formatDistance(trip.distanceKm)}
        </Stat>
        <Stat label="Duration" caption={trip.durationMinutes === null ? "Not recorded" : undefined}>
          {trip.durationMinutes !== null ? durationText(trip.durationMinutes) : "—"}
        </Stat>
        <Stat
          label="Average speed"
          caption={speed === null ? "Needs start and end times" : undefined}
        >
          {speed !== null ? `${formatNumber(speed)} km/h` : "—"}
        </Stat>
        <Stat label="Odometer" caption={trip.startKm === null ? "No readings" : undefined}>
          {trip.startKm !== null && trip.endKm !== null
            ? `${formatNumber(trip.startKm)} → ${formatNumber(trip.endKm)}`
            : "—"}
        </Stat>
      </section>

      {trip.plan ? (
        <div className="grid items-start gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SpendingCard trip={trip} />
          </div>
          <div className="lg:col-span-7">
            <PlannedVsActual trip={trip} />
          </div>
        </div>
      ) : (
        <SpendingCard trip={trip} />
      )}
      {multiDay && <RoadTripSummary trip={trip} />}

      <div className="grid items-start gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Journey</CardTitle>
              {multiDay && !readOnly && (
                <Button variant="link" size="sm" asChild className="h-auto p-0">
                  <Link to={`/trips/${trip.id}/itinerary`}>Edit itinerary</Link>
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {pinned.length > 0 && <LazyTripMap places={pinned} geometry={trip.route?.geometry} />}
              {multiDay ? (
                <ItineraryTimeline trip={trip} />
              ) : (
                <ol className="relative flex flex-col gap-6 border-l pl-6">
                  <JourneyPoint
                    label={trip.origin ?? "Start not recorded"}
                    detail={[formatDate(trip.date), trip.startTime].filter(Boolean).join(" · ")}
                    tone="muted"
                  />
                  {trip.stops.map((stop, index) => (
                    <JourneyPoint
                      key={stop.id}
                      label={`${index + 1}. ${stop.label}`}
                      detail={[
                        stop.arrivalTime && `arrived ${stop.arrivalTime}`,
                        stop.departureTime && `left ${stop.departureTime}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      tone="muted"
                    />
                  ))}
                  <li className="-ml-6 pl-6 text-sm text-muted-foreground tabular-nums">
                    {formatDistance(trip.distanceKm)}
                    {trip.route && ` · ${durationText(trip.route.durationMinutes)} by road`}
                  </li>
                  <JourneyPoint
                    label={trip.destination ?? "End not recorded"}
                    detail={[formatDate(trip.endDate ?? trip.date), trip.endTime]
                      .filter(Boolean)
                      .join(" · ")}
                    tone="primary"
                  />
                </ol>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {trip.route
                    ? `Route by ${trip.route.provider}; no live traffic.`
                    : pinned.length
                      ? "Places only: no route is drawn without route data."
                      : "Choose places from the search to see them on a map."}
                </span>
                {trip.originPoint && trip.destinationPoint && (
                  <a
                    href={`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${trip.originPoint.latitude},${trip.originPoint.longitude};${trip.destinationPoint.latitude},${trip.destinationPoint.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary hover:underline"
                  >
                    Open in OpenStreetMap
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
          <CostsCard trip={trip} readOnly={readOnly} />
          <FuelCard trip={trip} readOnly={readOnly} />
          <TripAttachments tripId={trip.id} costs={costs ?? []} readOnly={readOnly} />
        </div>
        <div className="flex flex-col gap-6 lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-2.5 text-sm">
                <Row label="Vehicle">{vehicle ? vehicleName(vehicle) : "—"}</Row>
                <Row label="Trip type">{trip.category.name}</Row>
                <Row label="Measured">{METHOD_LABELS[trip.method]}</Row>
                <Row label="Added">{formatDateTime(trip.createdAt)}</Row>
              </dl>
            </CardContent>
          </Card>
          {trip.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-line">{trip.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete this trip (${formatDate(trip.date)}, ${formatDistance(trip.distanceKm)})?`}
        description="The vehicle's odometer stays at its highest remaining reading."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          await remove.mutateAsync(trip);
          navigate("/trips", { replace: true });
        }}
      />
    </PageContainer>
  );
}

function Stat({
  label,
  caption,
  children,
}: {
  label: string;
  caption?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-heading text-xl font-semibold tabular-nums">{children}</span>
      {caption && <span className="text-xs text-muted-foreground">{caption}</span>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{children}</dd>
    </div>
  );
}
