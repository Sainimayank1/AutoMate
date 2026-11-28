import {
  type CreateReminderValues,
  istToday,
  pageMeta,
  type Reminder,
  type ReminderListQuery,
  reminderState,
  type UpdateReminderValues,
} from "@automate/shared";
import { Injectable, NotFoundException } from "@nestjs/common";

import { pageArgs, Paginated } from "@/common/pagination/paginated";
import { PrismaService } from "@/database/prisma.service";
import type { Reminder as ReminderRow } from "@/generated/prisma/client";
import { VehiclesService } from "@/modules/vehicles/vehicles.service";

const NOT_FOUND = "Reminder not found";
const toDbDate = (date: string) => new Date(`${date}T00:00:00.000Z`);

function toReminder(row: ReminderRow, today: string): Reminder {
  const dueDate = row.dueDate.toISOString().slice(0, 10);
  const doneAt = row.doneAt?.toISOString() ?? null;
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    title: row.title,
    dueDate,
    remindDaysBefore: row.remindDaysBefore,
    notes: row.notes,
    doneAt,
    state: reminderState({ dueDate, remindDaysBefore: row.remindDaysBefore, doneAt }, today),
    daysLeft: Math.round((Date.parse(dueDate) - Date.parse(today)) / 86_400_000),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** The user's own reminders (M10): a date, an optional vehicle and how many days before. */
@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicles: VehiclesService,
  ) {}

  /** Open ones soonest first; done ones latest done first. */
  async list(userId: string, { status, vehicleId, ...page }: ReminderListQuery) {
    if (vehicleId) await this.vehicles.findOwned(userId, vehicleId);
    const where = {
      userId,
      doneAt: status === "done" ? { not: null } : null,
      ...(vehicleId && { vehicleId }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.reminder.findMany({
        where,
        orderBy:
          status === "done"
            ? [{ doneAt: "desc" }, { id: "desc" }]
            : [{ dueDate: "asc" }, { id: "asc" }],
        ...pageArgs(page),
      }),
      this.prisma.reminder.count({ where }),
    ]);
    const today = istToday(new Date());
    return new Paginated(
      rows.map((row) => toReminder(row, today)),
      pageMeta(page, total),
    );
  }

  /** Open reminders a notification or the dashboard could be about (due within a year or past). */
  async open(userId: string, vehicleId?: string): Promise<Reminder[]> {
    const today = istToday(new Date());
    const rows = await this.prisma.reminder.findMany({
      where: { userId, doneAt: null, ...(vehicleId && { vehicleId }) },
      orderBy: [{ dueDate: "asc" }, { id: "asc" }],
    });
    return rows.map((row) => toReminder(row, today));
  }

  async get(userId: string, id: string): Promise<Reminder> {
    return toReminder(await this.owned(userId, id), istToday(new Date()));
  }

  async create(userId: string, { id, ...values }: CreateReminderValues): Promise<Reminder> {
    if (id) {
      // A retried save (same client id) gets the reminder it already created.
      const existing = await this.prisma.reminder.findFirst({ where: { id, userId } });
      if (existing) return toReminder(existing, istToday(new Date()));
    }
    if (values.vehicleId) await this.vehicles.findOwned(userId, values.vehicleId);
    const row = await this.prisma.reminder.create({
      data: { ...values, ...(id && { id }), userId, dueDate: toDbDate(values.dueDate) },
    });
    return toReminder(row, istToday(new Date()));
  }

  async update(userId: string, id: string, values: UpdateReminderValues): Promise<Reminder> {
    await this.owned(userId, id);
    if (values.vehicleId) await this.vehicles.findOwned(userId, values.vehicleId);
    const row = await this.prisma.reminder.update({
      where: { id },
      data: { ...values, ...(values.dueDate && { dueDate: toDbDate(values.dueDate) }) },
    });
    return toReminder(row, istToday(new Date()));
  }

  async setDone(userId: string, id: string, done: boolean): Promise<Reminder> {
    await this.owned(userId, id);
    const row = await this.prisma.reminder.update({
      where: { id },
      data: { doneAt: done ? new Date() : null },
    });
    return toReminder(row, istToday(new Date()));
  }

  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.reminder.deleteMany({ where: { id, userId } });
    if (!count) throw new NotFoundException(NOT_FOUND);
  }

  private async owned(userId: string, id: string) {
    const row = await this.prisma.reminder.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException(NOT_FOUND);
    return row;
  }
}
