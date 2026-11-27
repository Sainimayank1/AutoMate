import {
  checkInspection,
  type Inspection,
  INSPECTION_TEMPLATES,
  type InspectionArea,
  type InspectionCondition,
  inspectionFieldsSchema,
  type InspectionKind,
  type InspectionTemplateKey,
} from "@automate/shared";
import type { z } from "zod";

export type InspectionItemValues = {
  /** The saved item's id, kept on edit so a schedule following it up stays linked. */
  id?: string;
  area: InspectionArea;
  label: string;
  condition: InspectionCondition;
  notes: string;
  recommendedAction: string;
  componentId: string;
};

/** Form state: inputs hold strings; `inspectionFormSchema` turns them into the API payload. */
export type InspectionFormValues = {
  kind: InspectionKind;
  templateKey: InspectionTemplateKey;
  title: string;
  date: string;
  odometerKm: string;
  inspector: string;
  providerName: string;
  followUpDate: string;
  notes: string;
  items: InspectionItemValues[];
};

export const inspectionFormSchema = inspectionFieldsSchema
  .omit({ id: true })
  .superRefine(checkInspection);
export type InspectionFormOutput = z.output<typeof inspectionFormSchema>;

const text = (value: number | string | null) => (value == null ? "" : String(value));

/** Unchecked until the user sets a condition. */
export const newItem = (area: InspectionArea, label = ""): InspectionItemValues => ({
  area,
  label,
  condition: "NOT_INSPECTED",
  notes: "",
  recommendedAction: "",
  componentId: "",
});

function template(key: InspectionTemplateKey) {
  const found: { name: string; items: readonly (readonly [InspectionArea, string])[] } =
    INSPECTION_TEMPLATES.find((item) => item.key === key)!;
  return found;
}
export const templateName = (key: InspectionTemplateKey) => template(key).name;
export const templateItems = (key: InspectionTemplateKey) =>
  template(key).items.map(([area, label]) => newItem(area, label));

export function newInspectionForm(today: string): InspectionFormValues {
  return {
    kind: "SELF_CHECK",
    templateKey: "QUICK",
    title: templateName("QUICK"),
    date: today,
    odometerKm: "",
    inspector: "",
    providerName: "",
    followUpDate: "",
    notes: "",
    items: templateItems("QUICK"),
  };
}

export function editInspectionForm(inspection: Inspection): InspectionFormValues {
  return {
    kind: inspection.kind,
    templateKey: inspection.templateKey,
    title: inspection.title,
    date: inspection.date,
    odometerKm: text(inspection.odometerKm),
    inspector: text(inspection.inspector),
    providerName: text(inspection.provider?.name ?? null),
    followUpDate: text(inspection.followUpDate),
    notes: text(inspection.notes),
    items: inspection.items.map((item) => ({
      id: item.id,
      area: item.area,
      label: item.label,
      condition: item.condition,
      notes: text(item.notes),
      recommendedAction: text(item.recommendedAction),
      componentId: text(item.componentId),
    })),
  };
}
