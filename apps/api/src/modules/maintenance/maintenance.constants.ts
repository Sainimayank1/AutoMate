import {
  COMPONENT_KIND_KEYS,
  ComponentCondition,
  ComponentState,
  ComponentStatus,
  INSPECTION_AREA_KEYS,
  INSPECTION_TEMPLATE_KEYS,
  InspectionCondition,
  InspectionKind,
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
    estimatedCost: {
      type: "string",
      nullable: true,
      example: "24000.00",
      description: "An estimate, never spend",
    },
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

export const PROVIDER_PROFILE_SCHEMA: Schema = {
  type: "object",
  properties: {
    ...PROVIDER_SCHEMA.properties,
    type: {
      type: "string",
      enum: [
        "AUTHORISED",
        "INDEPENDENT",
        "TYRES",
        "BATTERY",
        "BODY_SHOP",
        "DETAILING",
        "ROADSIDE",
        "OTHER",
      ],
    },
    phone: { type: "string", nullable: true, example: "+91 98100 12345" },
    email: { type: "string", nullable: true },
    address: { type: "string", nullable: true },
    city: { type: "string", nullable: true, example: "Gurugram" },
    preferred: { type: "boolean" },
    notes: { type: "string", nullable: true },
    archivedAt: { type: "string", format: "date-time", nullable: true },
    stats: {
      type: "object",
      properties: {
        visits: { type: "integer", example: 3 },
        firstVisit: { type: "string", format: "date", nullable: true },
        lastVisit: { type: "string", format: "date", nullable: true },
        spent: {
          type: "string",
          example: "14250.00",
          description: "Net of refunds, from Expenses",
        },
      },
    },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
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

/** OpenAPI shape of `VehicleComponent` (@automate/shared); details add `history`. */
export const COMPONENT_SCHEMA: Schema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    vehicleId: { type: "string", format: "uuid" },
    kind: { type: "string", enum: COMPONENT_KIND_KEYS },
    name: { type: "string", example: "12V battery" },
    position: { type: "string", nullable: true },
    brand: { type: "string", nullable: true, example: "Amaron Pro" },
    partNumber: { type: "string", nullable: true, example: "38B20L" },
    installedAt: date("2025-02-14"),
    installedKm: int(1020),
    provider: { ...PROVIDER_SCHEMA, nullable: true },
    expectedLifeKm: int(40000),
    expectedLifeMonths: int(48),
    warrantyUntil: date("2028-02-14"),
    warrantyKm: int(60000),
    warrantyActive: { type: "boolean", nullable: true },
    condition: { type: "string", enum: Object.values(ComponentCondition) },
    state: { type: "string", enum: Object.values(ComponentState) },
    status: { type: "string", enum: Object.values(ComponentStatus) },
    removedAt: date(),
    removedKm: int(),
    installRecordId: { type: "string", format: "uuid", nullable: true },
    replacedBy: { type: "object", nullable: true },
    replaces: { type: "object", nullable: true },
    life: {
      type: "object",
      nullable: true,
      description: "Estimated life from the lifespan set (an estimate, not a guarantee)",
      properties: {
        kmUsed: int(18400),
        kmRemaining: int(21600),
        estimatedKm: int(41020),
        monthsUsed: int(21),
        daysRemaining: int(810),
        estimatedDate: date("2029-02-14"),
        fractionUsed: { type: "number", example: 0.46 },
      },
    },
    schedules: { type: "array", items: { type: "object" } },
    notes: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    history: { type: "array", items: { type: "object" }, description: "Details only" },
  },
};

/** OpenAPI shape of `Inspection` (@automate/shared). */
export const INSPECTION_SCHEMA: Schema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    vehicleId: { type: "string", format: "uuid" },
    kind: { type: "string", enum: Object.values(InspectionKind) },
    templateKey: { type: "string", enum: INSPECTION_TEMPLATE_KEYS },
    title: { type: "string", example: "Monthly check" },
    date: date("2026-11-27"),
    odometerKm: int(8450),
    inspector: { type: "string", nullable: true },
    provider: { ...PROVIDER_SCHEMA, nullable: true },
    followUpDate: date("2026-12-15"),
    notes: { type: "string", nullable: true },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          area: { type: "string", enum: INSPECTION_AREA_KEYS },
          label: { type: "string", example: "Tyre pressure" },
          condition: { type: "string", enum: Object.values(InspectionCondition) },
          notes: { type: "string", nullable: true },
          recommendedAction: { type: "string", nullable: true },
          componentId: { type: "string", format: "uuid", nullable: true },
          componentName: { type: "string", nullable: true },
          followUpSchedule: { type: "object", nullable: true },
        },
      },
    },
    counts: {
      type: "object",
      properties: {
        issues: { type: "integer" },
        monitor: { type: "integer" },
        ok: { type: "integer" },
        notInspected: { type: "integer" },
      },
    },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

/** OpenAPI shape of `MaintenanceAnalytics` (@automate/shared). */
export const ANALYTICS_SCHEMA: Schema = {
  type: "object",
  properties: {
    period: {
      type: "object",
      properties: { from: date("2025-11-29"), to: date("2026-11-28") },
    },
    totals: {
      type: "object",
      properties: {
        spend: money("48650.00"),
        maintenance: money("30163.00"),
        repairs: money("18487.00"),
        services: { type: "integer", example: 6 },
        repairVisits: { type: "integer", example: 2 },
        averagePerService: optionalMoney("8108.33"),
        distanceKm: int(20020),
        costPerKm: optionalMoney("2.43"),
      },
    },
    months: {
      type: "array",
      items: {
        type: "object",
        properties: {
          month: { type: "string", example: "2026-11" },
          maintenance: money("6200.00"),
          repairs: money("1200.00"),
        },
      },
    },
    categories: {
      type: "array",
      description: "By Expenses subcategory, largest first",
      items: {
        type: "object",
        properties: {
          name: { type: "string", example: "Engine oil" },
          total: money("14600.00"),
          percent: { type: "integer", example: 30 },
        },
      },
    },
    frequency: {
      type: "object",
      properties: {
        averageDays: int(92),
        averageKm: int(3400),
        intervals: { type: "integer", example: 5 },
      },
    },
    replacements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", example: "Front brake pads" },
          replacedOn: date("2026-09-14"),
          replacedKm: int(18400),
          lifeKm: int(18400),
          expectedLifeKm: int(20000),
          percentOfLife: int(92),
        },
      },
    },
    comparison: {
      type: "array",
      description: "Every active vehicle over the same window; empty with one vehicle",
      items: {
        type: "object",
        properties: {
          vehicleId: { type: "string", format: "uuid" },
          name: { type: "string", example: "Maruti Suzuki Victoris LXI" },
          registrationNumber: { type: "string", example: "HR26EV4821" },
          spend: money("48650.00"),
          services: { type: "integer", example: 6 },
          costPerKm: optionalMoney("2.43"),
        },
      },
    },
    insights: {
      type: "array",
      description: "Rule-based observations from the figures (no AI)",
      items: { type: "string", example: "Repairs were 38% of maintenance spend." },
    },
  },
};

/** OpenAPI shape of `MaintenancePlanSummary` (@automate/shared). */
export const PLAN_SCHEMA: Schema = {
  type: "object",
  properties: {
    open: { type: "integer", example: 3, description: "One-time jobs not yet done, not paused" },
    estimatedTotal: money("38500.00"),
    withoutEstimate: { type: "integer", example: 1 },
  },
};
