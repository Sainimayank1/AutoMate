import {
  addDays,
  addMonths,
  istToday,
  ReportingPeriod,
  resolvePeriod,
  type SystemTripCategoryKey,
  type TripAnalytics,
  type TripAnalyticsQuery,
} from "@automate/shared";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "@/database/prisma.service";
import { Prisma } from "@/generated/prisma/client";
import { FuelService } from "@/modules/fuel/fuel.service";
import { VehiclesService } from "@/modules/vehicles/vehicles.service";

import { isoDate, toDbDate } from "./trip.mapper";
import { type AnalyticsTrip, computeTripAnalytics } from "./trip-analytics";

/**
 * The Analytics tab (trips.md §1 "Analytics"): the period against the one before, distance and
 * time patterns, actual costs with the fuel estimate apart, vehicles, destinations and insights.
 * Done trips only; the figures are computed in `trip-analytics.ts`.
 */
@Injectable()
export class TripAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicles: VehiclesService,
    private readonly fuel: FuelService,
  ) {}

  async analytics(
    userId: string,
    { vehicleId, ...query }: TripAnalyticsQuery,
  ): Promise<TripAnalytics> {
    if (vehicleId) await this.vehicles.findOwned(userId, vehicleId);
    const custom =
      query.period === ReportingPeriod.CUSTOM ? { from: query.from!, to: query.to! } : undefined;
    const period = resolvePeriod(query.period, new Date(), custom);
    const within = (window: { from: string; to: string }): Prisma.TripWhereInput => ({
      userId,
      status: "COMPLETED",
      ...(vehicleId && { vehicleId }),
      date: { gte: toDbDate(window.from)!, lte: toDbDate(window.to)! },
    });
    // shortcut: the period's trips are read whole (a person logs hundreds a year); move the
    // figures into SQL if a period ever holds tens of thousands.
    const [rows, previous, previousCost, lastMonthsKm] = await Promise.all([
      this.prisma.trip.findMany({
        where: within(period),
        select: {
          id: true,
          vehicleId: true,
          date: true,
          endDate: true,
          startTime: true,
          endTime: true,
          distanceKm: true,
          title: true,
          origin: true,
          destination: true,
          category: { select: { id: true, key: true, name: true } },
        },
      }),
      this.prisma.trip.aggregate({
        where: within(period.previous),
        _count: true,
        _sum: { distanceKm: true },
      }),
      this.costOf(within(period.previous)),
      this.lastMonthsKm(userId, vehicleId),
    ]);
    const costs = await this.costsByTrip(rows.map((row) => row.id));
    const trips: AnalyticsTrip[] = rows.map((row) => ({
      ...row,
      date: isoDate(row.date),
      endDate: row.endDate ? isoDate(row.endDate) : null,
      distanceKm: row.distanceKm!.toFixed(1),
      category: { ...row.category, key: row.category.key as SystemTripCategoryKey | null },
      cost: costs.get(row.id)?.toFixed(2) ?? null,
    }));
    // All time starts at the first trip, as on the overview.
    const first = trips.reduce((min, trip) => (trip.date < min ? trip.date : min), period.to);
    return computeTripAnalytics({
      period,
      shown: { from: first > period.from ? first : period.from, to: period.to },
      vehicleId: vehicleId ?? null,
      trips,
      previous: {
        trips: previous._count,
        distanceKm: (previous._sum.distanceKm ?? new Prisma.Decimal(0)).toFixed(1),
        actualCost: previousCost?.toFixed(2) ?? null,
      },
      fuelEstimate: await this.fuelEstimate(userId, trips),
      lastMonthsKm,
    });
  }

  /** Recorded costs plus linked fill-ups, per trip (only trips that have any). */
  private async costsByTrip(ids: string[]) {
    const [costs, fuel] = await Promise.all([
      this.prisma.tripCost.groupBy({
        by: ["tripId"],
        where: { tripId: { in: ids } },
        _sum: { amount: true },
      }),
      this.prisma.fuelEntry.groupBy({
        by: ["tripId"],
        where: { tripId: { in: ids } },
        _sum: { totalAmount: true },
      }),
    ]);
    const totals = new Map<string, Prisma.Decimal>();
    for (const row of costs) totals.set(row.tripId, row._sum.amount ?? new Prisma.Decimal(0));
    for (const row of fuel) {
      if (!row.tripId) continue;
      totals.set(
        row.tripId,
        (totals.get(row.tripId) ?? new Prisma.Decimal(0)).plus(row._sum.totalAmount ?? 0),
      );
    }
    return totals;
  }

  private async costOf(where: Prisma.TripWhereInput): Promise<Prisma.Decimal | null> {
    const [costs, fuel] = await Promise.all([
      this.prisma.tripCost.aggregate({ where: { trip: where }, _sum: { amount: true } }),
      this.prisma.fuelEntry.aggregate({ where: { trip: where }, _sum: { totalAmount: true } }),
    ]);
    if (!costs._sum.amount && !fuel._sum.totalAmount) return null;
    return (costs._sum.amount ?? new Prisma.Decimal(0)).plus(fuel._sum.totalAmount ?? 0);
  }

  /**
   * The period's distance at each vehicle's average mileage and fuel price (Fuel's figures).
   * Null when any vehicle with trips has no such figures: a partial estimate would mislead.
   */
  private async fuelEstimate(userId: string, trips: AnalyticsTrip[]): Promise<string | null> {
    if (!trips.length) return null;
    const distances = new Map<string, Prisma.Decimal>();
    for (const trip of trips) {
      distances.set(
        trip.vehicleId,
        (distances.get(trip.vehicleId) ?? new Prisma.Decimal(0)).plus(trip.distanceKm),
      );
    }
    let total = new Prisma.Decimal(0);
    for (const [vehicleId, distance] of distances) {
      const summary = await this.fuel.summary(userId, vehicleId);
      if (!summary.averageMileage || !summary.averagePrice || Number(summary.averageMileage) <= 0) {
        return null;
      }
      total = total.plus(distance.div(summary.averageMileage).mul(summary.averagePrice));
    }
    return total.toFixed(2);
  }

  /** km of the last 3 complete months (India time), oldest first; 0 for a month without trips. */
  private async lastMonthsKm(userId: string, vehicleId?: string): Promise<string[]> {
    const thisMonth = `${istToday(new Date()).slice(0, 7)}-01`;
    const months = [-3, -2, -1].map((offset) => addMonths(thisMonth, offset));
    const vehicleSql = vehicleId ? Prisma.sql`AND vehicle_id = ${vehicleId}::uuid` : Prisma.empty;
    const rows = await this.prisma.$queryRaw<{ month: Date; km: Prisma.Decimal }[]>`
      SELECT date_trunc('month', date)::date AS month, sum(distance_km) AS km
      FROM trips
      WHERE user_id = ${userId}::uuid ${vehicleSql} AND status = 'COMPLETED'
        AND date BETWEEN ${months[0]}::date AND ${addDays(thisMonth, -1)}::date
      GROUP BY 1`;
    return months.map(
      (month) => rows.find((row) => isoDate(row.month) === month)?.km.toFixed(1) ?? "0.0",
    );
  }
}
