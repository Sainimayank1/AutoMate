import { ReportingPeriod, SpendGroup } from "@automate/shared";
import type { ApiResponseSchemaHost } from "@nestjs/swagger";

import { VEHICLE_SCHEMA } from "@/modules/vehicles/vehicles.constants";

type Schema = ApiResponseSchemaHost["schema"];

const day = (example: string): Schema => ({ type: "string", format: "date", example });

const decimal = (example: string): Schema => ({ type: "string", nullable: true, example });

/** A `MetricFigure` plus its own fields. */
const figure = (extra: Record<string, Schema> = {}): Schema => ({
  type: "object",
  properties: {
    value: decimal("11840.00"),
    previous: decimal("12590.00"),
    change: decimal("-750.00"),
    changePercent: { type: "integer", nullable: true, example: -6 },
    ...extra,
  },
});

/** `DashboardSection<T>`: `data` only when `state` is "ok", `message` only when "error". */
const section = (data: Schema): Schema => ({
  type: "object",
  properties: {
    state: { type: "string", enum: ["ok", "empty", "error"] },
    data,
    message: { type: "string", example: "Couldn't load this period's figures." },
  },
});

const point: Schema = {
  type: "object",
  nullable: true,
  properties: {
    date: { type: "string", format: "date-time" },
    mileage: { type: "string", example: "17.20" },
  },
};

/** OpenAPI shape of `DashboardOverview` (@automate/shared). */
export const DASHBOARD_OVERVIEW_SCHEMA: Schema = {
  type: "object",
  properties: {
    vehicle: VEHICLE_SCHEMA,
    period: {
      type: "object",
      properties: {
        period: {
          type: "string",
          enum: Object.values(ReportingPeriod),
        },
        from: day("2026-11-01"),
        to: day("2026-11-27"),
        previous: {
          type: "object",
          properties: { from: day("2026-10-01"), to: day("2026-10-27") },
        },
        endsToday: { type: "boolean", example: true },
      },
    },
    status: section({
      type: "object",
      properties: {
        level: { type: "string", enum: ["attention", "incomplete", "no_issues"] },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", example: "insurance" },
              severity: { type: "string", enum: ["critical", "warning", "info"] },
              title: { type: "string", example: "Insurance expires in 24 days" },
              detail: {
                type: "string",
                nullable: true,
                example: "From your insurance payment of 18 Aug 2026",
              },
              href: { type: "string", nullable: true, example: "/expenses/transactions/…" },
            },
          },
        },
        untracked: { type: "array", items: { type: "string", enum: ["maintenance", "documents"] } },
      },
    }),
    metrics: section({
      type: "object",
      properties: {
        spent: figure({ records: { type: "integer", example: 9 } }),
        runningCostPerKm: figure(),
        mileage: figure({
          unit: { type: "string", enum: ["km/L", "km/kg", "km/kWh"] },
          cycles: { type: "integer", example: 2 },
        }),
        distance: figure({ readings: { type: "integer", example: 4 } }),
        fuelSpend: figure({
          quantity: { type: "string", example: "68.25" },
          unit: { type: "string", enum: ["L", "kg", "kWh"] },
        }),
      },
    }),
    spending: section({
      type: "object",
      properties: {
        total: decimal("11840.00"),
        categories: {
          type: "array",
          items: {
            type: "object",
            properties: {
              category: { type: "object", description: "ExpenseCategoryRef" },
              amount: decimal("7120.00"),
              percent: { type: "number", example: 60.1 },
            },
          },
        },
        months: {
          type: "array",
          items: {
            type: "object",
            properties: {
              month: { type: "string", example: "2026-11" },
              total: decimal("11840.00"),
              groups: {
                type: "object",
                properties: Object.fromEntries(
                  Object.values(SpendGroup).map((group) => [group, decimal("0.00")]),
                ),
              },
            },
          },
        },
      },
    }),
    fuel: section({
      type: "object",
      properties: {
        fuelType: { type: "string", example: "PETROL" },
        unit: { type: "string", enum: ["L", "kg", "kWh"] },
        mileageUnit: { type: "string", enum: ["km/L", "km/kg", "km/kWh"] },
        averageMileage: decimal("16.80"),
        cycles: { type: "integer", example: 2 },
        latestMileage: point,
        quantity: decimal("68.25"),
        spend: decimal("7120.00"),
        averagePrice: decimal("104.32"),
        costPerKm: decimal("6.10"),
        trend: { type: "array", items: point },
      },
    }),
    maintenance: section({
      type: "object",
      description: "From the Maintenance module (MaintenanceSchedule and ServiceRecord shapes).",
      properties: {
        state: { type: "string", example: "ATTENTION" },
        overdue: { type: "integer", example: 1 },
        dueSoon: { type: "integer", example: 2 },
        schedules: { type: "array", items: { type: "object" } },
        lastService: { type: "object", nullable: true },
      },
    }),
    expiries: section({
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", enum: ["insurance", "warranty"] },
          label: { type: "string", example: "Insurance" },
          state: { type: "string", enum: ["valid", "expiring", "expired", "not_added"] },
          summary: { type: "string", example: "Expires in 24 days" },
          detail: { type: "string", nullable: true },
          href: { type: "string", nullable: true },
        },
      },
    }),
    driving: section({
      type: "object",
      properties: {
        distanceKm: { type: "integer", nullable: true, example: 1092 },
        readings: { type: "integer", example: 4 },
        perDay: decimal("40.4"),
        lastReading: {
          type: "object",
          nullable: true,
          properties: {
            km: { type: "integer", example: 8412 },
            date: { type: "string", format: "date" },
          },
        },
      },
    }),
  },
};
