import {
  checkTrip,
  type CreateTripValues,
  type Trip,
  tripFieldsSchema,
  type TripMethod,
} from "@automate/shared";

/** Form state: inputs hold strings; `tripFormSchema` turns them into the API payload. */
export type TripFormValues = {
  vehicleId: string;
  method: TripMethod;
  categoryId: string;
  title: string;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  startKm: string;
  endKm: string;
  distanceKm: string;
  origin: string;
  destination: string;
  notes: string;
};

export const tripFormSchema = tripFieldsSchema.omit({ id: true }).superRefine(checkTrip);
export type TripFormOutput = Omit<CreateTripValues, "id">;

const text = (value: number | string | null | undefined) => (value == null ? "" : String(value));

/** A new trip: today, from the vehicle's current odometer. */
export function newTripForm(today: string, vehicleId: string, odometerKm?: number): TripFormValues {
  return {
    vehicleId,
    method: "ODOMETER",
    categoryId: "",
    title: "",
    date: today,
    endDate: "",
    startTime: "",
    endTime: "",
    startKm: text(odometerKm),
    endKm: "",
    distanceKm: "",
    origin: "",
    destination: "",
    notes: "",
  };
}

export function editTripForm(trip: Trip): TripFormValues {
  return {
    vehicleId: trip.vehicleId,
    method: trip.method,
    categoryId: trip.category.id,
    title: text(trip.title),
    date: trip.date,
    endDate: text(trip.endDate),
    startTime: text(trip.startTime),
    endTime: text(trip.endTime),
    startKm: text(trip.startKm),
    endKm: text(trip.endKm),
    distanceKm: trip.method === "DISTANCE" ? trip.distanceKm : "",
    origin: text(trip.origin),
    destination: text(trip.destination),
    notes: text(trip.notes),
  };
}

/** A copy for a new trip: the same route and type, a new date and readings. */
export function duplicateTripForm(trip: Trip, today: string, odometerKm?: number): TripFormValues {
  return {
    ...editTripForm(trip),
    date: today,
    endDate: "",
    startKm: trip.method === "ODOMETER" ? text(odometerKm) : "",
    endKm: "",
  };
}
