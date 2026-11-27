import { type Trip, tripLabel } from "@automate/shared";
import { Link } from "react-router";

import { Badge } from "@/components/ui/badge";
import { durationText } from "@/features/trips/utils/trip-text";
import { formatCurrency, formatDate, formatDistance } from "@/utils/format";

/** A trip in a list: route or title, date, type, distance (and its vehicle when mixed). */
export function TripRow({ trip, vehicle }: { trip: Trip; vehicle: string | null }) {
  return (
    <Link
      to={`/trips/${trip.id}`}
      className="flex items-start justify-between gap-3 py-3 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
    >
      <div className="min-w-0">
        <p className="truncate font-medium">{tripLabel(trip)}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground tabular-nums">
          {formatDate(trip.date)}
          <Badge variant="secondary">{trip.category.name}</Badge>
          {vehicle}
        </p>
      </div>
      <div className="shrink-0 text-right text-sm tabular-nums">
        <p className="font-medium">{formatDistance(trip.distanceKm)}</p>
        {trip.actualCost && (
          <p className="text-muted-foreground">{formatCurrency(trip.actualCost)}</p>
        )}
        <p className="text-muted-foreground">
          {trip.method === "DISTANCE"
            ? "Distance entered"
            : trip.durationMinutes !== null
              ? durationText(trip.durationMinutes)
              : null}
        </p>
      </div>
    </Link>
  );
}
