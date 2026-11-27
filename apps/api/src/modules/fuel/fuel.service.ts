import {
  type CreateFuelEntryValues,
  type FuelEntry,
  type FuelEntryListQuery,
  FUELS_FOR_VEHICLE,
  type FuelSummary,
  type FuelType,
  isFuelTotalPlausible,
  type UpdateFuelEntryValues,
} from "@automate/shared";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { Paginated } from "@/common/pagination/paginated";
import { PrismaService } from "@/database/prisma.service";
import type { Prisma, Vehicle as VehicleRow } from "@/generated/prisma/client";
import { VehiclesService } from "@/modules/vehicles/vehicles.service";

import { byHistoryOrder, computeMileage, summarize } from "./fuel.calculations";
import { toFuelEntry } from "./fuel.mapper";

const NOT_FOUND = "Fuel entry not found";

const km = new Intl.NumberFormat("en-IN");
const istDate = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/**
 * Owns `fuel_entries`. Every query is scoped by `userId` and `vehicleId`; the vehicle comes from
 * `VehiclesService`, which also receives new odometer readings. Writes run in one transaction
 * holding the vehicle's row lock, so the odometer order can't be broken by concurrent saves.
 * (Expenses, M4, plugs in here: create/update/delete the linked fuel expense in the same transaction.)
 */
@Injectable()
export class FuelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicles: VehiclesService,
  ) {}

  /**
   * Newest first, each with its place in the mileage sequence. Mileage needs the whole history,
   * so filters and the page apply after it is computed.
   */
  async list(
    userId: string,
    vehicleId: string,
    { tank, search, ...page }: FuelEntryListQuery,
  ): Promise<Paginated<FuelEntry>> {
    await this.vehicles.findOwned(userId, vehicleId);
    const needle = search?.toLowerCase();
    const matches = (await this.history(userId, vehicleId)).filter(
      (entry) =>
        (!tank || entry.isFullTank === (tank === "full")) &&
        (!needle ||
          [entry.stationName, entry.location, entry.notes, entry.fuelType].some((text) =>
            text?.toLowerCase().includes(needle),
          )),
    );
    return Paginated.of(matches, page);
  }

  async summary(userId: string, vehicleId: string): Promise<FuelSummary> {
    const vehicle = await this.vehicles.findOwned(userId, vehicleId);
    return summarize(await this.rows(userId, vehicleId), vehicle.fuelType);
  }

  async get(userId: string, vehicleId: string, id: string): Promise<FuelEntry> {
    const entry = (await this.history(userId, vehicleId)).find((item) => item.id === id);
    if (!entry) throw new NotFoundException(NOT_FOUND);
    return entry;
  }

  async create(
    userId: string,
    vehicleId: string,
    input: CreateFuelEntryValues,
  ): Promise<FuelEntry> {
    const id = await this.prisma.$transaction(async (tx) => {
      const vehicle = await this.vehicles.lockOwned(userId, vehicleId, tx);
      assertWritable(vehicle, input.fuelType);
      const filledAt = new Date(input.filledAt);
      await assertOdometerInOrder(tx, vehicleId, filledAt, input.odometerKm);
      const row = await tx.fuelEntry.create({ data: { ...input, filledAt, userId, vehicleId } });
      await this.vehicles.raiseOdometer(vehicleId, row.odometerKm, tx);
      return row.id;
    });
    return this.get(userId, vehicleId, id);
  }

  async update(
    userId: string,
    vehicleId: string,
    id: string,
    input: UpdateFuelEntryValues,
  ): Promise<FuelEntry> {
    await this.prisma.$transaction(async (tx) => {
      const vehicle = await this.vehicles.lockOwned(userId, vehicleId, tx);
      const current = await tx.fuelEntry.findFirst({ where: { id, userId, vehicleId } });
      if (!current) throw new NotFoundException(NOT_FOUND);
      // Only a changed fuel is checked: the vehicle's fuel type may have been edited since.
      assertWritable(
        vehicle,
        input.fuelType !== current.fuelType ? (input.fuelType ?? null) : null,
      );

      const filledAt = input.filledAt ? new Date(input.filledAt) : current.filledAt;
      const odometerKm = input.odometerKm ?? current.odometerKm;
      if (input.filledAt !== undefined || input.odometerKm !== undefined) {
        await assertOdometerInOrder(tx, vehicleId, filledAt, odometerKm, id);
      }
      const amounts = {
        quantity: input.quantity ?? current.quantity.toFixed(3),
        pricePerUnit: input.pricePerUnit ?? current.pricePerUnit.toFixed(3),
        totalAmount: input.totalAmount ?? current.totalAmount.toFixed(2),
      };
      if (!isFuelTotalPlausible(amounts.totalAmount, amounts.quantity, amounts.pricePerUnit)) {
        throw new BadRequestException({
          message: "Check the total amount.",
          details: [{ field: "totalAmount", message: "Doesn't match quantity × price" }],
        });
      }

      await tx.fuelEntry.update({ where: { id }, data: { ...input, filledAt } });
      await this.vehicles.raiseOdometer(vehicleId, odometerKm, tx);
      if (odometerKm < current.odometerKm) {
        // A corrected typo (84120 → 8412) mustn't leave the vehicle at the wrong reading.
        const { _max } = await tx.fuelEntry.aggregate({
          where: { vehicleId },
          _max: { odometerKm: true },
        });
        await this.vehicles.correctOdometer(vehicleId, current.odometerKm, _max.odometerKm!, tx);
      }
    });
    return this.get(userId, vehicleId, id);
  }

  /**
   * Mileage around it is recomputed on the next read. The vehicle keeps its odometer: deleting a
   * record (often a duplicate) doesn't mean the car didn't drive; a wrong reading is fixed by editing.
   */
  async remove(userId: string, vehicleId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Same rules as the other writes: owned, not archived, one write at a time per vehicle.
      assertWritable(await this.vehicles.lockOwned(userId, vehicleId, tx), null);
      const { count } = await tx.fuelEntry.deleteMany({ where: { id, userId, vehicleId } });
      if (count === 0) throw new NotFoundException(NOT_FOUND);
    });
  }

  // shortcut: loads the vehicle's whole history (mileage needs it); page the list response
  // when histories reach the thousands.
  private rows(userId: string, vehicleId: string) {
    return this.prisma.fuelEntry.findMany({ where: { userId, vehicleId } });
  }

  private async history(userId: string, vehicleId: string): Promise<FuelEntry[]> {
    const rows = (await this.rows(userId, vehicleId)).sort(byHistoryOrder);
    const { perFill } = computeMileage(rows);
    return rows.map((row) => toFuelEntry(row, perFill.get(row.id)!)).reverse();
  }
}

/** Archived vehicles are read-only (no adds, edits or deletes); a vehicle only takes its fuels. */
function assertWritable(vehicle: VehicleRow, fuelType: FuelType | null) {
  if (vehicle.archivedAt) {
    throw new ConflictException("This vehicle is archived. Restore it to change its fill-ups.");
  }
  if (fuelType && !FUELS_FOR_VEHICLE[vehicle.fuelType].includes(fuelType)) {
    throw new BadRequestException({
      message: "Check the fuel type.",
      details: [{ field: "fuelType", message: "This vehicle doesn't take this fuel" }],
    });
  }
}

/**
 * One odometer history: a reading can't be below an earlier fill-up's or above a later one's.
 * Equal readings are allowed (a top-up at the same stop). The fix is to correct the reading or date.
 */
async function assertOdometerInOrder(
  tx: Prisma.TransactionClient,
  vehicleId: string,
  filledAt: Date,
  odometerKm: number,
  exceptId?: string,
) {
  const others = { vehicleId, ...(exceptId && { NOT: { id: exceptId } }) };
  const [before, after] = await Promise.all([
    tx.fuelEntry.findFirst({
      where: { ...others, filledAt: { lte: filledAt } },
      orderBy: [{ filledAt: "desc" }, { odometerKm: "desc" }],
    }),
    tx.fuelEntry.findFirst({
      where: { ...others, filledAt: { gt: filledAt } },
      orderBy: [{ filledAt: "asc" }, { odometerKm: "asc" }],
    }),
  ]);
  const clash =
    before && odometerKm < before.odometerKm
      ? `Lower than ${km.format(before.odometerKm)} km, recorded on ${istDate.format(before.filledAt)}. Check the reading or the date.`
      : after && odometerKm > after.odometerKm
        ? `Higher than ${km.format(after.odometerKm)} km, recorded later on ${istDate.format(after.filledAt)}. Check the reading or the date.`
        : null;
  if (clash) {
    throw new ConflictException({
      message: "This odometer reading is out of order with your other fill-ups.",
      details: [{ field: "odometerKm", message: clash }],
    });
  }
}
