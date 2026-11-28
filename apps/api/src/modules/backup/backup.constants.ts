import { BACKUP_FORMAT, BACKUP_SECTIONS } from "@automate/shared";
import type { ApiResponseSchemaHost } from "@nestjs/swagger";

type Schema = ApiResponseSchemaHost["schema"];
const rows: Schema = { type: "array", items: { type: "object" } };
const counts: Schema = {
  type: "object",
  properties: Object.fromEntries(BACKUP_SECTIONS.map((section) => [section, { type: "integer" }])),
};
const issues: Schema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      section: { type: "string", enum: [...BACKUP_SECTIONS, "vehicle"] },
      index: { type: "integer" },
      message: { type: "string", example: "Enter the odometer reading in km, e.g. 8450" },
    },
  },
};

/** OpenAPI shape of `Backup` (@automate/shared): rows are each module's create input. */
export const BACKUP_SCHEMA: Schema = {
  type: "object",
  properties: {
    format: { type: "string", enum: [BACKUP_FORMAT] },
    version: { type: "integer", example: 1 },
    exportedAt: { type: "string", format: "date-time" },
    vehicles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          vehicle: { type: "object" },
          fuel: rows,
          services: rows,
          expenses: rows,
          trips: rows,
          documents: rows,
        },
      },
    },
    documents: rows,
  },
};

/** OpenAPI shape of `BackupRestoreReport` (@automate/shared). */
export const BACKUP_REPORT_SCHEMA: Schema = {
  type: "object",
  properties: {
    exportedAt: { type: "string", format: "date-time" },
    vehicles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          name: { type: "string", example: "Maruti Suzuki Victoris LXI" },
          registrationNumber: { type: "string", example: "HR26EV4821" },
          status: { type: "string", enum: ["NEW", "RESTORED", "EXISTS", "INVALID", "FAILED"] },
          vehicleId: { type: "string", format: "uuid", nullable: true },
          counts,
          issues,
          issueCount: { type: "integer" },
        },
      },
    },
    documents: { type: "object", properties: { count: { type: "integer" }, issues } },
  },
};
