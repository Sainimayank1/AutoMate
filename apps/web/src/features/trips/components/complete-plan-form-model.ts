import {
  checkTrip,
  completeTripPlanSchema,
  type CompleteTripPlanValues,
  type TripPlan,
} from "@automate/shared";

export type CompletePlanFormValues = {
  method: "ODOMETER" | "DISTANCE" | "ROUTE";
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  startKm: string;
  endKm: string;
  distanceKm: string;
};

/** A route plan done as planned needs nothing more; readings and distances are checked as trips. */
export const completePlanSchema = completeTripPlanSchema.superRefine((values, ctx) => {
  if (values.method !== "ROUTE") checkTrip(values, ctx);
});
export type CompletePlanOutput = CompleteTripPlanValues;

/**
 * What actually happened, prefilled from the plan: its dates when they're past (else today), the
 * odometer from the vehicle, the planned distance for an entered one. Every figure stays editable.
 */
export function completePlanForm(
  plan: TripPlan,
  today: string,
  odometerKm?: number,
): CompletePlanFormValues {
  const past = plan.date <= today;
  return {
    method: plan.method === "ROUTE" ? "ROUTE" : "ODOMETER",
    date: past ? plan.date : today,
    endDate: past && plan.endDate && plan.endDate <= today ? plan.endDate : "",
    startTime: "",
    endTime: "",
    startKm: odometerKm == null ? "" : String(odometerKm),
    endKm: "",
    distanceKm: plan.plannedDistanceKm ?? "",
  };
}
