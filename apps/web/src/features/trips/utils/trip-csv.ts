import type { Trip } from "@automate/shared";

import { METHOD_LABELS } from "@/features/trips/constants";

/** One CSV cell (RFC 4180), with text a spreadsheet would run as a formula made inert. */
const cell = (value: string | number | null | undefined) => {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * Trips as CSV, in the columns the import reads back (its column guess matches them). Dates
 * stay ISO; distance and cost are the API's figures.
 */
export function tripsToCsv(trips: Trip[], vehicleLabel: (id: string) => string): string {
  const header = [
    "Date",
    "End date",
    "Start time",
    "End time",
    "Vehicle",
    "Type",
    "Title",
    "From",
    "To",
    "Stops",
    "Method",
    "Start km",
    "End km",
    "Distance (km)",
    "Duration (min)",
    "Actual cost (INR)",
    "Notes",
  ];
  const rows = trips.map((trip) => [
    trip.date,
    trip.endDate,
    trip.startTime,
    trip.endTime,
    vehicleLabel(trip.vehicleId),
    trip.category.name,
    trip.title,
    trip.origin,
    trip.destination,
    trip.stops.map((stop) => stop.label).join(" → "),
    METHOD_LABELS[trip.method],
    trip.startKm,
    trip.endKm,
    trip.distanceKm,
    trip.durationMinutes,
    trip.actualCost,
    trip.notes,
  ]);
  return [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
}
