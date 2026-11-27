import {
  createScheduleSchema,
  type CreateScheduleValues,
  istToday,
  maintenanceCategoryName,
  type MaintenanceOverview,
  type MaintenanceOverviewQuery,
  type MaintenanceSchedule,
  ReportingPeriod,
  resolvePeriod,
  type ScheduleListQuery,
  ScheduleStatus,
  type UpdateScheduleValues,
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
import { ExpensesService } from "@/modules/expenses/expenses.service";
import { VehiclesService } from "@/modules/vehicles/vehicles.service";

import { SCHEDULE_INCLUDE, toDbDate, toSchedule, toScheduleInput } from "./maintenance.mapper";
import { SPEND_CATEGORY_KEYS, summarizeSpend } from "./maintenance-spend";
import { maintenanceStatus } from "./maintenance-status";
import { byUrgency, overviewState } from "./schedule-engine";
import { ServiceRecordsService } from "./service-records.service";

const NOT_FOUND = "Maintenance schedule not found";
const km = new Intl.NumberFormat("en-IN");
const ACTIVE_DUE: ScheduleStatus[] = [
  ScheduleStatus.DUE,
  ScheduleStatus.DUE_SOON,
  ScheduleStatus.UPCOMING,
];

/** Columns from validated input (create, or a merged PATCH). */
const rowData = (values: CreateScheduleValues) => ({
  name: values.name,
  categoryKey: values.categoryKey,
  intervalKm: values.intervalKm ?? null,
  intervalMonths: values.intervalMonths ?? null,
  dueDate: toDbDate(values.dueDate),
  dueKm: values.dueKm ?? null,
  lastDoneDate: toDbDate(values.lastDoneDate),
  lastDoneKm: values.lastDoneKm ?? null,
  remindersEnabled: values.remindersEnabled ?? true,
  leadDays: values.leadDays ?? null,
  leadKm: values.leadKm ?? null,
  priority: values.priority ?? "NORMAL",
  componentId: values.componentId ?? null,
  notes: values.notes ?? null,
});

/** A schedule may watch only a part fitted to the same vehicle. */
async function assertComponent(
  tx: Prisma.TransactionClient,
  vehicle: Vehicle,
  componentId: string | null | undefined,
) {
  if (!componentId) return;
  const found = await tx.vehicleComponent.count({
    where: { id: componentId, userId: vehicle.userId, vehicleId: vehicle.id, state: "INSTALLED" },
  });
  if (!found) {
    const message = "Choose a fitted component of this vehicle";
    throw new BadRequestException({ message, details: [{ field: "componentId", message }] });
  }
}

function assertActive(vehicle: Vehicle) {
  if (vehicle.archivedAt) {
    throw new ConflictException(
      `${vehicle.make} ${vehicle.model} is archived. Restore it to change its maintenance.`,
    );
  }
}

/** "Last done" can't be ahead of the vehicle's reading (the reading would be wrong, not the past). */
function assertLastDoneKm(lastDoneKm: number | null | undefined, vehicle: Vehicle) {
  if (lastDoneKm == null || lastDoneKm <= vehicle.odometerKm) return;
  const message = `Higher than the current odometer (${km.format(vehicle.odometerKm)} km). Check the reading or update the odometer first.`;
  throw new ConflictException({ message, details: [{ field: "lastDoneKm", message }] });
}

/**
 * Maintenance schedules and the overview (docs/architecture/maintenance.md). Every query is
 * scoped by user and vehicle; due figures are computed on read, never stored.
 */
@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicles: VehiclesService,
    private readonly expenses: ExpensesService,
    private readonly records: ServiceRecordsService,
  ) {}

  /**
   * Every schedule of the vehicle with its due figures, most urgent first.
   * shortcut: computes all of a vehicle's schedules per request (status is derived); fine for
   * tens of schedules, move the paging into SQL if a vehicle ever has hundreds.
   */
  private async computed(vehicle: Vehicle): Promise<MaintenanceSchedule[]> {
    const today = istToday(new Date());
    const rows = await this.prisma.maintenanceSchedule.findMany({
      where: { vehicleId: vehicle.id, userId: vehicle.userId },
      include: SCHEDULE_INCLUDE,
    });
    return rows.map((row) => toSchedule(row, vehicle.odometerKm, today)).sort(byUrgency);
  }

  async list(
    userId: string,
    vehicleId: string,
    { status, search, ...page }: ScheduleListQuery,
  ): Promise<Paginated<MaintenanceSchedule>> {
    const vehicle = await this.vehicles.findOwned(userId, vehicleId);
    const needle = search?.toLowerCase();
    const matches = (await this.computed(vehicle)).filter(
      (schedule) =>
        (!status || schedule.due.status === status) &&
        (!needle ||
          schedule.name.toLowerCase().includes(needle) ||
          maintenanceCategoryName(schedule.categoryKey).toLowerCase().includes(needle)),
    );
    return Paginated.of(matches, page);
  }

  async get(userId: string, vehicleId: string, id: string): Promise<MaintenanceSchedule> {
    const vehicle = await this.vehicles.findOwned(userId, vehicleId);
    const row = await this.prisma.maintenanceSchedule.findFirst({
      where: { id, userId, vehicleId },
      include: SCHEDULE_INCLUDE,
    });
    if (!row) throw new NotFoundException(NOT_FOUND);
    return toSchedule(row, vehicle.odometerKm, istToday(new Date()));
  }

  async create(
    userId: string,
    vehicleId: string,
    input: CreateScheduleValues,
  ): Promise<MaintenanceSchedule> {
    const id = await this.prisma.$transaction(async (tx) => {
      const vehicle = await this.vehicles.lockOwned(userId, vehicleId, tx);
      assertActive(vehicle);
      // A retried save (same client id) returns the schedule it already made.
      if (input.id) {
        const existing = await tx.maintenanceSchedule.findFirst({
          where: { id: input.id, userId },
          select: { id: true },
        });
        if (existing) return existing.id;
      }
      assertLastDoneKm(input.lastDoneKm, vehicle);
      await assertComponent(tx, vehicle, input.componentId);
      const finding = input.inspectionItemId
        ? await tx.inspectionItem.findFirst({
            where: {
              id: input.inspectionItemId,
              inspection: { userId, vehicleId },
            },
            select: { id: true },
          })
        : null;
      if (input.inspectionItemId && !finding) {
        throw new BadRequestException("That inspection finding isn't this vehicle's");
      }
      const row = await tx.maintenanceSchedule.create({
        data: {
          ...rowData(input),
          ...(input.id && { id: input.id }),
          userId,
          vehicleId,
          addedOdometerKm: vehicle.odometerKm,
        },
      });
      // The finding now points at the schedule that follows it up.
      if (finding) {
        await tx.inspectionItem.update({
          where: { id: finding.id },
          data: { followUpScheduleId: row.id },
        });
      }
      return row.id;
    });
    this.logger.log(`Maintenance schedule ${id} created`);
    return this.get(userId, vehicleId, id);
  }

  /** Merges onto the stored schedule and re-checks it whole. History is never rewritten. */
  async update(
    userId: string,
    vehicleId: string,
    id: string,
    input: UpdateScheduleValues,
  ): Promise<MaintenanceSchedule> {
    await this.prisma.$transaction(async (tx) => {
      const { vehicle, row } = await this.locked(tx, userId, vehicleId, id);
      const changes = Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined),
      );
      const parsed = createScheduleSchema.safeParse({ ...toScheduleInput(row), ...changes });
      if (!parsed.success) throw new ZodValidationException(parsed.error);
      if (input.lastDoneKm !== undefined) assertLastDoneKm(parsed.data.lastDoneKm, vehicle);
      if (input.componentId !== undefined) {
        await assertComponent(tx, vehicle, parsed.data.componentId);
      }
      await tx.maintenanceSchedule.update({ where: { id }, data: rowData(parsed.data) });
    });
    this.logger.log(`Maintenance schedule ${id} updated`);
    return this.get(userId, vehicleId, id);
  }

  async remove(userId: string, vehicleId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.locked(tx, userId, vehicleId, id);
      await tx.maintenanceSchedule.delete({ where: { id } });
    });
    this.logger.log(`Maintenance schedule ${id} deleted`);
  }

  /** Pause or resume; doing it twice changes nothing. */
  async setPaused(
    userId: string,
    vehicleId: string,
    id: string,
    paused: boolean,
  ): Promise<MaintenanceSchedule> {
    await this.prisma.$transaction(async (tx) => {
      const { row } = await this.locked(tx, userId, vehicleId, id);
      if ((row.pausedAt !== null) === paused) return;
      await tx.maintenanceSchedule.update({
        where: { id },
        data: { pausedAt: paused ? new Date() : null },
      });
      this.logger.log(`Maintenance schedule ${id} ${paused ? "paused" : "resumed"}`);
    });
    return this.get(userId, vehicleId, id);
  }

  /** Every schedule of the vehicle with its due figures (for components' status). */
  schedulesOf(vehicle: Vehicle) {
    return this.computed(vehicle);
  }

  /** The dashboard's maintenance status items (docs/architecture/dashboard.md §6). */
  async statusFor(userId: string, vehicleId: string) {
    const vehicle = await this.vehicles.findOwned(userId, vehicleId);
    return maintenanceStatus(await this.computed(vehicle));
  }

  /** Overdue and due items whatever the period; spending for the period, from Expenses. */
  async overview(
    userId: string,
    vehicleId: string,
    query: MaintenanceOverviewQuery,
  ): Promise<MaintenanceOverview> {
    const vehicle = await this.vehicles.findOwned(userId, vehicleId);
    const custom =
      query.period === ReportingPeriod.CUSTOM ? { from: query.from!, to: query.to! } : undefined;
    const period = resolvePeriod(query.period, new Date(), custom);
    const [schedules, current, previous, records] = await Promise.all([
      this.computed(vehicle),
      this.expenses.spendByMonth(userId, vehicleId, period, SPEND_CATEGORY_KEYS),
      this.expenses.spendByMonth(userId, vehicleId, period.previous, SPEND_CATEGORY_KEYS),
      this.records.recent(userId, vehicleId, 5),
    ]);
    const counts = Object.fromEntries(
      Object.values(ScheduleStatus).map((status) => [status, 0]),
    ) as Record<ScheduleStatus, number>;
    for (const schedule of schedules) counts[schedule.due.status] += 1;
    return {
      odometerKm: vehicle.odometerKm,
      period,
      state: overviewState(schedules.map((schedule) => schedule.due.status)),
      counts,
      overdue: schedules.filter((schedule) => schedule.due.status === ScheduleStatus.OVERDUE),
      upcoming: schedules
        .filter((schedule) => ACTIVE_DUE.includes(schedule.due.status))
        .slice(0, 5),
      next:
        schedules.find(
          (schedule) =>
            ACTIVE_DUE.includes(schedule.due.status) ||
            schedule.due.status === ScheduleStatus.UP_TO_DATE,
        ) ?? null,
      recordCount: records.count,
      recent: records.recent,
      spend: summarizeSpend(current, previous, period),
    };
  }

  /** The schedule under its vehicle's lock; archived vehicles are read-only. */
  private async locked(
    tx: Prisma.TransactionClient,
    userId: string,
    vehicleId: string,
    id: string,
  ) {
    const vehicle = await this.vehicles.lockOwned(userId, vehicleId, tx);
    assertActive(vehicle);
    const row = await tx.maintenanceSchedule.findFirst({ where: { id, userId, vehicleId } });
    if (!row) throw new NotFoundException(NOT_FOUND);
    return { vehicle, row };
  }
}
