import { randomUUID } from "node:crypto";

import {
  createInspectionSchema,
  type CreateInspectionValues,
  type Inspection,
  type InspectionArea,
  inspectionCounts,
  type InspectionListQuery,
  type InspectionTemplateKey,
  type MaintenanceSchedule,
  pageMeta,
  type UpdateInspectionValues,
} from "@automate/shared";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ZodValidationException } from "nestjs-zod";

import { pageArgs, Paginated } from "@/common/pagination/paginated";
import { PrismaService } from "@/database/prisma.service";
import type { Prisma, Vehicle } from "@/generated/prisma/client";
import { VehiclesService } from "@/modules/vehicles/vehicles.service";

import { toDbDate } from "./maintenance.mapper";
import { MaintenanceService } from "./maintenance.service";
import { ServiceRecordsService } from "./service-records.service";

const NOT_FOUND = "Inspection not found";
const isoDate = (value: Date | null) => value?.toISOString().slice(0, 10) ?? null;
const fieldError = (field: string, message: string) => ({ message, details: [{ field, message }] });

const INCLUDE = {
  provider: { select: { id: true, name: true } },
  items: {
    orderBy: { position: "asc" },
    include: {
      component: { select: { name: true } },
      followUpSchedule: { select: { id: true, name: true } },
    },
  },
} as const satisfies Prisma.InspectionInclude;
type InspectionRow = Prisma.InspectionGetPayload<{ include: typeof INCLUDE }>;

function assertActive(vehicle: Vehicle) {
  if (vehicle.archivedAt) {
    throw new ConflictException(
      `${vehicle.make} ${vehicle.model} is archived. Restore it to change its maintenance.`,
    );
  }
}

/**
 * Checklist inspections (docs/architecture/maintenance.md §3c): the user's own checks and
 * workshop inspections, kept apart by kind. Findings can name a part (its lifecycle lists them)
 * and be followed up by a schedule (created from the finding, linked both ways).
 */
@Injectable()
export class InspectionsService {
  private readonly logger = new Logger(InspectionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicles: VehiclesService,
    private readonly maintenance: MaintenanceService,
    private readonly records: ServiceRecordsService,
  ) {}

  async list(
    userId: string,
    vehicleId: string,
    { kind, ...page }: InspectionListQuery,
  ): Promise<Paginated<Inspection>> {
    const vehicle = await this.vehicles.findOwned(userId, vehicleId);
    const where: Prisma.InspectionWhereInput = { userId, vehicleId, ...(kind && { kind }) };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.inspection.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        ...pageArgs(page),
      }),
      this.prisma.inspection.count({ where }),
    ]);
    const schedules = await this.maintenance.schedulesOf(vehicle);
    return new Paginated(
      rows.map((row) => this.present(row, schedules)),
      pageMeta(page, total),
    );
  }

  async get(userId: string, vehicleId: string, id: string): Promise<Inspection> {
    const vehicle = await this.vehicles.findOwned(userId, vehicleId);
    const row = await this.prisma.inspection.findFirst({
      where: { id, userId, vehicleId },
      include: INCLUDE,
    });
    if (!row) throw new NotFoundException(NOT_FOUND);
    return this.present(row, await this.maintenance.schedulesOf(vehicle));
  }

  async create(
    userId: string,
    vehicleId: string,
    input: CreateInspectionValues,
  ): Promise<Inspection> {
    const id = await this.prisma.$transaction(async (tx) => {
      const vehicle = await this.vehicles.lockOwned(userId, vehicleId, tx);
      assertActive(vehicle);
      // A retried save (same client id) returns the inspection it already made.
      if (input.id) {
        const existing = await tx.inspection.findFirst({
          where: { id: input.id, userId },
          select: { id: true },
        });
        if (existing) return existing.id;
      }
      const id = input.id ?? randomUUID();
      await this.assertComponents(tx, vehicle, input);
      await tx.inspection.create({
        data: {
          ...(await this.columns(tx, userId, input)),
          id,
          userId,
          vehicleId,
          items: { create: input.items.map((item, position) => itemColumns(item, position)) },
        },
      });
      return id;
    });
    this.logger.log(`Inspection ${id} created`);
    return this.get(userId, vehicleId, id);
  }

  /** Merges and re-checks the whole inspection; items keep their ids (and follow-up links). */
  async update(
    userId: string,
    vehicleId: string,
    id: string,
    input: UpdateInspectionValues,
  ): Promise<Inspection> {
    await this.prisma.$transaction(async (tx) => {
      const { vehicle, row } = await this.locked(tx, userId, vehicleId, id);
      const changes = Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined),
      );
      const parsed = createInspectionSchema.safeParse({ ...asInput(row), ...changes });
      if (!parsed.success) throw new ZodValidationException(parsed.error);
      const values = parsed.data;
      await this.assertComponents(tx, vehicle, values);
      await tx.inspection.update({ where: { id }, data: await this.columns(tx, userId, values) });
      if (input.items !== undefined) {
        const kept = new Set(row.items.map((item) => item.id));
        const staying = values.items.filter((item) => item.id && kept.has(item.id));
        await tx.inspectionItem.deleteMany({
          where: { inspectionId: id, id: { notIn: staying.map((item) => item.id!) } },
        });
        for (const [position, item] of values.items.entries()) {
          if (item.id && kept.has(item.id)) {
            await tx.inspectionItem.update({
              where: { id: item.id },
              data: itemColumns(item, position),
            });
          } else {
            await tx.inspectionItem.create({
              data: { ...itemColumns(item, position), inspectionId: id },
            });
          }
        }
      }
    });
    this.logger.log(`Inspection ${id} updated`);
    return this.get(userId, vehicleId, id);
  }

  /** Schedules created from its findings are kept. */
  async remove(userId: string, vehicleId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.locked(tx, userId, vehicleId, id);
      await tx.inspection.delete({ where: { id } });
    });
    this.logger.log(`Inspection ${id} deleted`);
  }

  private async columns(
    tx: Prisma.TransactionClient,
    userId: string,
    values: CreateInspectionValues,
  ) {
    const provider = values.providerName
      ? await this.records.providerNamed(tx, userId, values.providerName)
      : null;
    return {
      kind: values.kind,
      templateKey: values.templateKey,
      title: values.title,
      date: toDbDate(values.date)!,
      odometerKm: values.odometerKm ?? null,
      inspector: values.inspector ?? null,
      providerId: provider?.id ?? null,
      followUpDate: toDbDate(values.followUpDate),
      notes: values.notes ?? null,
    };
  }

  /** Findings may name only this vehicle's parts. */
  private async assertComponents(
    tx: Prisma.TransactionClient,
    vehicle: Vehicle,
    values: CreateInspectionValues,
  ) {
    const ids = values.items.flatMap((item) => (item.componentId ? [item.componentId] : []));
    if (!ids.length) return;
    const found = await tx.vehicleComponent.findMany({
      where: { id: { in: ids }, userId: vehicle.userId, vehicleId: vehicle.id },
      select: { id: true },
    });
    const missing = values.items.findIndex(
      (item) => item.componentId && !found.some((row) => row.id === item.componentId),
    );
    if (missing >= 0) {
      throw new BadRequestException(
        fieldError(`items.${missing}.componentId`, "Choose a component of this vehicle"),
      );
    }
  }

  private async locked(
    tx: Prisma.TransactionClient,
    userId: string,
    vehicleId: string,
    id: string,
  ) {
    const vehicle = await this.vehicles.lockOwned(userId, vehicleId, tx);
    assertActive(vehicle);
    const row = await tx.inspection.findFirst({
      where: { id, userId, vehicleId },
      include: INCLUDE,
    });
    if (!row) throw new NotFoundException(NOT_FOUND);
    return { vehicle, row };
  }

  private present(row: InspectionRow, schedules: MaintenanceSchedule[]): Inspection {
    return {
      id: row.id,
      vehicleId: row.vehicleId,
      kind: row.kind,
      templateKey: row.templateKey as InspectionTemplateKey,
      title: row.title,
      date: isoDate(row.date)!,
      odometerKm: row.odometerKm,
      inspector: row.inspector,
      provider: row.provider,
      followUpDate: isoDate(row.followUpDate),
      notes: row.notes,
      items: row.items.map((item) => ({
        id: item.id,
        area: item.area as InspectionArea,
        label: item.label,
        condition: item.condition,
        notes: item.notes,
        recommendedAction: item.recommendedAction,
        componentId: item.componentId,
        componentName: item.component?.name ?? null,
        followUpSchedule: item.followUpSchedule && {
          ...item.followUpSchedule,
          status:
            schedules.find((schedule) => schedule.id === item.followUpSchedule!.id)?.due.status ??
            "NOT_CONFIGURED",
        },
      })),
      counts: inspectionCounts(row.items.map((item) => item.condition)),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

const itemColumns = (item: CreateInspectionValues["items"][number], position: number) => ({
  position,
  area: item.area,
  label: item.label,
  condition: item.condition,
  notes: item.notes ?? null,
  recommendedAction: item.recommendedAction ?? null,
  componentId: item.componentId ?? null,
});

/** A stored inspection as create input, so a PATCH can be merged and re-checked whole. */
function asInput(row: InspectionRow): CreateInspectionValues {
  return {
    kind: row.kind,
    templateKey: row.templateKey as InspectionTemplateKey,
    title: row.title,
    date: isoDate(row.date)!,
    odometerKm: row.odometerKm,
    inspector: row.inspector,
    providerName: row.provider?.name ?? null,
    followUpDate: isoDate(row.followUpDate),
    notes: row.notes,
    items: row.items.map((item) => ({
      id: item.id,
      area: item.area as InspectionArea,
      label: item.label,
      condition: item.condition,
      notes: item.notes,
      recommendedAction: item.recommendedAction,
      componentId: item.componentId,
    })),
  };
}
