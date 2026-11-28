import {
  type AnalyticsOverview,
  type AnalyticsQuery,
  type AnalyticsVehicle,
  type ExpenseCategoryRef,
  FUEL_UNIT,
  SpendGroup,
  spendGroupOf,
} from "@automate/shared";
import { Injectable } from "@nestjs/common";

import { Prisma } from "@/generated/prisma/client";
import { spendingOverview, trendMonths } from "@/modules/dashboard/spending";
import { ExpenseFiguresService } from "@/modules/expenses/expense-figures.service";
import { OwnershipService } from "@/modules/expenses/ownership.service";
import { FuelService } from "@/modules/fuel/fuel.service";
import { VehiclesService } from "@/modules/vehicles/vehicles.service";

import { fleetTotals } from "./fleet";

type Row = { month: string | null; category: ExpenseCategoryRef; total: Prisma.Decimal };

/** Rows of several vehicles as one: summed per category (and month). */
function merge(rows: Row[]): Row[] {
  const merged = new Map<string, Row>();
  for (const row of rows) {
    const key = `${row.month ?? ""}|${row.category.id}`;
    const entry = merged.get(key);
    merged.set(key, entry ? { ...entry, total: entry.total.plus(row.total) } : { ...row });
  }
  return [...merged.values()];
}

/**
 * Analytics & total cost of ownership (M8, docs/architecture/analytics.md): every active vehicle's
 * ownership figures (Expenses), mileage (Fuel) and service spend side by side, and the fleet's
 * totals and spending. Nothing here computes money of its own beyond adding vehicles up.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly vehicles: VehiclesService,
    private readonly ownership: OwnershipService,
    private readonly figures: ExpenseFiguresService,
    private readonly fuel: FuelService,
  ) {}

  async overview(userId: string, { period }: AnalyticsQuery): Promise<AnalyticsOverview> {
    // shortcut: up to 100 active vehicles in one pass; page through them if a garage gets bigger.
    const garage = await this.vehicles.list(userId, { archived: false, page: 1, pageSize: 100 });
    const costs = await Promise.all(
      garage.items.map((vehicle) => this.ownership.cost(userId, { vehicleId: vehicle.id, period })),
    );
    const window = costs.length
      ? {
          from: costs.map((cost) => cost.window.from).sort()[0]!,
          to: costs[0]!.window.to,
        }
      : { from: new Date().toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) };
    const months = trendMonths(window);
    const monthsWindow = { from: `${months[0]}-01`, to: window.to };

    const perVehicle = await Promise.all(
      garage.items.map(async (vehicle, index) => {
        const ownership = costs[index]!;
        const [[fuel], inPeriod, monthly] = await Promise.all([
          this.fuel.inWindows(userId, vehicle.id, [ownership.window]),
          this.figures.byCategory(userId, vehicle.id, ownership.window, false),
          this.figures.byCategory(userId, vehicle.id, monthsWindow, true),
        ]);
        const service = inPeriod
          .filter((row) => spendGroupOf(row.category.key) === SpendGroup.MAINTENANCE)
          .reduce((sum, row) => sum.plus(row.total), new Prisma.Decimal(0));
        const row: AnalyticsVehicle = {
          vehicleId: vehicle.id,
          name: [vehicle.make, vehicle.model, vehicle.variant].filter(Boolean).join(" "),
          registrationNumber: vehicle.registrationNumber,
          fuelType: vehicle.fuelType,
          odometerKm: vehicle.odometerKm,
          ownership,
          mileage: fuel?.mileage
            ? {
                value: fuel.mileage.toFixed(2),
                unit: `km/${FUEL_UNIT[fuel.fuelType]}`,
                cycles: fuel.cycles,
              }
            : null,
          serviceSpend: service.toFixed(2),
        };
        return { row, inPeriod, monthly };
      }),
    );

    const vehicles = perVehicle.map((item) => item.row);
    return {
      period,
      window,
      totals: fleetTotals(vehicles, window),
      spending: spendingOverview(
        merge(perVehicle.flatMap((item) => item.inPeriod)),
        merge(perVehicle.flatMap((item) => item.monthly)),
        months,
      ),
      vehicles,
    };
  }
}
