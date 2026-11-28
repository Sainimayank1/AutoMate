import { tripItinerary, type TripStop } from "@automate/shared";
import { Moon } from "lucide-react";

import { JourneyPoint } from "@/features/trips/components/journey-point";
import { durationText } from "@/features/trips/utils/trip-text";
import { formatDate } from "@/utils/format";

const weekday = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" });

/** A multi-day trip's journey, day by day: where each day starts, its stops and the night. */
export function ItineraryTimeline({
  trip,
}: {
  trip: {
    date: string;
    endDate: string | null;
    startTime: string | null;
    origin: string | null;
    destination: string | null;
    stops: TripStop[];
  };
}) {
  return (
    <ol className="flex flex-col gap-5" aria-label="Itinerary">
      {tripItinerary(trip).map((day) => (
        <li key={day.day} className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold tabular-nums">
            Day {day.day} · {weekday(day.date)}, {formatDate(day.date)}
          </h3>
          <ol className="relative flex flex-col gap-4 border-l pl-6">
            {day.from && (
              <JourneyPoint
                label={day.from}
                detail={day.day === 1 ? (trip.startTime ?? "Start") : "Morning"}
                tone="muted"
              />
            )}
            {day.stops.map((stop) => (
              <JourneyPoint
                key={stop.id}
                label={stop.label}
                detail={[
                  stop.stayMinutes !== null && `stayed ${durationText(stop.stayMinutes)}`,
                  stop.arrivalTime && `arrived ${stop.arrivalTime}`,
                  stop.notes,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                tone="muted"
              />
            ))}
            {day.to && <JourneyPoint label={day.to} detail="Arrives" tone="primary" />}
            {day.night && (
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Moon className="size-4" aria-hidden />
                Night at {day.night}
              </li>
            )}
          </ol>
        </li>
      ))}
    </ol>
  );
}
