import {
  type CreateScheduleValues,
  istToday,
  type MaintenanceCategoryKey,
  type MaintenanceSchedule,
} from "@automate/shared";

import type { Prisma } from "@/generated/prisma/client";

/** Every schedule query loads its completions (the logged services behind its next due). */
export const SCHEDULE_INCLUDE = {
  completions: { select: { record: { select: { serviceDate: true, odometerKm: true } } } },
  component: { select: { id: true, name: true } },
} as const satisfies Prisma.MaintenanceScheduleInclude;

type ScheduleRow = Prisma.MaintenanceScheduleGetPayload<{ include: typeof SCHEDULE_INCLUDE }>;

import { computeDue } from "./schedule-engine";

const isoDate = (value: Date | null) => value?.toISOString().slice(0, 10) ?? null;
export const toDbDate = (value: string | null | undefined) =>
  value ? new Date(`${value}T00:00:00.000Z`) : null;

/** The only public shape of a schedule row, with its due figures as of `today` (IST). */
export function toSchedule(
  row: ScheduleRow,
  odometerKm: number,
  today: string,
): MaintenanceSchedule {
  const fields = {
    intervalKm: row.intervalKm,
    intervalMonths: row.intervalMonths,
    dueDate: isoDate(row.dueDate),
    dueKm: row.dueKm,
    lastDoneDate: isoDate(row.lastDoneDate),
    lastDoneKm: row.lastDoneKm,
    leadDays: row.leadDays,
    leadKm: row.leadKm,
  };
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    name: row.name,
    categoryKey: row.categoryKey as MaintenanceCategoryKey,
    ...fields,
    addedOdometerKm: row.addedOdometerKm,
    remindersEnabled: row.remindersEnabled,
    priority: row.priority,
    component: row.component,
    notes: row.notes,
    pausedAt: row.pausedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    due: computeDue(
      {
        ...fields,
        addedDate: istToday(row.createdAt),
        addedOdometerKm: row.addedOdometerKm,
        paused: row.pausedAt !== null,
        completions: row.completions.map(({ record }) => ({
          date: isoDate(record.serviceDate)!,
          km: record.odometerKm,
        })),
      },
      odometerKm,
      today,
    ),
  };
}

/** A stored schedule as create input, so a PATCH can be merged and re-checked whole. */
export function toScheduleInput(
  row: Omit<ScheduleRow, "completions" | "component">,
): CreateScheduleValues {
  return {
    name: row.name,
    categoryKey: row.categoryKey as MaintenanceCategoryKey,
    intervalKm: row.intervalKm,
    intervalMonths: row.intervalMonths,
    dueDate: isoDate(row.dueDate),
    dueKm: row.dueKm,
    lastDoneDate: isoDate(row.lastDoneDate),
    lastDoneKm: row.lastDoneKm,
    remindersEnabled: row.remindersEnabled,
    leadDays: row.leadDays,
    leadKm: row.leadKm,
    priority: row.priority,
    componentId: row.componentId,
    notes: row.notes,
  };
}
