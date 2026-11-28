import { ThemePreference } from "@automate/shared";
import type { ApiResponseSchemaHost } from "@nestjs/swagger";

type Schema = ApiResponseSchemaHost["schema"];
const flag: Schema = { type: "boolean" };

export const PREFERENCES_SCHEMA: Schema = {
  type: "object",
  properties: {
    theme: { type: "string", enum: Object.values(ThemePreference) },
    defaultVehicleId: { type: "string", format: "uuid", nullable: true },
    notifications: {
      type: "object",
      properties: {
        enabled: flag,
        documents: flag,
        maintenance: flag,
        payments: flag,
        trips: flag,
        monthlySummary: flag,
      },
    },
    regional: {
      type: "object",
      description: "Fixed for India today",
      properties: {
        currency: { type: "string", example: "INR" },
        distanceUnit: { type: "string", example: "km" },
        dateFormat: { type: "string", example: "DD/MM/YYYY" },
        timeZone: { type: "string", example: "Asia/Kolkata" },
        language: { type: "string", example: "en-IN" },
      },
    },
  },
};

export const SESSION_SCHEMA: Schema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    device: { type: "string", example: "Chrome on Windows" },
    createdAt: { type: "string", format: "date-time" },
    lastUsedAt: { type: "string", format: "date-time" },
    persistent: flag,
    current: flag,
  },
};
