import { z } from "zod";

import type { ImportRowStatus } from "../expenses/import.schema.js";

/**
 * Trips CSV import (Trips phase 9, docs/architecture/trips.md §1 "Import and export"): any CSV,
 * its columns mapped to trip fields (guessed from the headers, changeable), into one vehicle.
 * Previewed first, then imported; every row is checked like a trip logged by hand.
 */
export const TRIP_IMPORT_FIELDS = [
  "date",
  "endDate",
  "startTime",
  "endTime",
  "type",
  "title",
  "origin",
  "destination",
  "startKm",
  "endKm",
  "distanceKm",
  "notes",
] as const;
export type TripImportField = (typeof TRIP_IMPORT_FIELDS)[number];

export const tripImportSchema = z.object({
  vehicleId: z.uuid("Choose a vehicle"),
  csv: z
    .string("Choose a CSV file")
    .min(1, "Choose a CSV file")
    // Inside the API's JSON body limit, as for expenses (about 500 rows).
    .max(80_000, "Use a file under 80 KB (about 500 rows)"),
  /** Trip field → the file's column header; unmapped fields stay empty. */
  columns: z.partialRecord(z.enum(TRIP_IMPORT_FIELDS), z.string().trim().min(1).max(120)),
  /** Import rows that look like trips already recorded too. */
  includeDuplicates: z.boolean().default(false),
});
export type TripImportValues = z.output<typeof tripImportSchema>;

export interface TripImportRow {
  /** The line in the file (the header is line 1). */
  line: number;
  date: string | null;
  label: string;
  distanceKm: string | null;
  status: ImportRowStatus;
  /** Why it isn't ready. */
  message: string | null;
}

export interface TripImportPreview {
  counts: Record<ImportRowStatus, number>;
  /** Every row that isn't ready (up to the preview limit), then the first ready ones. */
  rows: TripImportRow[];
}

export interface TripImportResult {
  imported: number;
  /** Duplicates left out and rows with errors. */
  notImported: number;
  /** Rows that passed the preview but were refused when saved (e.g. an odometer reading). */
  failed: { line: number; message: string }[];
}

const ALIASES: Record<TripImportField, string[]> = {
  date: ["date", "start date", "trip date", "departure date"],
  endDate: ["end date", "return date"],
  startTime: ["start time", "departure time"],
  endTime: ["end time", "arrival time"],
  type: ["type", "trip type", "category", "purpose"],
  title: ["title", "name", "trip", "trip name"],
  origin: ["from", "origin", "start location", "starting point"],
  destination: ["to", "destination", "end location"],
  startKm: [
    "start km",
    "starting odometer",
    "start odometer",
    "odometer start",
    "odometer (start)",
  ],
  endKm: ["end km", "ending odometer", "end odometer", "odometer end", "odometer (end)"],
  distanceKm: ["distance (km)", "distance", "distance km", "km"],
  notes: ["notes", "note", "comments", "description"],
};
const normal = (header: string) => header.trim().toLowerCase().replace(/\s+/g, " ");

/** The columns a file's headers most likely hold (the export's own headers always match). */
export function guessTripColumns(headers: string[]): Partial<Record<TripImportField, string>> {
  const columns: Partial<Record<TripImportField, string>> = {};
  for (const field of TRIP_IMPORT_FIELDS) {
    const header = headers.find((candidate) => ALIASES[field].includes(normal(candidate)));
    if (header) columns[field] = header;
  }
  return columns;
}
