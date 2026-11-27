import type { ProviderProfile, ProviderType } from "@automate/shared";

/** Form state: inputs hold strings; the shared schema turns blanks into nulls. */
export type WorkshopFormValues = {
  name: string;
  type: ProviderType;
  phone: string;
  email: string;
  address: string;
  city: string;
  preferred: boolean;
  notes: string;
};

export const workshopForm = (workshop?: ProviderProfile): WorkshopFormValues => ({
  name: workshop?.name ?? "",
  type: workshop?.type ?? "OTHER",
  phone: workshop?.phone ?? "",
  email: workshop?.email ?? "",
  address: workshop?.address ?? "",
  city: workshop?.city ?? "",
  preferred: workshop?.preferred ?? false,
  notes: workshop?.notes ?? "",
});
