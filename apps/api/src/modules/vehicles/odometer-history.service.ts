import { Injectable } from "@nestjs/common";

import { Prisma } from "@/generated/prisma/client";

/** A reading and the day it was taken on. */
export type OdometerReading = { km: number; date: Date };

/** The record being checked, left out of the history (with its own linked expense). */
export type OdometerExcept =
  { serviceRecordId: string } | { tripId: string } | { expenseId: string } | null;

/**
 * The vehicle's one odometer history: Expenses' readings (fill-ups through their expenses),
 * service records (₹0 ones have no expense) and trips (start on its first day, end on its last).
 * Every module checks a new reading against it and corrects the vehicle down to its highest.
 */
@Injectable()
export class OdometerHistoryService {
  /** The highest reading on a day before `from` and the lowest on a day after `to`. */
  async around(
    db: Prisma.TransactionClient,
    vehicleId: string,
    window: { from: Date; to: Date },
    except: OdometerExcept,
  ): Promise<{ before: OdometerReading | null; after: OdometerReading | null }> {
    const readings = this.readings(vehicleId, except);
    const [before, after] = await Promise.all([
      db.$queryRaw<OdometerReading[]>`
        SELECT km, day AS date FROM (${readings}) r
        WHERE day < ${window.from}::date ORDER BY km DESC LIMIT 1`,
      db.$queryRaw<OdometerReading[]>`
        SELECT km, day AS date FROM (${readings}) r
        WHERE day > ${window.to}::date ORDER BY km ASC LIMIT 1`,
    ]);
    return { before: before[0] ?? null, after: after[0] ?? null };
  }

  /** The highest reading recorded anywhere for the vehicle (null when none). */
  async highest(db: Prisma.TransactionClient, vehicleId: string): Promise<number | null> {
    const [row] = await db.$queryRaw<{ km: number | null }[]>`
      SELECT max(km) AS km FROM (${this.readings(vehicleId, null)}) r`;
    return row?.km ?? null;
  }

  private readings(vehicleId: string, except: OdometerExcept) {
    const recordId = except && "serviceRecordId" in except ? except.serviceRecordId : null;
    const tripId = except && "tripId" in except ? except.tripId : null;
    const expenseId = except && "expenseId" in except ? except.expenseId : null;
    return Prisma.sql`
      SELECT odometer_km AS km, date AS day FROM expenses
        WHERE vehicle_id = ${vehicleId}::uuid AND odometer_km IS NOT NULL
          AND id IS DISTINCT FROM ${expenseId}::uuid
          AND NOT (source = 'MAINTENANCE' AND source_id IS NOT DISTINCT FROM ${recordId}::uuid)
      UNION ALL
      SELECT odometer_km, service_date FROM service_records
        WHERE vehicle_id = ${vehicleId}::uuid AND odometer_km IS NOT NULL
          AND id IS DISTINCT FROM ${recordId}::uuid
      UNION ALL
      SELECT start_km, date FROM trips
        WHERE vehicle_id = ${vehicleId}::uuid AND start_km IS NOT NULL
          AND id IS DISTINCT FROM ${tripId}::uuid
      UNION ALL
      SELECT end_km, coalesce(end_date, date) FROM trips
        WHERE vehicle_id = ${vehicleId}::uuid AND end_km IS NOT NULL
          AND id IS DISTINCT FROM ${tripId}::uuid`;
  }
}
