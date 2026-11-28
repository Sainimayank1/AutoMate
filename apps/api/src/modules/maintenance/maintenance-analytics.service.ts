import {
  type DateWindow,
  type MaintenanceAnalytics,
  type MaintenanceAnalyticsQuery,
  resolvePeriod,
} from "@automate/shared";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "@/database/prisma.service";
import { Prisma } from "@/generated/prisma/client";
import { ExpenseFiguresService } from "@/modules/expenses/expense-figures.service";
import { ExpensesService } from "@/modules/expenses/expenses.service";
import { VehiclesService } from "@/modules/vehicles/vehicles.service";

import { toDbDate } from "./maintenance.mapper";
import { buildAnalytics } from "./maintenance-analytics";
import { SPEND_CATEGORY_KEYS } from "./maintenance-spend";

const ZERO = new Prisma.Decimal(0);
const isoDate = (date: Date) => date.toISOString().slice(0, 10);

/** Gathers what the Analytics tab needs from each module's records (maintenance-analytics.ts). */
@Injectable()
export class MaintenanceAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicles: VehiclesService,
    private readonly expenses: ExpensesService,
    private readonly figures: ExpenseFiguresService,
  ) {}

  async analytics(
    userId: string,
    vehicleId: string,
    { period }: MaintenanceAnalyticsQuery,
  ): Promise<MaintenanceAnalytics> {
    await this.vehicles.findOwned(userId, vehicleId);
    const window = resolvePeriod(period, new Date());
    const between = { gte: toDbDate(window.from)!, lte: toDbDate(window.to)! };
    const [current, previous, categories, records, replaced, distanceKm, comparison] =
      await Promise.all([
        this.expenses.spendByMonth(userId, vehicleId, window, SPEND_CATEGORY_KEYS),
        this.expenses.spendByMonth(userId, vehicleId, window.previous, SPEND_CATEGORY_KEYS),
        this.expenses.spendBySubcategory(userId, vehicleId, window, SPEND_CATEGORY_KEYS),
        this.prisma.serviceRecord.findMany({
          where: { userId, vehicleId, serviceDate: between },
          select: { serviceDate: true, odometerKm: true, type: true },
        }),
        this.prisma.vehicleComponent.findMany({
          where: { userId, vehicleId, removedAt: between, replacedById: { not: null } },
          select: {
            name: true,
            removedAt: true,
            removedKm: true,
            installedKm: true,
            expectedLifeKm: true,
          },
        }),
        this.distance(userId, vehicleId, window),
        this.comparison(userId, window),
      ]);
    return buildAnalytics({
      window: { from: window.from, to: window.to },
      current,
      previous,
      categories,
      records: records.map((record) => ({
        date: isoDate(record.serviceDate),
        odometerKm: record.odometerKm,
        type: record.type,
      })),
      replacements: replaced.map((part) => ({
        name: part.name,
        replacedOn: isoDate(part.removedAt!),
        replacedKm: part.removedKm,
        installedKm: part.installedKm,
        expectedLifeKm: part.expectedLifeKm,
      })),
      distanceKm,
      comparison,
    });
  }

  private async distance(userId: string, vehicleId: string, window: DateWindow) {
    return (await this.figures.usage(userId, vehicleId, window, ZERO)).distanceKm;
  }

  /** Each active vehicle's spend, visits and cost per km over the same window. */
  private async comparison(
    userId: string,
    window: DateWindow,
  ): Promise<MaintenanceAnalytics["comparison"]> {
    const vehicles = await this.prisma.vehicle.findMany({
      where: { userId, archivedAt: null },
      orderBy: { createdAt: "asc" },
    });
    if (vehicles.length < 2) return [];
    const between = { gte: toDbDate(window.from)!, lte: toDbDate(window.to)! };
    return Promise.all(
      vehicles.map(async (vehicle) => {
        const [spend, services, distanceKm] = await Promise.all([
          this.expenses.spendByMonth(userId, vehicle.id, window, SPEND_CATEGORY_KEYS),
          this.prisma.serviceRecord.count({
            where: { userId, vehicleId: vehicle.id, serviceDate: between },
          }),
          this.distance(userId, vehicle.id, window),
        ]);
        const total = spend.reduce((sum, row) => sum.plus(row.total), ZERO);
        return {
          vehicleId: vehicle.id,
          name: [vehicle.make, vehicle.model, vehicle.variant].filter(Boolean).join(" "),
          registrationNumber: vehicle.registrationNumber,
          spend: total.toFixed(2),
          services,
          costPerKm: distanceKm ? total.div(distanceKm).toFixed(2) : null,
        };
      }),
    );
  }
}
