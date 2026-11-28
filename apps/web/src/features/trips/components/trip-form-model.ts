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
  originLat: number | null;
  originLng: number | null;
  destinationLat: number | null;
  destinationLng: number | null;
  stops: TripStopFormValues[];
  /** Method ROUTE: the chosen route (0 = the provider's best). */
  routeIndex: number;
  notes: string;
};

export type TripStopFormValues = {
  label: string;
  latitude: number | null;
  longitude: number | null;
  arrivalTime: string;
  departureTime: string;
  notes?: string;
  /** Set in the itinerary; carried through the forms unchanged. */
  day?: number | null;
  overnight?: boolean;
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
    originLat: null,
    originLng: null,
    destinationLat: null,
    destinationLng: null,
    stops: [],
    routeIndex: 0,
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
    originLat: trip.originPoint?.latitude ?? null,
    originLng: trip.originPoint?.longitude ?? null,
    destinationLat: trip.destinationPoint?.latitude ?? null,
    destinationLng: trip.destinationPoint?.longitude ?? null,
    stops: trip.stops.map((stop) => ({
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
