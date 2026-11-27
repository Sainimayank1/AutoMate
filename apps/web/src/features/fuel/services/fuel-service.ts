import type {
  CreateFuelEntryValues,
  FuelEntry,
  FuelSummary,
  ReverseGeocodeResult,
  UpdateFuelEntryValues,
} from "@automate/shared";

import { request } from "@/lib/api-client";

const entries = (vehicleId: string) => `/vehicles/${vehicleId}/fuel-entries`;

/** Fuel endpoints, nested under the vehicle. Every call is scoped to the signed-in user by the API. */
export const fuelService = {
  list: (vehicleId: string) => request<FuelEntry[]>({ url: entries(vehicleId) }),
  summary: (vehicleId: string) =>
    request<FuelSummary>({ url: `/vehicles/${vehicleId}/fuel-summary` }),
  get: (vehicleId: string, id: string) =>
    request<FuelEntry>({ url: `${entries(vehicleId)}/${id}` }),
  create: (vehicleId: string, values: CreateFuelEntryValues) =>
    request<FuelEntry>({ method: "POST", url: entries(vehicleId), data: values }),
  update: (vehicleId: string, id: string, values: UpdateFuelEntryValues) =>
    request<FuelEntry>({ method: "PATCH", url: `${entries(vehicleId)}/${id}`, data: values }),
  remove: (vehicleId: string, id: string) =>
    request<void>({ method: "DELETE", url: `${entries(vehicleId)}/${id}` }),
  /** The address at the device's position, for the add form's automatic location. */
  addressAt: (latitude: number, longitude: number) =>
    request<ReverseGeocodeResult>({
      method: "POST",
      url: "/geocode/reverse",
      data: { latitude, longitude },
    }),
};
