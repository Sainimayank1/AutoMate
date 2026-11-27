import {
  type ComponentCondition,
  ComponentCondition as Condition,
  type ComponentKind,
  type VehicleComponent,
} from "@automate/shared";

export type ComponentFormValues = {
  kind: ComponentKind | "";
  name: string;
  position: string;
  brand: string;
  partNumber: string;
  installedAt: string;
  installedKm: string;
  providerName: string;
  condition: ComponentCondition;
  expectedLifeKm: string;
  expectedLifeMonths: string;
  warrantyUntil: string;
  warrantyKm: string;
  notes: string;
};

const text = (value: number | string | null) => (value == null ? "" : String(value));

export const newComponentForm = (): ComponentFormValues => ({
  kind: "",
  name: "",
  position: "",
  brand: "",
  partNumber: "",
  installedAt: "",
  installedKm: "",
  providerName: "",
  condition: Condition.UNKNOWN,
  expectedLifeKm: "",
  expectedLifeMonths: "",
  warrantyUntil: "",
  warrantyKm: "",
  notes: "",
});

export const editComponentForm = (part: VehicleComponent): ComponentFormValues => ({
  kind: part.kind,
  name: part.name,
  position: text(part.position),
  brand: text(part.brand),
  partNumber: text(part.partNumber),
  installedAt: text(part.installedAt),
  installedKm: text(part.installedKm),
  providerName: text(part.provider?.name ?? null),
  condition: part.condition,
  expectedLifeKm: text(part.expectedLifeKm),
  expectedLifeMonths: text(part.expectedLifeMonths),
  warrantyUntil: text(part.warrantyUntil),
  warrantyKm: text(part.warrantyKm),
  notes: text(part.notes),
});
