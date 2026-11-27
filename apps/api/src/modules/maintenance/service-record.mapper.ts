import type {
  CreateServiceRecordValues,
  MaintenanceCategoryKey,
  ServiceRecord,
} from "@automate/shared";

import type { Prisma } from "@/generated/prisma/client";

/** What every record query loads: its workshop and items (with the completed schedule's name). */
export const RECORD_INCLUDE = {
  provider: { select: { id: true, name: true } },
  items: {
    orderBy: { position: "asc" },
    include: { schedule: { select: { name: true } }, component: { select: { name: true } } },
  },
} as const satisfies Prisma.ServiceRecordInclude;

export type RecordRow = Prisma.ServiceRecordGetPayload<{ include: typeof RECORD_INCLUDE }>;

const isoDate = (value: Date | null) => value?.toISOString().slice(0, 10) ?? null;
const money = (value: Prisma.Decimal | null) => value?.toFixed(2) ?? null;

/** The only public shape of a service record. */
export function toServiceRecord(row: RecordRow, expenseId: string | null): ServiceRecord {
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    type: row.type,
    title: row.title,
    categoryKey: row.categoryKey as MaintenanceCategoryKey,
    serviceDate: isoDate(row.serviceDate)!,
    odometerKm: row.odometerKm,
    provider: row.provider,
    technician: row.technician,
    description: row.description,
    labourAmount: money(row.labourAmount),
    partsAmount: money(row.partsAmount),
    otherAmount: money(row.otherAmount),
    taxAmount: money(row.taxAmount),
    discountAmount: money(row.discountAmount),
    totalAmount: row.totalAmount.toFixed(2),
    paymentMethod: row.paymentMethod,
    warrantyUntil: isoDate(row.warrantyUntil),
    warrantyNotes: row.warrantyNotes,
    notes: row.notes,
    items: row.items.map((item) => ({
      id: item.id,
      name: item.name,
      partNumber: item.partNumber,
      scheduleId: item.scheduleId,
      scheduleName: item.schedule?.name ?? null,
      componentId: item.componentId,
      componentName: item.component?.name ?? null,
    })),
    expenseId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** A stored record as create input, so a PATCH can be merged and re-checked whole. */
export function toServiceRecordInput(row: RecordRow): CreateServiceRecordValues {
  const record = toServiceRecord(row, null);
  return {
    type: record.type,
    title: record.title,
    categoryKey: record.categoryKey,
    serviceDate: record.serviceDate,
    odometerKm: record.odometerKm,
    providerName: record.provider?.name ?? null,
    technician: record.technician,
    description: record.description,
    labourAmount: record.labourAmount,
    partsAmount: record.partsAmount,
    otherAmount: record.otherAmount,
    taxAmount: record.taxAmount,
    discountAmount: record.discountAmount,
    // With a breakdown the total is computed; without one, the stored total is what was entered.
    totalAmount: record.totalAmount,
    paymentMethod: record.paymentMethod,
    warrantyUntil: record.warrantyUntil,
    warrantyNotes: record.warrantyNotes,
    notes: record.notes,
    items: record.items.map(({ name, partNumber, scheduleId, componentId }) => ({
      name,
      partNumber,
      scheduleId,
      componentId,
    })),
  };
}
