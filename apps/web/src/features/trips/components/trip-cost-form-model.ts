import type { PaymentMethod, TripCost, TripCostCategory } from "@automate/shared";

export type TripCostFormValues = {
  category: TripCostCategory;
  amount: string;
  date: string;
  vendor: string;
  paymentMethod: PaymentMethod | "";
  notes: string;
};

export const tripCostForm = (date: string, cost?: TripCost): TripCostFormValues => ({
  category: cost?.category ?? "TOLL",
  amount: cost?.amount ?? "",
  date: cost?.date ?? date,
  vendor: cost?.vendor ?? "",
  paymentMethod: cost?.paymentMethod ?? "",
  notes: cost?.notes ?? "",
});
