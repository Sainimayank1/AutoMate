import {
  type Inspection,
  inspectionAreaCategory,
  type InspectionItem,
  type MaintenanceCategoryKey,
  type MaintenanceSchedule,
  scheduleFieldsSchema,
  type SchedulePriority,
} from "@automate/shared";
import { z } from "zod";

export type ScheduleKind = "REPEATS" | "ONCE";

/** Form state: inputs hold strings; `scheduleFormSchema` turns them into the API payload. */
export type ScheduleFormValues = {
  kind: ScheduleKind;
  name: string;
  categoryKey: MaintenanceCategoryKey | "";
  priority: SchedulePriority;
  intervalKm: string;
  intervalMonths: string;
  lastDoneDate: string;
  lastDoneKm: string;
  dueDate: string;
  dueKm: string;
  remindersEnabled: boolean;
  leadDays: string;
  leadKm: string;
  componentId: string;
  notes: string;
};

/**
 * The shared field rules plus the form's choice of kind. Switching kind empties the other kind's
 * inputs (see the form), and the output nulls them, so "Repeats" and "Once" are never sent together.
 * The API re-checks the whole schedule (`checkSchedule`).
 */
export const scheduleFormSchema = scheduleFieldsSchema
  .omit({ id: true })
  .extend({ kind: z.enum(["REPEATS", "ONCE"]) })
  .superRefine((values, ctx) => {
    if (values.kind === "REPEATS" && values.intervalKm == null && values.intervalMonths == null) {
      ctx.addIssue({
        code: "custom",
        path: ["intervalKm"],
        message: "Set an interval in km or months",
      });
    }
    if (values.kind === "ONCE" && values.dueDate == null && values.dueKm == null) {
      ctx.addIssue({
        code: "custom",
        path: ["dueDate"],
        message: "Set a due date or an odometer reading",
      });
    }
  })
  .transform(({ kind, ...values }) =>
    kind === "REPEATS"
      ? { ...values, dueDate: null, dueKm: null }
      : { ...values, intervalKm: null, intervalMonths: null, lastDoneDate: null, lastDoneKm: null },
  );
export type ScheduleFormOutput = z.output<typeof scheduleFormSchema>;

const text = (value: number | string | null) => (value == null ? "" : String(value));

export function newScheduleForm(): ScheduleFormValues {
  return {
    kind: "REPEATS",
    name: "",
    categoryKey: "",
    priority: "NORMAL",
    intervalKm: "",
    intervalMonths: "",
    lastDoneDate: "",
    lastDoneKm: "",
    dueDate: "",
    dueKm: "",
    remindersEnabled: true,
    leadDays: "",
    leadKm: "",
    componentId: "",
    notes: "",
  };
}

export function editScheduleForm(schedule: MaintenanceSchedule): ScheduleFormValues {
  const once = schedule.intervalKm == null && schedule.intervalMonths == null;
  return {
    kind: once ? "ONCE" : "REPEATS",
    name: schedule.name,
    categoryKey: schedule.categoryKey,
    priority: schedule.priority,
    intervalKm: text(schedule.intervalKm),
    intervalMonths: text(schedule.intervalMonths),
    lastDoneDate: text(schedule.lastDoneDate),
    lastDoneKm: text(schedule.lastDoneKm),
    dueDate: text(schedule.dueDate),
    dueKm: text(schedule.dueKm),
    remindersEnabled: schedule.remindersEnabled,
    leadDays: text(schedule.leadDays),
    leadKm: text(schedule.leadKm),
    componentId: schedule.component?.id ?? "",
    notes: text(schedule.notes),
  };
}

/** A one-time schedule following up an inspection finding, due on its follow-up date. */
export function scheduleFromFinding(
  inspection: Inspection,
  item: InspectionItem,
): ScheduleFormValues {
  return {
    ...newScheduleForm(),
    kind: "ONCE",
    name: (item.recommendedAction ?? item.label).slice(0, 80),
    categoryKey: inspectionAreaCategory(item.area),
    priority: item.condition === "REPLACE_SOON" ? "HIGH" : "NORMAL",
    dueDate: inspection.followUpDate ?? "",
    componentId: item.componentId ?? "",
    notes: [`${inspection.title}: ${item.label}`, item.notes].filter(Boolean).join(". "),
  };
}
