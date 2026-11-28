import type { ApiResponseSchemaHost } from "@nestjs/swagger";

type Schema = ApiResponseSchemaHost["schema"];

const category: Schema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    key: { type: "string", nullable: true, example: "COMMUTE" },
    name: { type: "string", example: "Commute" },
  },
};

export const TRIP_CATEGORY_SCHEMA: Schema = {
  type: "object",
  properties: {
    ...category.properties,
    archivedAt: { type: "string", format: "date-time", nullable: true },
  },
};

export const TRIP_SCHEMA: Schema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    vehicleId: { type: "string", format: "uuid" },
    method: { type: "string", enum: ["ODOMETER", "DISTANCE"] },
    category,
    title: { type: "string", nullable: true },
    date: { type: "string", format: "date" },
    endDate: { type: "string", format: "date", nullable: true },
    startTime: { type: "string", nullable: true, example: "06:10" },
    endTime: { type: "string", nullable: true, example: "10:22" },
    startKm: { type: "integer", nullable: true, example: 8732 },
    endKm: { type: "integer", nullable: true, example: 9000 },
    distanceKm: { type: "string", example: "268.0" },
    durationMinutes: { type: "integer", nullable: true, example: 252 },
    origin: { type: "string", nullable: true, example: "Gurugram" },
    destination: { type: "string", nullable: true, example: "Jaipur" },
    notes: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

const money = { type: "string", nullable: true, example: "1200.00" } as const;

export const TRIP_PLAN_SCHEMA: Schema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    vehicleId: { type: "string", format: "uuid" },
    status: { type: "string", enum: ["DRAFT", "PLANNED", "CANCELLED"] },
    category,
    title: { type: "string", nullable: true },
    date: { type: "string", format: "date" },
    endDate: { type: "string", format: "date", nullable: true },
    startTime: { type: "string", nullable: true, example: "06:00" },
    method: { type: "string", enum: ["DISTANCE", "ROUTE"] },
    plannedDistanceKm: { type: "string", nullable: true, example: "540.0" },
    plannedDurationMinutes: { type: "integer", nullable: true, example: 600 },
    origin: { type: "string", nullable: true, example: "Hisar" },
    destination: { type: "string", nullable: true, example: "Manali" },
    estMileage: { type: "string", nullable: true, example: "18.50" },
    estFuelPrice: { type: "string", nullable: true, example: "104.32" },
    estToll: money,
    estParking: money,
    estAccommodation: money,
    estOther: money,
    budget: {
      type: "object",
      description: "Estimates from the assumptions; unknown parts are null, never spending",
      properties: {
        fuelQuantity: { type: "string", nullable: true, example: "30.0" },
        fuelCost: money,
        total: money,
        perKm: money,
      },
    },
    notes: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

export const TRIP_OVERVIEW_SCHEMA: Schema = {
  type: "object",
  description: "Trips in the period (by start date), aggregated in the database",
  properties: {
    period: { type: "object" },
    vehicleId: { type: "string", format: "uuid", nullable: true },
    trips: { type: "integer" },
    distanceKm: { type: "string" },
    averageKm: { type: "string", nullable: true },
    longest: { type: "object", nullable: true },
    drivingMinutes: { type: "integer", nullable: true },
    timedTrips: { type: "integer" },
    perWeek: { type: "string", nullable: true },
    byCategory: { type: "array", items: { type: "object" } },
    series: { type: "object" },
    recent: { type: "array", items: TRIP_SCHEMA },
  },
};

export const TRIP_SUMMARY_SCHEMA: Schema = {
  type: "object",
  properties: {
    trips: { type: "integer", example: 18 },
    distanceKm: { type: "string", example: "1240.0" },
  },
};

export const TRIP_BULK_SCHEMA: Schema = {
  type: "object",
  properties: { count: { type: "integer", example: 3 } },
};

export const TRIP_COST_SCHEMA: Schema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    tripId: { type: "string", format: "uuid" },
    vehicleId: { type: "string", format: "uuid" },
    category: { type: "string", enum: ["TOLL", "PARKING", "FOOD", "ACCOMMODATION", "OTHER"] },
    amount: { type: "string", example: "240.00" },
    date: { type: "string", format: "date" },
    vendor: { type: "string", nullable: true, example: "Kherki Daula plaza" },
    paymentMethod: { type: "string", nullable: true, example: "UPI" },
    notes: { type: "string", nullable: true },
    expenseId: { type: "string", format: "uuid", nullable: true },
    trip: { type: "object" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

export const TRIP_FUEL_ENTRY_SCHEMA: Schema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    filledAt: { type: "string", format: "date-time" },
    station: { type: "string", nullable: true },
    quantity: { type: "string", example: "7.60" },
    totalAmount: { type: "string", example: "800.00" },
  },
};

export const TRIP_SPENDING_SCHEMA: Schema = {
  type: "object",
  description: "Actual (recorded costs and linked fill-ups) apart from the fuel estimate",
  properties: {
    actual: { type: "string", nullable: true },
    byCategory: { type: "array", items: { type: "object" } },
    perKm: { type: "string", nullable: true },
    fuelEntries: { type: "integer" },
    estimate: { type: "object", nullable: true },
  },
};

export const TRIP_COSTS_SUMMARY_SCHEMA: Schema = {
  type: "object",
  properties: {
    period: { type: "object" },
    vehicleId: { type: "string", format: "uuid", nullable: true },
    total: { type: "string" },
    byCategory: { type: "array", items: { type: "object" } },
    perKm: { type: "string", nullable: true },
  },
};

export const ROUTE_RESULT_SCHEMA: Schema = {
  type: "object",
  properties: {
    provider: { type: "string", example: "OpenStreetMap (OSRM)" },
    routes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          distanceKm: { type: "string", example: "268.4" },
          durationMinutes: { type: "integer", example: 252 },
          geometry: { type: "string", description: "Encoded polyline, precision 6" },
        },
      },
    },
  },
};
