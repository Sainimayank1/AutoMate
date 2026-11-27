import type { Trip } from "@automate/shared";

/** "4h 12m", "45m", "26h 5m": driving time, never a day count. */
export function durationText(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? (rest ? `${hours}h ${rest}m` : `${hours}h`) : `${rest}m`;
}

/** The title when set, else "From → To", else whichever end is known, else the type. */
export function tripLabel(trip: Pick<Trip, "title" | "origin" | "destination" | "category">) {
  if (trip.title) return trip.title;
  if (trip.origin && trip.destination) return `${trip.origin} → ${trip.destination}`;
  return trip.destination ?? trip.origin ?? `${trip.category.name} trip`;
}
