import {
  breakdownTotal,
  checkServiceRecord,
  type MaintenanceCategoryKey,
  type MaintenanceSchedule,
  type PaymentMethod,
  type ServiceRecord,
  serviceRecordFieldsSchema,
  ServiceRecordType,
} from "@automate/shared";
import type { z } from "zod";

export type RecordItemValues = { name: string; partNumber: string; scheduleId: string };

/** Form state: inputs hold strings; `recordFormSchema` turns them into the API payload. */
export type RecordFormValues = {
  type: ServiceRecordType;
  title: string;
  categoryKey: MaintenanceCategoryKey | "";
  serviceDate: string;
  odometerKm: string;
  providerName: string;
  technician: string;
  items: RecordItemValues[];
  labourAmount: string;
  partsAmount: string;
  otherAmount: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  paymentMethod: PaymentMethod | "";
  warrantyUntil: string;
  warrantyNotes: string;
  description: string;
  notes: string;
};

/**
 * The shared rules. With a breakdown the total is computed (the API stores that), so the typed
 * total is dropped rather than checked against it.
 */
export const recordFormSchema = serviceRecordFieldsSchema
  .omit({ id: true })
  .transform((values) =>
    breakdownTotal(values) !== null ? { ...values, totalAmount: null } : values,
  )
  .superRefine(checkServiceRecord);
export type RecordFormOutput = z.output<typeof recordFormSchema>;

const text = (value: number | string | null | undefined) => (value == null ? "" : String(value));

export function newRecordForm(today: string, schedule?: MaintenanceSchedule): RecordFormValues {
  return {
    type: ServiceRecordType.ROUTINE_SERVICE,
    title: schedule?.name ?? "",
    categoryKey: schedule?.categoryKey ?? "",
    serviceDate: today,
    odometerKm: "",
    providerName: "",
    technician: "",
    items: schedule ? [{ name: schedule.name, partNumber: "", scheduleId: schedule.id }] : [],
    labourAmount: "",
    partsAmount: "",
    otherAmount: "",
    taxAmount: "",
    discountAmount: "",
    totalAmount: "",
    paymentMethod: "",
    warrantyUntil: "",
    warrantyNotes: "",
    description: "",
    notes: "",
  };
}

export function editRecordForm(record: ServiceRecord): RecordFormValues {
  const breakdown = [
    record.labourAmount,
    record.partsAmount,
    record.otherAmount,
    record.taxAmount,
    record.discountAmount,
  ].some((value) => value !== null);
  return {
    type: record.type,
    title: record.title,
    categoryKey: record.categoryKey,
    serviceDate: record.serviceDate,
    odometerKm: text(record.odometerKm),
    providerName: text(record.provider?.name),
    technician: text(record.technician),
    items: record.items.map((item) => ({
      name: item.name,
      partNumber: text(item.partNumber),
      scheduleId: text(item.scheduleId),
    })),
    labourAmount: text(record.labourAmount),
    partsAmount: text(record.partsAmount),
    otherAmount: text(record.otherAmount),
    taxAmount: text(record.taxAmount),
    discountAmount: text(record.discountAmount),
    // Without a breakdown, the stored total is what was entered.
    totalAmount: breakdown || record.totalAmount === "0.00" ? "" : record.totalAmount,
    paymentMethod: record.paymentMethod ?? "",
    warrantyUntil: text(record.warrantyUntil),
    warrantyNotes: text(record.warrantyNotes),
    description: text(record.description),
    notes: text(record.notes),
  };
}
