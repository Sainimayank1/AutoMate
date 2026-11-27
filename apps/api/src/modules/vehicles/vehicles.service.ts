import {
  type CreateVehicleValues,
  pageMeta,
  type UpdateVehicleValues,
  type Vehicle,
  type VehicleListQuery,
} from "@automate/shared";
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";

import { pageArgs, Paginated } from "@/common/pagination/paginated";
import { PrismaService } from "@/database/prisma.service";
import type { Prisma, Vehicle as VehicleRow } from "@/generated/prisma/client";

import { OdometerHistoryService } from "./odometer-history.service";
import { toVehicle, toVehicleData } from "./vehicles.mapper";

const NOT_FOUND = "Vehicle not found";

/** Owns the `vehicles` table. Every query is scoped by `userId`; other users' vehicles are 404. */
@Injectable()
export class VehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly history: OdometerHistoryService,
  ) {}

  /** Vehicles in use (default) or archived ones, oldest first so pages stay stable. */
  async list(userId: string, { archived, ...page }: VehicleListQuery): Promise<Paginated<Vehicle>> {
    const where = { userId, archivedAt: archived ? { not: null } : null };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.vehicle.count({ where }),
      this.prisma.vehicle.findMany({
        where,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        ...pageArgs(page),
      }),
    ]);
    return new Paginated(rows.map(toVehicle), pageMeta(page, total));
  }

  async get(userId: string, id: string): Promise<Vehicle> {
    return toVehicle(await this.findOwned(userId, id));
  }

  async create(userId: string, input: CreateVehicleValues): Promise<Vehicle> {
    await this.assertRegistrationFree(userId, input.registrationNumber);
    const row = await this.prisma.vehicle.create({
      data: { ...(toVehicleData(input) as Prisma.VehicleUncheckedCreateInput), userId },
    });
    return toVehicle(row);
  }

  async update(userId: string, id: string, input: UpdateVehicleValues): Promise<Vehicle> {
    const current = await this.findOwned(userId, id);
    if (input.registrationNumber && input.registrationNumber !== current.registrationNumber) {
      await this.assertRegistrationFree(userId, input.registrationNumber, id);
    }
    const row = await this.prisma.vehicle.update({ where: { id }, data: toVehicleData(input) });
    return toVehicle(row);
  }

  /** Hides the vehicle from the switcher and lists; every record is kept. Idempotent. */
  async archive(userId: string, id: string): Promise<Vehicle> {
    const current = await this.findOwned(userId, id);
    if (current.archivedAt) return toVehicle(current);
    return toVehicle(
      await this.prisma.vehicle.update({ where: { id }, data: { archivedAt: new Date() } }),
    );
  }

  async restore(userId: string, id: string): Promise<Vehicle> {
    await this.findOwned(userId, id);
    return toVehicle(
      await this.prisma.vehicle.update({ where: { id }, data: { archivedAt: null } }),
    );
  }

  /** Permanent. Records that reference the vehicle (fuel, expenses…) are removed with it by cascade. */
  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.vehicle.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException(NOT_FOUND);
  }

  /** The user's vehicle row, or 404. Also used by modules that record against a vehicle. */
  async findOwned(
    userId: string,
    id: string,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<VehicleRow> {
    const row = await db.vehicle.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException(NOT_FOUND);
    return row;
  }

  /**
   * `findOwned` inside a transaction, holding the row lock until it commits, so concurrent writes
   * to the vehicle's records (e.g. two fuel entries checking the odometer order) run one at a time.
   */
  async lockOwned(userId: string, id: string, tx: Prisma.TransactionClient): Promise<VehicleRow> {
    await tx.$queryRaw`SELECT 1 FROM vehicles WHERE id = ${id}::uuid AND user_id = ${userId}::uuid FOR UPDATE`;
    return this.findOwned(userId, id, tx);
  }

  /**
   * A reading another module raised the odometer to was corrected down: follow it to the highest
   * reading still recorded anywhere (`toKm` or higher: the one odometer history), but only if the
   * vehicle still shows the old reading.
   * shortcut: can land below a reading typed in Garage when a back-logged record is corrected;
   * Garage keeps no reading history of its own.
   */
  async correctOdometer(
    id: string,
    fromKm: number,
    toKm: number,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const highest = Math.max(toKm, (await this.history.highest(tx, id)) ?? 0);
    if (highest >= fromKm) return;
    await tx.vehicle.updateMany({
      where: { id, odometerKm: fromKm },
      data: { odometerKm: highest },
    });
  }

  /** A newer reading from another module (fuel, service, trips): raise, never lower. */
  async raiseOdometer(id: string, km: number, tx: Prisma.TransactionClient): Promise<void> {
    await tx.vehicle.updateMany({
      where: { id, odometerKm: { lt: km } },
      data: { odometerKm: km },
    });
  }

  /** Archived vehicles count too: a registration belongs to one vehicle per user. */
  private async assertRegistrationFree(
    userId: string,
    registrationNumber: string,
    exceptId?: string,
  ) {
    const clash = await this.prisma.vehicle.findFirst({
      where: { userId, registrationNumber, ...(exceptId && { NOT: { id: exceptId } }) },
      select: { archivedAt: true },
    });
    if (!clash) return;
    const message = clash.archivedAt
      ? "An archived vehicle in your garage already has this registration. Restore it instead."
      : "A vehicle in your garage already has this registration.";
    // A concurrent duplicate still hits the unique index (P2002 → 409).
    throw new ConflictException({
      message,
      details: [{ field: "registrationNumber", message }],
    });
  }
}
