import {
  MAINTENANCE_CATEGORY_KEYS,
  MaintenanceState,
  PaymentMethod,
  ScheduleBasis,
  SchedulePriority,
  ScheduleStatus,
  ServiceRecordType,
} from "@automate/shared";
import type { ApiResponseSchemaHost } from "@nestjs/swagger";

type Schema = ApiResponseSchemaHost["schema"];

const int = (example?: number): Schema => ({ type: "integer", nullable: true, example });
const date = (example?: string): Schema => ({
  type: "string",
  format: "date",
  nullable: true,
  example,
});
const status: Schema = { type: "string", enum: Object.values(ScheduleStatus) };
const basis: Schema = { type: "string", enum: Object.values(ScheduleBasis) };

/** OpenAPI shape of `MaintenanceSchedule` (@automate/shared). */
export const SCHEDULE_SCHEMA: Schema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    vehicleId: { type: "string", format: "uuid" },
    name: { type: "string", example: "Engine oil & filter" },
    categoryKey: { type: "string", enum: MAINTENANCE_CATEGORY_KEYS },
    intervalKm: int(10000),
    intervalMonths: int(12),
    dueDate: date(),
    dueKm: int(),
    lastDoneDate: date("2026-05-18"),
    lastDoneKm: int(5120),
    addedOdometerKm: { type: "integer", example: 8450 },
    remindersEnabled: { type: "boolean" },
    leadDays: int(),
    leadKm: int(),
    priority: { type: "string", enum: Object.values(SchedulePriority) },
    notes: { type: "string", nullable: true },
    pausedAt: { type: "string", format: "date-time", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    due: {
      type: "object",
      properties: {
        status,
        decidedBy: { type: "string", enum: ["DATE", "DISTANCE"], nullable: true },
        date: {
          type: "object",
          nullable: true,
          properties: {
            from: date("2026-05-18"),
            basis,
            nextDue: date("2027-05-18"),
            daysRemaining: { type: "integer", example: 172, description: "Negative: overdue" },
            status,
          },
        },
        distance: {
          type: "object",
          nullable: true,
          properties: {
            fromKm: int(5120),
            basis,
            nextDueKm: { type: "integer", example: 15120 },
            kmRemaining: { type: "integer", example: 6670, description: "Negative: overdue" },
            status,
          },
        },
      },
    },
  },
};

const money = (example: string): Schema => ({ type: "string", example });
const optionalMoney = (example?: string): Schema => ({ type: "string", nullable: true, example });

export const PROVIDER_SCHEMA: Schema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    name: { type: "string", example: "Maruti Arena Service, Gurugram" },
  },
};

export const RECORD_SUMMARY_SCHEMA: Schema = {
  type: "object",
  properties: { count: { type: "integer", example: 12 }, totalAmount: money("38450.00") },
};

/** OpenAPI shape of `ServiceRecord` (@automate/shared). */
export const SERVICE_RECORD_SCHEMA: Schema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    vehicleId: { type: "string", format: "uuid" },
    type: { type: "string", enum: Object.values(ServiceRecordType) },
    title: { type: "string", example: "2nd free periodic service" },
    categoryKey: { type: "string", enum: MAINTENANCE_CATEGORY_KEYS },
    serviceDate: { type: "string", format: "date", example: "2026-05-18" },
    odometerKm: int(5120),
    provider: { ...PROVIDER_SCHEMA, nullable: true },
    technician: { type: "string", nullable: true },
    description: { type: "string", nullable: true },
    labourAmount: optionalMoney("1200.00"),
    partsAmount: optionalMoney("4800.00"),
    otherAmount: optionalMoney(),
    taxAmount: optionalMoney("1350.00"),
    discountAmount: optionalMoney("500.00"),
    totalAmount: money("6850.00"),
    paymentMethod: { type: "string", enum: Object.values(PaymentMethod), nullable: true },
    warrantyUntil: date(),
    warrantyNotes: { type: "string", nullable: true },
    notes: { type: "string", nullable: true },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string", example: "Engine oil 0W-20" },
          partNumber: { type: "string", nullable: true },
          scheduleId: { type: "string", format: "uuid", nullable: true },
          scheduleName: { type: "string", nullable: true, example: "Engine oil & filter" },
        },
      },
    },
    expenseId: { type: "string", format: "uuid", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

/** OpenAPI shape of `MaintenanceOverview` (@automate/shared). */
export const OVERVIEW_SCHEMA: Schema = {
  type: "object",
  properties: {
    odometerKm: { type: "integer", example: 8450 },
    period: { type: "object", description: "PeriodWindow: from, to, previous, endsToday" },
    state: { type: "string", enum: Object.values(MaintenanceState) },
    counts: {
      type: "object",
      properties: Object.fromEntries(
        Object.values(ScheduleStatus).map((key) => [key, { type: "integer" }]),
      ),
    },
    overdue: { type: "array", items: SCHEDULE_SCHEMA },
    upcoming: { type: "array", items: SCHEDULE_SCHEMA },
    next: { ...SCHEDULE_SCHEMA, nullable: true },
    recordCount: { type: "integer", example: 3 },
    recent: { type: "array", items: SERVICE_RECORD_SCHEMA },
    spend: {
      type: "object",
      properties: {
        total: money("14250.00"),
        maintenance: money("13050.00"),
        repairs: money("1200.00"),
        previousTotal: money("6850.00"),
        months: {
          type: "array",
          items: {
            type: "object",
            properties: {
              month: { type: "string", example: "2026-05" },
              maintenance: money("6850.00"),
              repairs: money("0.00"),
            },
          },
        },
      },
    },
  },
};
