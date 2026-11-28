import { z } from "zod";

import { paginationQuerySchema } from "../api/pagination.js";
import {
  blankToNull,
  latestAllowedDate,
  optionalDate,
  optionalDecimal,
  optionalInt,
  optionalText,
  positiveDecimal,
} from "../common/fields.js";
import { PaymentMethod } from "../common/payment-method.js";
import { fromPaise, toPaise } from "../expenses/expense.schema.js";
import { checkPeriodQuery, type PeriodWindow, periodQueryFields } from "../common/periods.js";
import { type FuelType, ODOMETER_MAX_KM } from "../vehicles/vehicle.schema.js";

/** Trips contract (module 7). Rules: docs/architecture/trips.md. */

/** How the distance is known: two odometer readings, entered, or a provider's route. */
export const TripMethod = { ODOMETER: "ODOMETER", DISTANCE: "DISTANCE", ROUTE: "ROUTE" } as const;
export type TripMethod = (typeof TripMethod)[keyof typeof TripMethod];

/** The default trip types every user has; users add their own beside them. */
export const SYSTEM_TRIP_CATEGORIES = [
  ["PERSONAL", "Personal"],
  ["COMMUTE", "Commute"],
  ["BUSINESS", "Business"],
  ["ROAD_TRIP", "Road trip"],
  ["ERRANDS", "Errands"],
  ["AIRPORT_RAILWAY", "Airport / railway"],
  ["OTHER", "Other"],
] as const;
export type SystemTripCategoryKey = (typeof SYSTEM_TRIP_CATEGORIES)[number][0];

/** A trip longer than this in a day is shown a "check the readings" warning (never refused). */
export const TRIP_DAY_KM_NOTICE = 1500;
export const TRIP_DISTANCE_MAX_KM = 99_999;

const odometer = (message: string) => optionalInt(0, ODOMETER_MAX_KM, message);
const time = z
  .preprocess(
    (value) => (value === "" ? null : value),
    z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time as HH:MM")
      .nullable(),
  )
  .optional();

const coordinate = (min: number, max: number) =>
  z.number({ error: "Choose a place from the search" }).min(min).max(max).nullable().optional();
const latitude = coordinate(-90, 90);
const longitude = coordinate(-180, 180);
export const TRIP_STOPS_MAX = 10;

/** A stop on the way, in order: a place (with coordinates when chosen from the search). */
export const tripStopSchema = z.object({
  label: z.string().trim().min(1, "Enter the place").max(120, "Use 120 characters or fewer"),
  latitude,
  longitude,
  arrivalTime: time,
  departureTime: time,
  notes: optionalText(300),
});

export const tripFieldsSchema = z.object({
  /** Optional client-generated id: a retried save returns the same trip. */
  id: z.uuid("Invalid id").optional(),
  vehicleId: z.uuid("Choose a vehicle"),
  method: z.enum(TripMethod, { error: "Choose how the distance is known" }),
  categoryId: z.uuid("Choose a trip type"),
  title: optionalText(80),
  date: z.iso
    .date("Enter the date")
    .refine((date) => date <= latestAllowedDate(), "This date is in the future"),
  /** Overnight and multi-day trips; the same day when empty. */
  endDate: optionalDate({ pastOnly: true }),
  startTime: time,
  endTime: time,
  startKm: odometer("Enter the starting odometer"),
  endKm: odometer("Enter the ending odometer"),
  /** Entered distance (method DISTANCE); computed from the readings otherwise. */
  distanceKm: optionalDecimal(5, 1, "Enter the distance in km"),
  origin: optionalText(120),
  destination: optionalText(120),
  originLat: latitude,
  originLng: longitude,
  destinationLat: latitude,
  destinationLng: longitude,
  /** Between origin and destination, in order (replaced whole on edit). */
  stops: z.array(tripStopSchema).max(TRIP_STOPS_MAX, `Up to ${TRIP_STOPS_MAX} stops`).optional(),
  /** Method ROUTE: which of the provider's routes (0 = its best). */
  routeIndex: z.number().int().min(0).max(2).optional(),
  notes: optionalText(1000),
});

type Place = { latitude?: number | null; longitude?: number | null };
type TripCheckInput = {
  origin?: string | null;
  destination?: string | null;
  originLat?: number | null;
  originLng?: number | null;
  destinationLat?: number | null;
  destinationLng?: number | null;
  stops?: (Place & { label?: string })[];
  method?: TripMethod;
  date?: string;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  startKm?: number | null;
  endKm?: number | null;
  distanceKm?: string | null;
};

/** The rules between fields. Run on whole trips only (the API merges a PATCH first). */
export function checkTrip(values: TripCheckInput, ctx: z.RefinementCtx) {
  const issue = (path: keyof TripCheckInput, message: string) =>
    ctx.addIssue({ code: "custom", path: [path], message });
  if (values.method === TripMethod.ODOMETER) {
    if (values.startKm == null) issue("startKm", "Enter the starting odometer");
    if (values.endKm == null) issue("endKm", "Enter the ending odometer");
    if (values.startKm != null && values.endKm != null && values.endKm <= values.startKm) {
      issue("endKm", "Must be more than the starting odometer");
    }
  }
  // A place's coordinates come as a pair (chosen from the search) or not at all.
  const pinned = (lat?: number | null, lng?: number | null) => lat != null && lng != null;
  const half = (lat?: number | null, lng?: number | null) => (lat == null) !== (lng == null);
  if (half(values.originLat, values.originLng)) issue("origin", "Choose the place again");
  if (half(values.destinationLat, values.destinationLng))
    issue("destination", "Choose the place again");
  if (values.method === TripMethod.ROUTE) {
    if (!pinned(values.originLat, values.originLng)) {
      issue("origin", "Choose where from in the search to get a route");
    }
    if (!pinned(values.destinationLat, values.destinationLng)) {
      issue("destination", "Choose where to in the search to get a route");
    }
    values.stops?.forEach((stop, index) => {
      if (!pinned(stop.latitude, stop.longitude)) {
        ctx.addIssue({
          code: "custom",
          path: ["stops", index, "label"],
          message: "Choose this stop in the search to get a route",
        });
      }
    });
  }
  if (values.method === TripMethod.DISTANCE) {
    if (values.distanceKm == null || !/[1-9]/.test(values.distanceKm)) {
      issue("distanceKm", "Enter the distance in km");
    } else if (Number(values.distanceKm) > TRIP_DISTANCE_MAX_KM) {
      issue("distanceKm", "That's too far for one trip");
    }
  }
  if (values.date && values.endDate && values.endDate < values.date) {
    issue("endDate", "Ends before it starts");
  }
  const sameDay = !values.endDate || values.endDate === values.date;
  if (sameDay && values.startTime && values.endTime && values.endTime < values.startTime) {
    issue("endTime", "Ends before it starts");
  }
}

/** km of a trip: end − start from the readings, or as entered. Null until it's known. */
export function tripDistance(values: {
  method?: TripMethod;
  startKm?: number | null;
  endKm?: number | null;
  distanceKm?: string | null;
}): string | null {
  if (values.method === TripMethod.ODOMETER) {
    return values.startKm != null && values.endKm != null && values.endKm > values.startKm
      ? String(values.endKm - values.startKm)
      : null;
  }
  return values.distanceKm && /[1-9]/.test(values.distanceKm) ? values.distanceKm : null;
}

/** The title when set, else "From → To", else whichever end is known, else "<Type> trip". */
export function tripLabel(trip: {
  title: string | null;
  origin: string | null;
  destination: string | null;
  category: { name: string };
}): string {
  if (trip.title) return trip.title;
  if (trip.origin && trip.destination) return `${trip.origin} → ${trip.destination}`;
  return trip.destination ?? trip.origin ?? `${trip.category.name} trip`;
}

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/** Minutes from start to end, across days; null unless both times are known. */
export function tripDurationMinutes(values: {
  date?: string;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
}): number | null {
  if (!values.date || !values.startTime || !values.endTime) return null;
  const days = values.endDate
    ? Math.round((Date.parse(values.endDate) - Date.parse(values.date)) / 86_400_000)
    : 0;
  const minutes = days * 1440 + minutesOf(values.endTime) - minutesOf(values.startTime);
  return minutes >= 0 ? minutes : null;
}

export const createTripSchema = tripFieldsSchema.superRefine(checkTrip);
/** PATCH: the vehicle can't change (delete and log it again). The API re-checks the whole trip. */
export const updateTripSchema = tripFieldsSchema.omit({ id: true, vehicleId: true }).partial();

export const TripSort = {
  NEWEST: "newest",
  OLDEST: "oldest",
  LONGEST: "longest",
  SHORTEST: "shortest",
} as const;
export type TripSort = (typeof TripSort)[keyof typeof TripSort];

const distanceFilter = optionalDecimal(5, 1, "Enter a distance in km, e.g. 100");

/** History filters, applied on the server before paging (the list and its summary). */
export const tripFilterFields = {
  vehicleId: z.uuid().optional(),
  /** Title, origin, destination and notes. */
  search: z.string().trim().max(80).optional(),
  from: z.iso.date("Enter a valid date").optional(),
  to: z.iso.date("Enter a valid date").optional(),
  categoryId: z.uuid().optional(),
  method: z.enum(TripMethod).optional(),
  minKm: distanceFilter,
  maxKm: distanceFilter,
  origin: z.string().trim().max(120).optional(),
  destination: z.string().trim().max(120).optional(),
};

function checkTripFilters(
  value: { from?: string; to?: string; minKm?: string | null; maxKm?: string | null },
  ctx: z.RefinementCtx,
) {
  if (value.from && value.to && value.from > value.to) {
    ctx.addIssue({ code: "custom", path: ["to"], message: "Ends before it starts" });
  }
  if (value.minKm && value.maxKm && Number(value.minKm) > Number(value.maxKm)) {
    ctx.addIssue({ code: "custom", path: ["maxKm"], message: "Below the minimum" });
  }
}

export const tripFiltersSchema = z.object(tripFilterFields).superRefine(checkTripFilters);
export const tripListQuerySchema = paginationQuerySchema
  .extend({ ...tripFilterFields, sort: z.enum(TripSort).default(TripSort.NEWEST) })
  .superRefine(checkTripFilters);

/** `POST /trips/bulk`: delete trips, or move them to another type, all or none. */
export const tripBulkSchema = z
  .object({
    action: z.enum(["delete", "category"]),
    ids: z.array(z.uuid()).min(1, "Choose trips").max(100, "Up to 100 at a time"),
    /** The type to move them to (action "category"). */
    categoryId: z.uuid("Choose a trip type").optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action === "category" && !value.categoryId) {
      ctx.addIssue({ code: "custom", path: ["categoryId"], message: "Choose a trip type" });
    }
  });

export const TripGranularity = { DAY: "day", WEEK: "week", MONTH: "month" } as const;
export type TripGranularity = (typeof TripGranularity)[keyof typeof TripGranularity];

/** `GET /trips/overview`: one vehicle, or all of the user's when `vehicleId` is left out. */
export const tripOverviewQuerySchema = z
  .object({
    vehicleId: z.uuid().optional(),
    ...periodQueryFields,
    granularity: z.enum(TripGranularity).optional(),
  })
  .superRefine(checkPeriodQuery);

export const tripCategoryFieldsSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(40, "Use 40 characters or fewer"),
});

// ---- trip costs

export const TripCostCategory = {
  TOLL: "TOLL",
  PARKING: "PARKING",
  FOOD: "FOOD",
  ACCOMMODATION: "ACCOMMODATION",
  OTHER: "OTHER",
} as const;
export type TripCostCategory = (typeof TripCostCategory)[keyof typeof TripCostCategory];

/**
 * Costs that are also the vehicle's expenses (linked, source TRIP), and their expense category.
 * Food and accommodation stay with the trip: they aren't costs of owning the vehicle.
 */
export const TRIP_COST_EXPENSE: Partial<
  Record<TripCostCategory, { categoryKey: string; subcategoryKey: string | null }>
> = {
  TOLL: { categoryKey: "DAILY_USAGE", subcategoryKey: "DAILY_USAGE.TOLL" },
  PARKING: { categoryKey: "DAILY_USAGE", subcategoryKey: "DAILY_USAGE.PARKING" },
  OTHER: { categoryKey: "OTHER", subcategoryKey: "OTHER.MISC" },
};

export const tripCostFieldsSchema = z.object({
  /** Optional client-generated id: a retried save returns the same cost. */
  id: z.uuid("Invalid id").optional(),
  category: z.enum(TripCostCategory, { error: "Choose what it was for" }),
  amount: positiveDecimal(10, 2, "Enter the amount, e.g. 240"),
  date: z.iso
    .date("Enter the date")
    .refine((date) => date <= latestAllowedDate(), "This date is in the future"),
  vendor: optionalText(120),
  paymentMethod: z
    .preprocess(blankToNull, z.enum(PaymentMethod, { error: "Choose a payment method" }).nullable())
    .optional(),
  notes: optionalText(500),
});
export const createTripCostSchema = tripCostFieldsSchema;
export const updateTripCostSchema = tripCostFieldsSchema.omit({ id: true }).partial();
export const linkFuelEntrySchema = z.object({ fuelEntryId: z.uuid("Choose a fill-up") });

/** `GET /trip-costs`: costs across trips by their date, newest first. */
export const tripCostListQuerySchema = paginationQuerySchema
  .extend({
    vehicleId: z.uuid().optional(),
    ...periodQueryFields,
    category: z.enum(TripCostCategory).optional(),
  })
  .superRefine(checkPeriodQuery);
export const tripCostSummaryQuerySchema = z
  .object({ vehicleId: z.uuid().optional(), ...periodQueryFields })
  .superRefine(checkPeriodQuery);

export type CreateTripCostValues = z.output<typeof createTripCostSchema>;
export type UpdateTripCostValues = z.output<typeof updateTripCostSchema>;
export type TripCostListQuery = z.output<typeof tripCostListQuerySchema>;
export type TripCostSummaryQuery = z.output<typeof tripCostSummaryQuerySchema>;

// ---- planned trips

/** A trip's life: planned (a draft or a plan), done, or called off. Only done trips count. */
export const TripStatus = {
  DRAFT: "DRAFT",
  PLANNED: "PLANNED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type TripStatus = (typeof TripStatus)[keyof typeof TripStatus];

const estimate = (message: string) => optionalDecimal(10, 2, message);

/**
 * A plan: where, when, the planned distance (entered, or from a route) and the budget's
 * assumptions and estimates. Estimates are never spending; completing turns it into a trip.
 */
export const tripPlanFieldsSchema = z.object({
  id: z.uuid("Invalid id").optional(),
  vehicleId: z.uuid("Choose a vehicle"),
  status: z.enum(["DRAFT", "PLANNED"]).optional(),
  categoryId: z.uuid("Choose a trip type"),
  title: optionalText(80),
  /** Departure; any date (plans are usually ahead). */
  date: z.iso.date("Enter the departure date"),
  /** Return or last day. */
  endDate: optionalDate({ pastOnly: false }),
  startTime: time,
  /** DISTANCE: planned distance entered; ROUTE: measured on the provider's route. */
  method: z.enum(["DISTANCE", "ROUTE"]).optional(),
  plannedDistanceKm: optionalDecimal(5, 1, "Enter the distance in km"),
  plannedDurationMinutes: optionalInt(0, 60 * 24 * 60, "Enter the duration in minutes"),
  origin: optionalText(120),
  destination: optionalText(120),
  originLat: latitude,
  originLng: longitude,
  destinationLat: latitude,
  destinationLng: longitude,
  stops: z.array(tripStopSchema).max(TRIP_STOPS_MAX, `Up to ${TRIP_STOPS_MAX} stops`).optional(),
  routeIndex: z.number().int().min(0).max(2).optional(),
  /** Assumptions: the vehicle's mileage (km per L, kg or kWh) and fuel price per unit. */
  estMileage: optionalDecimal(3, 2, "Enter the mileage, e.g. 18.5"),
  estFuelPrice: optionalDecimal(5, 2, "Enter the price, e.g. 104.32"),
  estToll: estimate("Enter the toll estimate"),
  estParking: estimate("Enter the parking estimate"),
  estAccommodation: estimate("Enter the stay estimate"),
  estOther: estimate("Enter other costs"),
  notes: optionalText(1000),
});

/** Dates in order; a route plan needs its places chosen from the search (as trips). */
export function checkPlan(
  values: z.output<typeof tripPlanFieldsSchema> | Partial<z.output<typeof tripPlanFieldsSchema>>,
  ctx: z.RefinementCtx,
) {
  if (values.date && values.endDate && values.endDate < values.date) {
    ctx.addIssue({ code: "custom", path: ["endDate"], message: "Before the departure" });
  }
  if (values.method === "ROUTE") {
    checkTrip({ ...values, method: TripMethod.ROUTE, distanceKm: null }, ctx);
  }
}

export const createTripPlanSchema = tripPlanFieldsSchema.superRefine(checkPlan);
/** PATCH: the vehicle can't change; the API re-checks the whole plan. */
export const updateTripPlanSchema = tripPlanFieldsSchema
  .omit({ id: true, vehicleId: true })
  .partial();
/** `GET /trip-plans`: upcoming (drafts and plans, soonest first) or cancelled (latest first). */
export const tripPlanListQuerySchema = paginationQuerySchema.extend({
  vehicleId: z.uuid().optional(),
  view: z.enum(["upcoming", "cancelled"]).default("upcoming"),
});

/**
 * `POST /trip-plans/:id/complete`: what actually happened. The plan's places, type and notes
 * carry over unless sent; the plan's figures stay for planned vs actual.
 */
export const completeTripPlanSchema = tripFieldsSchema
  .pick({
    method: true,
    date: true,
    endDate: true,
    startTime: true,
    endTime: true,
    startKm: true,
    endKm: true,
    distanceKm: true,
    routeIndex: true,
    notes: true,
  })
  .partial()
  .required({ method: true, date: true });
export type CompleteTripPlanValues = z.output<typeof completeTripPlanSchema>;

export type CreateTripPlanValues = z.output<typeof createTripPlanSchema>;
export type UpdateTripPlanValues = z.output<typeof updateTripPlanSchema>;
export type TripPlanListQuery = z.output<typeof tripPlanListQuerySchema>;

/**
 * A plan's budget from its distance and assumptions, in exact paise (integer maths, one
 * rounding): fuel = distance ÷ mileage × price; total = fuel + toll + parking + stay + other.
 * Unknown parts are left out (and said so by being null), never guessed.
 */
export function planBudget(plan: {
  plannedDistanceKm?: string | null;
  estMileage?: string | null;
  estFuelPrice?: string | null;
  estToll?: string | null;
  estParking?: string | null;
  estAccommodation?: string | null;
  estOther?: string | null;
}): {
  fuelQuantity: string | null;
  fuelCost: string | null;
  total: string | null;
  perKm: string | null;
} {
  // Tenths of a km and hundredths of a km per unit, as integers.
  const tenths = plan.plannedDistanceKm ? Math.round(Number(plan.plannedDistanceKm) * 10) : null;
  const mileage = plan.estMileage ? Math.round(Number(plan.estMileage) * 100) : null;
  const fuel = tenths && mileage ? (tenths * 10) / mileage : null;
  const fuelCost =
    tenths && mileage && plan.estFuelPrice
      ? Math.round((tenths * toPaise(plan.estFuelPrice) * 10) / mileage)
      : null;
  const parts = [plan.estToll, plan.estParking, plan.estAccommodation, plan.estOther]
    .filter((part): part is string => !!part)
    .map(toPaise);
  const known = fuelCost !== null || parts.length > 0;
  const total = (fuelCost ?? 0) + parts.reduce((sum, part) => sum + part, 0);
  return {
    fuelQuantity: fuel === null ? null : fuel.toFixed(1),
    fuelCost: fuelCost === null ? null : fromPaise(fuelCost),
    total: known ? fromPaise(total) : null,
    perKm: known && tenths ? fromPaise(Math.round((total * 10) / tenths)) : null,
  };
}

export type CreateTripValues = z.output<typeof createTripSchema>;
export type UpdateTripValues = z.output<typeof updateTripSchema>;
export type TripListQuery = z.output<typeof tripListQuerySchema>;
export type TripFilters = z.output<typeof tripFiltersSchema>;
export type TripBulkValues = z.output<typeof tripBulkSchema>;
export type TripOverviewQuery = z.output<typeof tripOverviewQuerySchema>;
export type TripCategoryValues = z.output<typeof tripCategoryFieldsSchema>;

// ---- responses

export interface TripCategory {
  id: string;
  /** System types only ("COMMUTE"); null for the user's own. */
  key: SystemTripCategoryKey | null;
  name: string;
  archivedAt: string | null;
}

export interface Trip {
  id: string;
  vehicleId: string;
  method: TripMethod;
  category: Pick<TripCategory, "id" | "key" | "name">;
  title: string | null;
  date: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  startKm: number | null;
  endKm: number | null;
  /** Always set: from the readings, or as entered. One decimal, as a string. */
  distanceKm: string;
  /** Only when both times are known. */
  durationMinutes: number | null;
  origin: string | null;
  destination: string | null;
  notes: string | null;
  /** Coordinates when the place was chosen from the search. */
  originPoint: { latitude: number; longitude: number } | null;
  destinationPoint: { latitude: number; longitude: number } | null;
  stops: TripStop[];
  /** Method ROUTE: the provider's route it was measured on (never drawn otherwise). */
  route: { provider: string; distanceKm: string; durationMinutes: number; geometry: string } | null;
  /** Recorded costs plus linked fill-ups; null when none is recorded (never 0 for "unknown"). */
  actualCost: string | null;
  /** A trip done from a plan keeps the plan's figures (planned vs actual). */
  plan: { distanceKm: string | null; durationMinutes: number | null; budget: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

export interface TripPlan {
  id: string;
  vehicleId: string;
  status: TripStatus;
  category: Pick<TripCategory, "id" | "key" | "name">;
  title: string | null;
  date: string;
  endDate: string | null;
  startTime: string | null;
  method: "DISTANCE" | "ROUTE";
  plannedDistanceKm: string | null;
  plannedDurationMinutes: number | null;
  origin: string | null;
  destination: string | null;
  originPoint: { latitude: number; longitude: number } | null;
  destinationPoint: { latitude: number; longitude: number } | null;
  stops: TripStop[];
  route: { provider: string; distanceKm: string; durationMinutes: number; geometry: string } | null;
  estMileage: string | null;
  estFuelPrice: string | null;
  estToll: string | null;
  estParking: string | null;
  estAccommodation: string | null;
  estOther: string | null;
  /** Computed (`planBudget`); estimates, never spending. */
  budget: ReturnType<typeof planBudget>;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TripStop {
  id: string;
  label: string;
  latitude: number | null;
  longitude: number | null;
  arrivalTime: string | null;
  departureTime: string | null;
  notes: string | null;
}

export interface TripCost {
  id: string;
  tripId: string;
  vehicleId: string;
  category: TripCostCategory;
  amount: string;
  date: string;
  vendor: string | null;
  paymentMethod: PaymentMethod | null;
  notes: string | null;
  /** Its linked expense (toll, parking, other); null for trip-only costs. */
  expenseId: string | null;
  /** The trip it belongs to (for lists across trips). */
  trip: { id: string; label: string; date: string };
  createdAt: string;
  updatedAt: string;
}

/** A fill-up linked to a trip: its actual fuel. Fuel owns it; Trips only shows it. */
export interface TripFuelEntry {
  id: string;
  filledAt: string;
  station: string | null;
  quantity: string;
  totalAmount: string;
}

/** A trip's money: actual (recorded costs and linked fill-ups) apart from the estimate. */
export interface TripSpending {
  /** Null when nothing is recorded. */
  actual: string | null;
  /** "FUEL" is the linked fill-ups. Largest first. */
  byCategory: { category: TripCostCategory | "FUEL"; amount: string }[];
  /** Only when both the actual cost and the distance are known. */
  perKm: string | null;
  fuelEntries: number;
  /** From the Fuel module's average mileage and price; never counted as spending. */
  estimate: {
    fuelType: FuelType;
    quantity: string;
    cost: string | null;
    mileage: string;
    price: string | null;
  } | null;
}

/** The Costs tab: actual trip costs in a period (by their date), linked fuel included. */
export interface TripCostsSummary {
  period: PeriodWindow;
  vehicleId: string | null;
  total: string;
  byCategory: { category: TripCostCategory | "FUEL"; amount: string }[];
  /** Over the trips (in the period) that have a cost. */
  perKm: string | null;
}

/** The filtered history's count and distance (every page). */
export interface TripSummary {
  trips: number;
  distanceKm: string;
}

export interface TripOverview {
  period: PeriodWindow;
  /** Null for all vehicles. */
  vehicleId: string | null;
  trips: number;
  distanceKm: string;
  averageKm: string | null;
  longest: { id: string; distanceKm: string; label: string } | null;
  /** Over the trips with both times; null when none has them. */
  drivingMinutes: number | null;
  timedTrips: number;
  /** Trips per week across the period (null for a period under a week with no trips). */
  perWeek: string | null;
  byCategory: {
    categoryId: string;
    key: SystemTripCategoryKey | null;
    name: string;
    trips: number;
    distanceKm: string;
  }[];
  series: {
    granularity: TripGranularity;
    points: { start: string; distanceKm: string; trips: number }[];
  };
  /** Actual costs of the period's trips; per km over the trips that have a cost. */
  cost: { total: string | null; perKm: string | null };
  recent: Trip[];
}
