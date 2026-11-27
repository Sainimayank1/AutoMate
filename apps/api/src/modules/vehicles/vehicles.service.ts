import type { CreateVehicleValues, UpdateVehicleValues, Vehicle } from "@automate/shared";
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "@/database/prisma.service";
import type { Prisma, Vehicle as VehicleRow } from "@/generated/prisma/client";

import { toVehicle, toVehicleData } from "./vehicles.mapper";

const NOT_FOUND = "Vehicle not found";

/** Owns the `vehicles` table. Every query is scoped by `userId`; other users' vehicles are 404. */
@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Vehicles in use (default) or archived ones, oldest first so the order stays stable. */
  async list(userId: string, { archived }: { archived: boolean }): Promise<Vehicle[]> {
    const rows = await this.prisma.vehicle.findMany({
      where: { userId, archivedAt: archived ? { not: null } : null },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toVehicle);
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

  private async findOwned(userId: string, id: string): Promise<VehicleRow> {
    const row = await this.prisma.vehicle.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException(NOT_FOUND);
    return row;
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
