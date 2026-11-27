import { randomUUID } from "node:crypto";

import {
  type ComponentHistoryEntry,
  componentKindCategory,
  componentKindName,
  type ComponentListQuery,
  ComponentStatus,
  createComponentSchema,
  type CreateComponentValues,
  type InspectComponentValues,
  istToday,
  type MaintenanceSchedule,
  type RemoveComponentValues,
  type ReplaceComponentValues,
  type UpdateComponentValues,
  type VehicleComponent,
  type VehicleComponentDetail,
} from "@automate/shared";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ZodValidationException } from "nestjs-zod";

import { Paginated } from "@/common/pagination/paginated";
import { PrismaService } from "@/database/prisma.service";
import type { Prisma, Vehicle } from "@/generated/prisma/client";
import { VehiclesService } from "@/modules/vehicles/vehicles.service";

import { componentLife, componentStatus, warrantyActive } from "./component-life";
import { toDbDate } from "./maintenance.mapper";
import { MaintenanceService } from "./maintenance.service";
import { ServiceRecordsService } from "./service-records.service";

const NOT_FOUND = "Component not found";
const fieldError = (field: string, message: string) => ({ message, details: [{ field, message }] });
const isoDate = (value: Date | null) => value?.toISOString().slice(0, 10) ?? null;
const NO_INSPECTION = { inspectionId: null, inspectionTitle: null, checklistCondition: null };

const INCLUDE = {
  provider: { select: { id: true, name: true } },
  replacedBy: { select: { id: true, name: true } },
  replaces: { select: { id: true, name: true } },
} as const satisfies Prisma.VehicleComponentInclude;
type ComponentRow = Prisma.VehicleComponentGetPayload<{ include: typeof INCLUDE }>;

/** Fitted parts needing a look first, then by name. */
const URGENCY: ComponentStatus[] = [
  ComponentStatus.FAILED,
  ComponentStatus.REPLACEMENT_APPROACHING,
  ComponentStatus.INSPECTION_DUE,
  ComponentStatus.MONITORING,
];
const urgency = (status: ComponentStatus) => {
  const index = URGENCY.indexOf(status);
  return index < 0 ? URGENCY.length : index;
};

/** Profile columns from validated input. */
const profile = (values: CreateComponentValues) => ({
  kind: values.kind,
  name: values.name,
  position: values.position ?? null,
  brand: values.brand ?? null,
  partNumber: values.partNumber ?? null,
  installedAt: toDbDate(values.installedAt),
  installedKm: values.installedKm ?? null,
  expectedLifeKm: values.expectedLifeKm ?? null,
  expectedLifeMonths: values.expectedLifeMonths ?? null,
  warrantyUntil: toDbDate(values.warrantyUntil),
  warrantyKm: values.warrantyKm ?? null,
  notes: values.notes ?? null,
});

function assertActive(vehicle: Vehicle) {
  if (vehicle.archivedAt) {
    throw new ConflictException(
      `${vehicle.make} ${vehicle.model} is archived. Restore it to change its maintenance.`,
    );
  }
}

/**
 * Component lifecycle (docs/architecture/maintenance.md §3b). A part is fitted, inspected, then
 * replaced or removed; a replaced part is kept as history and its successor points back to it.
 * A replacement is logged as a service record (its money and schedules go the records' way).
 */
@Injectable()
export class ComponentsService {
  private readonly logger = new Logger(ComponentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicles: VehiclesService,
    private readonly maintenance: MaintenanceService,
    private readonly records: ServiceRecordsService,
  ) {}

  /**
   * Fitted parts (most in need of a look first) or the ones taken off (latest first).
   * shortcut: status is derived, so a vehicle's parts are computed in memory; fine for tens.
   */
  async list(
    userId: string,
    vehicleId: string,
    { state, search, ...page }: ComponentListQuery,
  ): Promise<Paginated<VehicleComponent>> {
    const vehicle = await this.vehicles.findOwned(userId, vehicleId);
    const rows = await this.prisma.vehicleComponent.findMany({
      where: {
        userId,
        vehicleId,
        state: state === "installed" ? "INSTALLED" : { in: ["REPLACED", "REMOVED"] },
      },
      include: INCLUDE,
      orderBy: [{ removedAt: "desc" }, { name: "asc" }, { id: "asc" }],
    });
    const schedules = await this.maintenance.schedulesOf(vehicle);
    const needle = search?.toLowerCase();
    const parts = rows
      .map((row) => this.present(row, vehicle, schedules))
      .filter(
        (part) =>
          !needle ||
          [
            part.name,
            part.brand,
            part.partNumber,
            part.position,
            componentKindName(part.kind),
          ].some((text) => text?.toLowerCase().includes(needle)),
      );
    if (state === "installed") {
      parts.sort((a, b) => urgency(a.status) - urgency(b.status) || a.name.localeCompare(b.name));
    }
    return Paginated.of(parts, page);
  }

  async get(userId: string, vehicleId: string, id: string): Promise<VehicleComponentDetail> {
    const vehicle = await this.vehicles.findOwned(userId, vehicleId);
    const row = await this.prisma.vehicleComponent.findFirst({
      where: { id, userId, vehicleId },
      include: {
        ...INCLUDE,
        installRecord: { select: { id: true, title: true } },
        events: {
          orderBy: [{ date: "asc" }, { createdAt: "asc" }],
          include: { record: { select: { title: true } } },
        },
        recordItems: {
          select: {
            record: { select: { id: true, title: true, serviceDate: true, odometerKm: true } },
          },
        },
        inspectionItems: {
          select: {
            condition: true,
            notes: true,
            inspection: { select: { id: true, title: true, date: true, odometerKm: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException(NOT_FOUND);
    const part = this.present(row, vehicle, await this.maintenance.schedulesOf(vehicle));
    const history: ComponentHistoryEntry[] = [];
    if (part.installedAt) {
      history.push({
        source: "EVENT",
        type: "INSTALLED",
        date: part.installedAt,
        odometerKm: part.installedKm,
        condition: null,
        notes: null,
        recordId: row.installRecord?.id ?? null,
        recordTitle: row.installRecord?.title ?? null,
        ...NO_INSPECTION,
      });
    }
    for (const event of row.events) {
      history.push({
        source: "EVENT",
        type: event.type,
        date: isoDate(event.date)!,
        odometerKm: event.odometerKm,
        condition: event.condition,
        notes: event.notes,
        recordId: event.recordId,
        recordTitle: event.record?.title ?? null,
        ...NO_INSPECTION,
      });
    }
    // Records that worked on it (not the one that fitted it: that's the "installed" entry).
    const seen = new Set(row.installRecord ? [row.installRecord.id] : []);
    for (const { record } of row.recordItems) {
      if (seen.has(record.id)) continue;
      seen.add(record.id);
      history.push({
        source: "RECORD",
        type: "SERVICED",
        date: isoDate(record.serviceDate)!,
        odometerKm: record.odometerKm,
        condition: null,
        notes: null,
        recordId: record.id,
        recordTitle: record.title,
        ...NO_INSPECTION,
      });
    }
    for (const item of row.inspectionItems) {
      history.push({
        source: "INSPECTION",
        type: "INSPECTED",
        date: isoDate(item.inspection.date)!,
        odometerKm: item.inspection.odometerKm,
        condition: null,
        notes: item.notes,
        recordId: null,
        recordTitle: null,
        inspectionId: item.inspection.id,
        inspectionTitle: item.inspection.title,
        checklistCondition: item.condition,
      });
    }
    history.sort((a, b) => a.date.localeCompare(b.date));
    return { ...part, history };
  }

  async create(
    userId: string,
    vehicleId: string,
    input: CreateComponentValues,
  ): Promise<VehicleComponentDetail> {
    const id = await this.prisma.$transaction(async (tx) => {
      const vehicle = await this.vehicles.lockOwned(userId, vehicleId, tx);
      assertActive(vehicle);
      // A retried save (same client id) returns the part it already made.
      if (input.id) {
        const existing = await tx.vehicleComponent.findFirst({
          where: { id: input.id, userId },
          select: { id: true },
        });
        if (existing) return existing.id;
      }
      const provider = input.providerName
        ? await this.records.providerNamed(tx, userId, input.providerName)
        : null;
      const row = await tx.vehicleComponent.create({
        data: {
          ...profile(input),
          ...(input.id && { id: input.id }),
          userId,
          vehicleId,
          providerId: provider?.id ?? null,
          condition: input.condition ?? "UNKNOWN",
        },
      });
      return row.id;
    });
    this.logger.log(`Component ${id} created`);
    return this.get(userId, vehicleId, id);
  }

  /** Profile fields only; the condition changes through inspections, the state through actions. */
  async update(
    userId: string,
    vehicleId: string,
    id: string,
    input: UpdateComponentValues,
  ): Promise<VehicleComponentDetail> {
    await this.prisma.$transaction(async (tx) => {
      const { row } = await this.locked(tx, userId, vehicleId, id);
      const changes = Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined),
      );
      const parsed = createComponentSchema.safeParse({ ...this.asInput(row), ...changes });
      if (!parsed.success) throw new ZodValidationException(parsed.error);
      const provider =
        "providerName" in changes
          ? parsed.data.providerName
            ? await this.records.providerNamed(tx, userId, parsed.data.providerName)
            : null
          : undefined;
      await tx.vehicleComponent.update({
        where: { id },
        data: {
          ...profile(parsed.data),
          ...(provider !== undefined && { providerId: provider?.id ?? null }),
        },
      });
    });
    this.logger.log(`Component ${id} updated`);
    return this.get(userId, vehicleId, id);
  }

  /** Deletes the part and its events; records and schedules that mention it are kept. */
  async remove(userId: string, vehicleId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.locked(tx, userId, vehicleId, id);
      await tx.vehicleComponent.delete({ where: { id } });
    });
    this.logger.log(`Component ${id} deleted`);
  }

  /** The user's own check: an inspection event and the part's new condition. */
  async inspect(
    userId: string,
    vehicleId: string,
    id: string,
    values: InspectComponentValues,
  ): Promise<VehicleComponentDetail> {
    await this.prisma.$transaction(async (tx) => {
      const { row } = await this.locked(tx, userId, vehicleId, id, { fitted: true });
      this.assertAfterInstall(row, values.date);
      await tx.componentEvent.create({
        data: {
          componentId: id,
          type: "INSPECTED",
          date: toDbDate(values.date)!,
          odometerKm: values.odometerKm ?? null,
          condition: values.condition,
          notes: values.notes ?? null,
        },
      });
      await tx.vehicleComponent.update({ where: { id }, data: { condition: values.condition } });
    });
    this.logger.log(`Component ${id} inspected`);
    return this.get(userId, vehicleId, id);
  }

  /** Taken off without a successor; its history stays and its schedules stop watching it. */
  async retire(
    userId: string,
    vehicleId: string,
    id: string,
    values: RemoveComponentValues,
  ): Promise<VehicleComponentDetail> {
    await this.prisma.$transaction(async (tx) => {
      const { row } = await this.locked(tx, userId, vehicleId, id, { fitted: true });
      this.assertAfterInstall(row, values.date);
      const condition = values.failed ? ("FAILED" as const) : null;
      await tx.vehicleComponent.update({
        where: { id },
        data: {
          state: "REMOVED",
          removedAt: toDbDate(values.date),
          removedKm: values.odometerKm ?? null,
          ...(condition && { condition }),
        },
      });
      await tx.componentEvent.create({
        data: {
          componentId: id,
          type: "REMOVED",
          date: toDbDate(values.date)!,
          odometerKm: values.odometerKm ?? null,
          condition,
          notes: values.notes ?? null,
        },
      });
      await tx.maintenanceSchedule.updateMany({
        where: { componentId: id },
        data: { componentId: null },
      });
    });
    this.logger.log(`Component ${id} removed`);
    return this.get(userId, vehicleId, id);
  }

  /**
   * Replaces a fitted part: the old one is kept (REPLACED, pointing at its successor), the new one
   * is fitted, and the work is a "Component replacement" service record that completes the
   * schedules watching the part (which then watch the new one). One transaction.
   */
  async replace(
    userId: string,
    vehicleId: string,
    id: string,
    values: ReplaceComponentValues,
  ): Promise<VehicleComponentDetail> {
    const newId = await this.prisma.$transaction(async (tx) => {
      const vehicle = await this.vehicles.lockOwned(userId, vehicleId, tx);
      assertActive(vehicle);
      if (values.id) {
        const existing = await tx.vehicleComponent.findFirst({
          where: { id: values.id, userId },
          select: { id: true },
        });
        if (existing) return existing.id;
      }
      const { row: old } = await this.locked(tx, userId, vehicleId, id, { fitted: true });
      this.assertAfterInstall(old, values.date);
      const newId = values.id ?? randomUUID();
      const recordId = randomUUID();
      const provider = values.providerName
        ? await this.records.providerNamed(tx, userId, values.providerName)
        : null;

      await tx.vehicleComponent.create({
        data: {
          id: newId,
          userId,
          vehicleId,
          kind: old.kind,
          name: old.name,
          position: old.position,
          brand: values.brand ?? null,
          partNumber: values.partNumber ?? null,
          installedAt: toDbDate(values.date),
          installedKm: values.odometerKm ?? null,
          providerId: provider?.id ?? null,
          expectedLifeKm: values.expectedLifeKm ?? old.expectedLifeKm,
          expectedLifeMonths: values.expectedLifeMonths ?? old.expectedLifeMonths,
          warrantyUntil: toDbDate(values.warrantyUntil),
          warrantyKm: values.warrantyKm ?? null,
          condition: "NEW",
        },
      });
      const watching = await tx.maintenanceSchedule.findMany({
        where: { componentId: id },
        select: { id: true, name: true },
      });
      const part = [values.brand, old.name].filter(Boolean).join(" ");
      await this.records.createInTransaction(tx, vehicle, recordId, {
        type: "COMPONENT_REPLACEMENT",
        title: `${old.name} replaced`,
        categoryKey: componentKindCategory(old.kind),
        serviceDate: values.date,
        odometerKm: values.odometerKm ?? null,
        providerName: provider?.name ?? null,
        totalAmount: values.totalAmount ?? null,
        paymentMethod: values.paymentMethod ?? null,
        warrantyUntil: values.warrantyUntil ?? null,
        notes: values.notes ?? null,
        // The part itself, then one item per schedule it completes (once per record each).
        items: [
          {
            name: part,
            partNumber: values.partNumber ?? null,
            componentId: newId,
            scheduleId: watching[0]?.id ?? null,
          },
          ...watching
            .slice(1)
            .map((schedule) => ({ name: schedule.name, scheduleId: schedule.id })),
        ],
      });
      await tx.vehicleComponent.update({
        where: { id: newId },
        data: { installRecordId: recordId },
      });
      await tx.vehicleComponent.update({
        where: { id },
        data: {
          state: "REPLACED",
          removedAt: toDbDate(values.date),
          removedKm: values.odometerKm ?? null,
          replacedById: newId,
        },
      });
      await tx.componentEvent.create({
        data: {
          componentId: id,
          type: "REPLACED",
          date: toDbDate(values.date)!,
          odometerKm: values.odometerKm ?? null,
          recordId,
          notes: values.notes ?? null,
        },
      });
      await tx.maintenanceSchedule.updateMany({
        where: { componentId: id },
        data: { componentId: newId },
      });
      return newId;
    });
    this.logger.log(`Component ${id} replaced by ${newId}`);
    return this.get(userId, vehicleId, newId);
  }

  private present(
    row: ComponentRow,
    vehicle: Vehicle,
    schedules: MaintenanceSchedule[],
  ): VehicleComponent {
    const today = istToday(new Date());
    const fitted = row.state === "INSTALLED";
    const part = {
      installedAt: isoDate(row.installedAt),
      installedKm: row.installedKm,
      expectedLifeKm: row.expectedLifeKm,
      expectedLifeMonths: row.expectedLifeMonths,
    };
    // A part taken off is measured at its removal: how long it lasted.
    const life = fitted
      ? componentLife(part, vehicle.odometerKm, today)
      : componentLife(part, row.removedKm, isoDate(row.removedAt)!);
    const watching = schedules.filter((schedule) => schedule.component?.id === row.id);
    return {
      id: row.id,
      vehicleId: row.vehicleId,
      kind: row.kind as VehicleComponent["kind"],
      name: row.name,
      position: row.position,
      brand: row.brand,
      partNumber: row.partNumber,
      ...part,
      provider: row.provider,
      warrantyUntil: isoDate(row.warrantyUntil),
      warrantyKm: row.warrantyKm,
      warrantyActive: fitted
        ? warrantyActive(
            { warrantyUntil: isoDate(row.warrantyUntil), warrantyKm: row.warrantyKm },
            vehicle.odometerKm,
            today,
          )
        : null,
      condition: row.condition,
      state: row.state,
      status: componentStatus(
        row,
        life,
        watching.map((schedule) => schedule.due.status),
      ),
      removedAt: isoDate(row.removedAt),
      removedKm: row.removedKm,
      installRecordId: row.installRecordId,
      replacedBy: row.replacedBy,
      replaces: row.replaces,
      life,
      schedules: watching.map((schedule) => ({
        id: schedule.id,
        name: schedule.name,
        status: schedule.due.status,
      })),
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private asInput(row: ComponentRow): CreateComponentValues {
    return {
      kind: row.kind as CreateComponentValues["kind"],
      name: row.name,
      position: row.position,
      brand: row.brand,
      partNumber: row.partNumber,
      installedAt: isoDate(row.installedAt),
      installedKm: row.installedKm,
      providerName: row.provider?.name ?? null,
      expectedLifeKm: row.expectedLifeKm,
      expectedLifeMonths: row.expectedLifeMonths,
      warrantyUntil: isoDate(row.warrantyUntil),
      warrantyKm: row.warrantyKm,
      notes: row.notes,
    };
  }

  /** Nothing happens to a part before it was fitted. */
  private assertAfterInstall(row: ComponentRow, date: string) {
    const installed = isoDate(row.installedAt);
    if (installed && date < installed) {
      throw new BadRequestException(
        fieldError("date", `Before it was fitted (${installed.split("-").reverse().join("/")})`),
      );
    }
  }

  private async locked(
    tx: Prisma.TransactionClient,
    userId: string,
    vehicleId: string,
    id: string,
    { fitted = false } = {},
  ) {
    const vehicle = await this.vehicles.lockOwned(userId, vehicleId, tx);
    assertActive(vehicle);
    const row = await tx.vehicleComponent.findFirst({
      where: { id, userId, vehicleId },
      include: INCLUDE,
    });
    if (!row) throw new NotFoundException(NOT_FOUND);
    if (fitted && row.state !== "INSTALLED") {
      throw new ConflictException("This part has been taken off; its history is read-only.");
    }
    return { vehicle, row };
  }
}
