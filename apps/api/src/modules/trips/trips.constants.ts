import type { ApiResponseSchemaHost } from "@nestjs/swagger";

type Schema = ApiResponseSchemaHost["schema"];

const category: Schema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    key: { type: "string", nullable: true, example: "COMMUTE" },
    name: { type: "string", example: "Commute" },
  },
};

export const TRIP_CATEGORY_SCHEMA: Schema = {
  type: "object",
  properties: {
    ...category.properties,
    archivedAt: { type: "string", format: "date-time", nullable: true },
  },
};

export const TRIP_SCHEMA: Schema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    vehicleId: { type: "string", format: "uuid" },
    method: { type: "string", enum: ["ODOMETER", "DISTANCE"] },
    category,
    title: { type: "string", nullable: true },
    date: { type: "string", format: "date" },
    endDate: { type: "string", format: "date", nullable: true },
    startTime: { type: "string", nullable: true, example: "06:10" },
    endTime: { type: "string", nullable: true, example: "10:22" },
    startKm: { type: "integer", nullable: true, example: 8732 },
    endKm: { type: "integer", nullable: true, example: 9000 },
    distanceKm: { type: "string", example: "268.0" },
    durationMinutes: { type: "integer", nullable: true, example: 252 },
    origin: { type: "string", nullable: true, example: "Gurugram" },
    destination: { type: "string", nullable: true, example: "Jaipur" },
    notes: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

export const TRIP_OVERVIEW_SCHEMA: Schema = {
  type: "object",
  description: "Trips in the period (by start date), aggregated in the database",
  properties: {
    period: { type: "object" },
    vehicleId: { type: "string", format: "uuid", nullable: true },
    trips: { type: "integer" },
    distanceKm: { type: "string" },
    averageKm: { type: "string", nullable: true },
    longest: { type: "object", nullable: true },
    drivingMinutes: { type: "integer", nullable: true },
    timedTrips: { type: "integer" },
    perWeek: { type: "string", nullable: true },
    byCategory: { type: "array", items: { type: "object" } },
    series: { type: "object" },
    recent: { type: "array", items: TRIP_SCHEMA },
  },
};
