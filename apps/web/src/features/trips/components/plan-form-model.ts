import {
  checkPlan,
  type CreateTripPlanValues,
  type FuelSummary,
  type TripPlan,
  tripPlanFieldsSchema,
} from "@automate/shared";

import type { TripStopFormValues } from "@/features/trips/components/trip-form-model";

/**
 * Form state: strings in the inputs. The places fields share the trip form's names, so the trip
 * form's places and route pieces work here unchanged.
 */
export type PlanFormValues = {
  vehicleId: string;
  categoryId: string;
  title: string;
  date: string;
  endDate: string;
  startTime: string;
  method: "DISTANCE" | "ROUTE";
  plannedDistanceKm: string;
  origin: string;
  destination: string;
  originLat: number | null;
  originLng: number | null;
  destinationLat: number | null;
  destinationLng: number | null;
  stops: TripStopFormValues[];
  routeIndex: number;
  estMileage: string;
  estFuelPrice: string;
  estToll: string;
  estParking: string;
  estAccommodation: string;
  estOther: string;
  notes: string;
};

export const planFormSchema = tripPlanFieldsSchema.omit({ id: true }).superRefine(checkPlan);
export type PlanFormOutput = Omit<CreateTripPlanValues, "id">;

const text = (value: number | string | null | undefined) => (value == null ? "" : String(value));
const twoDecimals = (value: string | null | undefined) => (value ? Number(value).toFixed(2) : "");

/** A new plan: assumptions start from the vehicle's own fuel figures, when it has them. */
export function newPlanForm(
  date: string,
  vehicleId: string,
  fuel?: Pick<FuelSummary, "averageMileage" | "averagePrice">,
): PlanFormValues {
  return {
    vehicleId,
    categoryId: "",
    title: "",
    date,
    endDate: "",
    startTime: "",
    method: "DISTANCE",
    plannedDistanceKm: "",
    origin: "",
    destination: "",
    originLat: null,
    originLng: null,
    destinationLat: null,
    destinationLng: null,
    stops: [],
    routeIndex: 0,
    estMileage: twoDecimals(fuel?.averageMileage),
    estFuelPrice: twoDecimals(fuel?.averagePrice),
    estToll: "",
    estParking: "",
    estAccommodation: "",
    estOther: "",
    notes: "",
  };
}

export function editPlanForm(plan: TripPlan): PlanFormValues {
  return {
    vehicleId: plan.vehicleId,
    categoryId: plan.category.id,
    title: text(plan.title),
    date: plan.date,
    endDate: text(plan.endDate),
    startTime: text(plan.startTime),
    method: plan.method,
    plannedDistanceKm: text(plan.plannedDistanceKm),
    origin: text(plan.origin),
    destination: text(plan.destination),
    originLat: plan.originPoint?.latitude ?? null,
    originLng: plan.originPoint?.longitude ?? null,
    destinationLat: plan.destinationPoint?.latitude ?? null,
    destinationLng: plan.destinationPoint?.longitude ?? null,
    stops: plan.stops.map((stop) => ({
      label: stop.label,
      latitude: stop.latitude,
      longitude: stop.longitude,
      arrivalTime: text(stop.arrivalTime),
      departureTime: text(stop.departureTime),
      notes: text(stop.notes),
      day: stop.day,
      overnight: stop.overnight,
    })),
    routeIndex: 0,
    estMileage: text(plan.estMileage),
    estFuelPrice: text(plan.estFuelPrice),
    estToll: text(plan.estToll),
    estParking: text(plan.estParking),
    estAccommodation: text(plan.estAccommodation),
    estOther: text(plan.estOther),
    notes: text(plan.notes),
  };
}
