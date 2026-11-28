import {
  CostClass,
  istToday,
  type OwnershipCost,
  type OwnershipQuery,
  ReportingPeriod,
  resolvePeriod,
} from "@automate/shared";
import { Injectable } from "@nestjs/common";

import { Prisma } from "@/generated/prisma/client";
import { VehiclesService } from "@/modules/vehicles/vehicles.service";

import {
  depreciationBetween,
  depreciationPercent,
  monthsBetween,
  SCHEDULE_MONTHS,
} from "./depreciation";
import { ExpenseFiguresService } from "./expense-figures.service";

const money = (value: Prisma.Decimal) => value.toFixed(2);

/**
 * Ownership cost (Expenses phase 6, docs/architecture/expenses.md §8): the three money views of a
 * vehicle over a period. Economic cost adds depreciation, an estimate on the purchase price; loan
 * principal is only ever cash outflow.
 */
@Injectable()
export class OwnershipService {
  constructor(
    private readonly vehicles: VehiclesService,
    private readonly figures: ExpenseFiguresService,
  ) {}

  async cost(userId: string, { vehicleId, period }: OwnershipQuery): Promise<OwnershipCost> {
    const vehicle = await this.vehicles.get(userId, vehicleId);
    const now = new Date();
    const today = istToday(now);
    const resolved = resolvePeriod(period, now);
    let from = resolved.from;
    if (period === ReportingPeriod.ALL_TIME) {
      from = vehicle.purchaseDate ?? (await this.figures.firstDate(userId, vehicleId)) ?? today;
    }
    const window = { from, to: resolved.to };

    const { cost, cash, principal } = await this.figures.byCostClass(userId, vehicleId, window);
    const usage = await this.figures.usage(userId, vehicleId, window, cost[CostClass.OPERATING]);

    let depreciation: OwnershipCost["depreciation"] = null;
    let lost = new Prisma.Decimal(0);
    if (vehicle.purchasePrice && vehicle.purchaseDate) {
      const price = new Prisma.Decimal(vehicle.purchasePrice);
      const age = monthsBetween(vehicle.purchaseDate, today);
      const percent = depreciationPercent(age);
      lost = depreciationBetween(price, vehicle.purchaseDate, window.from, window.to);
      depreciation = {
        amount: money(lost),
        purchasePrice: money(price),
        purchaseDate: vehicle.purchaseDate,
        ageMonths: Math.max(Math.floor(age), 0),
        percent: percent.toFixed(1),
        estimatedValue: money(price.minus(price.mul(percent).div(100))),
        beyondSchedule: age > SCHEDULE_MONTHS,
      };
    }

    const economic = cost[CostClass.OPERATING]
      .plus(cost[CostClass.OWNERSHIP])
      .plus(cost[CostClass.FINANCING])
      .plus(cost[CostClass.CAPITAL])
      .plus(lost);
    // At least a month, so a period that's just begun isn't divided by a sliver.
    const months = new Prisma.Decimal(
      Math.max(monthsBetween(window.from, window.to), 1),
    ).toDecimalPlaces(1);
    return {
      period,
      window,
      operating: money(cost[CostClass.OPERATING]),
      ownership: money(cost[CostClass.OWNERSHIP]),
      financingCharges: money(cost[CostClass.FINANCING]),
      capital: money(cost[CostClass.CAPITAL]),
      depreciation,
      economic: money(economic),
      cashOutflow: money(cash),
      principal: money(principal),
      distanceKm: usage.distanceKm,
      economicPerKm: usage.distanceKm ? money(economic.div(usage.distanceKm)) : null,
      months: months.toFixed(1),
      perMonth: money(economic.div(months)),
    };
  }
}
