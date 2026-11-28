import { z } from "zod";

import type { DateWindow } from "../common/periods.js";
import { ReportingPeriod } from "../common/periods.js";
import type { SpendingOverview } from "../dashboard/dashboard.schema.js";
import {
  OWNERSHIP_PERIODS,
  type OwnershipCost,
  type OwnershipPeriod,
} from "../expenses/ownership.schema.js";
import type { FuelType } from "../vehicles/vehicle.schema.js";

/**
 * Analytics & total cost of ownership (M8, docs/architecture/analytics.md): every vehicle's money
 * views side by side and the fleet's totals, for this month, this year or since purchase. Built
 * on the Expenses ownership figures; trips' own charts stay in Trips.
 */

export const analyticsQuerySchema = z.object({
  period: z.enum(OWNERSHIP_PERIODS).default(ReportingPeriod.THIS_YEAR),
});
export type AnalyticsQuery = z.output<typeof analyticsQuerySchema>;

export type MileageUnit = "km/L" | "km/kg" | "km/kWh";
export interface MileageFigure {
  value: string;
  unit: MileageUnit;
  /** Full-tank cycles it rests on. */
  cycles: number;
}

export interface AnalyticsVehicle {
  vehicleId: string;
  name: string;
  registrationNumber: string;
  fuelType: FuelType;
  odometerKm: number;
  ownership: OwnershipCost;
  /** Over the full-tank cycles that closed in the period; null with none. */
  mileage: MileageFigure | null;
  /** Maintenance and repairs in the period (net). */
  serviceSpend: string;
}

export interface AnalyticsOverview {
  period: OwnershipPeriod;
  /** The period across vehicles ("since purchase" from the earliest vehicle's start). */
  window: DateWindow;
  totals: {
    /** Everything spent, loan principal left out (economic cost without depreciation). */
    spent: string;
    /** With depreciation, an estimate. */
    economic: string;
    cashOutflow: string;
    principal: string;
    /** Summed over vehicles with a purchase price; null when none has one. */
    depreciation: string | null;
    estimatedValue: string | null;
    /** Km over vehicles with two readings in the period; null when none has. */
    distanceKm: number | null;
    /** Economic cost of the vehicles with km ÷ their km. */
    costPerKm: string | null;
    /** Average per calendar month of the period. */
    perMonth: string;
    /** Weighted by full-tank cycles, only when every vehicle with one uses the same unit. */
    mileage: MileageFigure | null;
  };
  /** The fleet's spending by category (shares) and its months in the five chart groups. */
  spending: SpendingOverview;
  vehicles: AnalyticsVehicle[];
}
