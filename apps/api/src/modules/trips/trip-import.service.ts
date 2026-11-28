import { randomUUID } from "node:crypto";

import {
  createTripSchema,
  type CreateTripValues,
  IMPORT_MAX_ROWS,
  IMPORT_PREVIEW_ROWS,
  type ImportRowStatus,
  parseCsv,
  tripDistance,
  type TripImportPreview,
  type TripImportResult,
  type TripImportRow,
  type TripImportValues,
  tripLabel,
  TripMethod,
} from "@automate/shared";
import { BadRequestException, HttpException, Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "@/database/prisma.service";
import { VehiclesService } from "@/modules/vehicles/vehicles.service";

import { toDbDate } from "./trip.mapper";
import { mapRows, parseDate, parseKm, parseTime } from "./trip-import";
import { assertActive, columns, TripsService } from "./trips.service";

type Evaluated = { row: TripImportRow; input?: CreateTripValues };
const csvError = (message: string) =>
  new BadRequestException({ message, details: [{ field: "csv", message }] });
/** Thrown to roll a preview's trial save back. */
class Rollback extends Error {}
const messageOf = (error: HttpException) => {
  const body = error.getResponse() as { message?: string; details?: { message?: string }[] };
  return body.details?.[0]?.message ?? body.message ?? error.message;
};
const tenths = (km: string) => Math.round(Number(km) * 10);

/**
 * Trips CSV import (trips.md §1 "Import and export"). Every row is read through the user's column
 * mapping and checked like a trip logged by hand; rows like trips already recorded (same date and
 * distance) wait for the user's say-so. The preview runs the real save in a transaction that is
 * rolled back, so odometer readings are checked against the history and each other; the import
 * runs it again for real, in one transaction, oldest first.
 */
@Injectable()
export class TripImportService {
  private readonly logger = new Logger(TripImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicles: VehiclesService,
    private readonly trips: TripsService,
  ) {}

  async preview(userId: string, values: TripImportValues): Promise<TripImportPreview> {
    const evaluated = await this.evaluate(userId, values);
    await this.save(userId, values, evaluated, false);
    const counts: Record<ImportRowStatus, number> = {
      ready: 0,
      duplicate: 0,
      skipped: 0,
      error: 0,
    };
    for (const { row } of evaluated) counts[row.status]++;
    const problems = evaluated.filter(({ row }) => row.status !== "ready");
    const ready = evaluated.filter(({ row }) => row.status === "ready");
    return {
      counts,
      rows: [...problems.slice(0, IMPORT_PREVIEW_ROWS), ...ready.slice(0, 5)].map(({ row }) => row),
    };
  }

  async commit(userId: string, values: TripImportValues): Promise<TripImportResult> {
    const evaluated = await this.evaluate(userId, values);
    const { saved, failed } = await this.save(userId, values, evaluated, true);
    this.logger.log(`Imported ${saved} trips into vehicle ${values.vehicleId}`);
    return { imported: saved, notImported: evaluated.length - saved, failed };
  }

  /** The chosen rows saved oldest first in one transaction; refused rows become errors. */
  private async save(
    userId: string,
    { vehicleId, includeDuplicates }: TripImportValues,
    evaluated: Evaluated[],
    persist: boolean,
  ) {
    const chosen = evaluated
      .filter(
        ({ row }) => row.status === "ready" || (includeDuplicates && row.status === "duplicate"),
      )
      .sort(
        (a, b) =>
          a.input!.date.localeCompare(b.input!.date) ||
          (a.input!.startKm ?? 0) - (b.input!.startKm ?? 0),
      );
    const failed: TripImportResult["failed"] = [];
    let saved = 0;
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const vehicle = await this.vehicles.lockOwned(userId, vehicleId, tx);
          assertActive(vehicle);
          for (const item of chosen) {
            const input = item.input!;
            const id = randomUUID();
            try {
              await this.trips.assertReadings(tx, vehicle, id, input);
            } catch (error) {
              if (!(error instanceof HttpException)) throw error;
              item.row.status = "error";
              item.row.message = messageOf(error);
              failed.push({ line: item.row.line, message: item.row.message });
              continue;
            }
            await tx.trip.create({ data: { ...columns(input, null), id, userId, vehicleId } });
            if (input.endKm != null) await this.vehicles.raiseOdometer(vehicleId, input.endKm, tx);
            saved += 1;
          }
          if (!persist) throw new Rollback();
        },
        // Up to IMPORT_MAX_ROWS checked writes.
        { timeout: 60_000 },
      );
    } catch (error) {
      if (!(error instanceof Rollback)) throw error;
    }
    return { saved, failed };
  }

  private async evaluate(
    userId: string,
    { vehicleId, csv, columns: mapping }: TripImportValues,
  ): Promise<Evaluated[]> {
    assertActive(await this.vehicles.findOwned(userId, vehicleId));
    if (!mapping.date || !(mapping.distanceKm || (mapping.startKm && mapping.endKm))) {
      throw csvError("Match the date column, and the distance or both odometer columns.");
    }
    const rows = mapRows(parseCsv(csv), mapping);
    if (!Array.isArray(rows)) {
      throw csvError(
        `The file has no column called ${rows.unknown.map((name) => `"${name}"`).join(", ")}.`,
      );
    }
    if (!rows.length) throw csvError("The file has no rows under its header.");
    if (rows.length > IMPORT_MAX_ROWS) {
      throw csvError(
        `Import up to ${IMPORT_MAX_ROWS} rows at a time; this file has ${rows.length}.`,
      );
    }

    const types = await this.prisma.tripCategory.findMany({
      where: { OR: [{ userId: null }, { userId }] },
      select: { id: true, key: true, name: true },
    });
    const other = types.find((type) => type.key === "OTHER")!;
    const dates = rows.map((row) => parseDate(row.date)).filter((date): date is string => !!date);
    const recorded = dates.length
      ? await this.prisma.trip.findMany({
          where: {
            userId,
            vehicleId,
            status: "COMPLETED",
            date: {
              gte: toDbDate(dates.reduce((a, b) => (a < b ? a : b)))!,
              lte: toDbDate(dates.reduce((a, b) => (a > b ? a : b)))!,
            },
          },
          select: { date: true, distanceKm: true },
        })
      : [];
    const existing = new Set(
      recorded.map(
        (trip) => `${trip.date.toISOString().slice(0, 10)}|${tenths(trip.distanceKm!.toFixed(1))}`,
      ),
    );
    const seen = new Map<string, number>();

    return rows.map((raw) => {
      const type = raw.type
        ? types.find((item) => item.name.toLowerCase() === raw.type.toLowerCase())
        : other;
      const label = tripLabel({
        title: raw.title || null,
        origin: raw.origin || null,
        destination: raw.destination || null,
        category: { name: type?.name ?? "Other" },
      });
      const row: TripImportRow = {
        line: raw.line,
        date: parseDate(raw.date),
        label,
        distanceKm: null,
        status: "ready",
        message: null,
      };
      const fail = (message: string): Evaluated => ({
        row: { ...row, status: "error", message },
      });
      if (!row.date) return fail("Enter the date as DD/MM/YYYY or YYYY-MM-DD");
      const endDate = raw.endDate ? parseDate(raw.endDate) : null;
      if (raw.endDate && !endDate) return fail("Enter the end date as DD/MM/YYYY or YYYY-MM-DD");
      if (!type)
        return fail(
          `No trip type called "${raw.type}". Add it in Trip types, or leave it empty for Other.`,
        );
      const startKm = raw.startKm ? parseKm(raw.startKm) : null;
      const endKm = raw.endKm ? parseKm(raw.endKm) : null;
      const distance = raw.distanceKm ? parseKm(raw.distanceKm) : null;
      if ((raw.startKm && !startKm) || (raw.endKm && !endKm)) {
        return fail("Enter odometer readings as whole km, e.g. 8,732");
      }
      if (raw.distanceKm && !distance) return fail("Enter the distance in km, e.g. 268.5");
      const odometer = startKm !== null && endKm !== null;
      const parsed = createTripSchema.safeParse({
        vehicleId,
        method: odometer ? TripMethod.ODOMETER : TripMethod.DISTANCE,
        categoryId: type.id,
        title: raw.title || null,
        date: row.date,
        endDate,
        startTime: raw.startTime ? parseTime(raw.startTime) : null,
        endTime: raw.endTime ? parseTime(raw.endTime) : null,
        startKm: odometer ? Number(startKm) : null,
        endKm: odometer ? Number(endKm) : null,
        distanceKm: odometer ? null : distance,
        origin: raw.origin || null,
        destination: raw.destination || null,
        notes: raw.notes || null,
      });
      if (!parsed.success) return fail(parsed.error.issues[0]!.message);
      const input = parsed.data;
      row.distanceKm = tripDistance(input);
      const key = `${input.date}|${tenths(row.distanceKm!)}`;
      const earlier = seen.get(key);
      if (existing.has(key) || earlier !== undefined) {
        row.status = "duplicate";
        row.message =
          earlier !== undefined
            ? `Same date and distance as line ${earlier}`
            : "Looks like a trip already recorded (same date and distance)";
      }
      if (earlier === undefined) seen.set(key, row.line);
      return { row, input };
    });
  }
}
