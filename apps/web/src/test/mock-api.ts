import type {
  ApiErrorResponse,
  AuthSession,
  ErrorCode,
  UserProfile,
  Vehicle,
} from "@automate/shared";
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";

import { apiClient } from "@/lib/api-client";

export type MockReply =
  { status: number; data?: unknown; headers?: Record<string, string> } | "offline" | "timeout";

/**
 * Replaces axios's network layer so the real interceptors run against canned replies.
 * Pass one reply for every request, or a function to answer per URL. Returns the requests seen.
 */
export function mockApi(handler: MockReply | ((config: InternalAxiosRequestConfig) => MockReply)) {
  const calls: InternalAxiosRequestConfig[] = [];
  apiClient.defaults.adapter = async (config) => {
    calls.push(config);
    const reply = typeof handler === "function" ? handler(config) : handler;
    if (reply === "offline") throw new AxiosError("Network Error", "ERR_NETWORK", config);
    if (reply === "timeout") throw new AxiosError("timeout", "ECONNABORTED", config);
    const response: AxiosResponse = {
      data: reply.data ?? "",
      status: reply.status,
      statusText: "",
      headers: reply.headers ?? {},
      config,
    };
    if (reply.status >= 400) {
      throw new AxiosError("Request failed", "ERR_BAD_RESPONSE", config, null, response);
    }
    return response;
  };
  return calls;
}

/** A success envelope. */
export const ok = (data: unknown, status = 200): MockReply => ({
  status,
  data: { success: true, message: "OK", data, meta: null },
});

/** An error envelope. */
export const fail = (
  status: number,
  code: ErrorCode,
  message: string,
  details: unknown[] = [],
): MockReply => ({
  status,
  data: {
    success: false,
    message,
    error: { code, details, requestId: "req-1" },
  } satisfies ApiErrorResponse,
});

export const testUser: UserProfile = {
  id: "0190d4a2-0000-7000-8000-000000000001",
  name: "Arjun Mehta",
  email: "arjun.mehta@example.in",
  createdAt: "2026-11-27T04:00:00.000Z",
};

export const testSession = (accessToken = "access-1"): AuthSession => ({
  user: testUser,
  accessToken,
  expiresIn: 900,
});

/** The canonical sample vehicle (localization-and-sample-data.md), as the API returns it. */
export const testVehicle = (overrides: Partial<Vehicle> = {}): Vehicle => ({
  id: "0190d4a2-0000-7000-8000-00000000a001",
  make: "Maruti Suzuki",
  model: "Victoris",
  variant: "LXI",
  manufacturingYear: 2025,
  category: "SUV",
  registrationNumber: "HR26EV4821",
  registrationDate: null,
  fuelType: "PETROL",
  transmission: "MANUAL",
  engineCapacityCc: 1462,
  engineConfiguration: null,
  fuelTankCapacityL: 45,
  colour: "Pearl Silver",
  ownershipType: "OWNED",
  purchaseDate: "2025-02-14",
  purchasePrice: "1145000.00",
  odometerKm: 8450,
  vin: null,
  engineNumber: null,
  fuelSpecification: null,
  engineOilSpecification: null,
  tyreSize: null,
  batteryType: null,
  warrantyExpiryDate: null,
  warrantyKmLimit: null,
  notes: null,
  profileCompletion: 63,
  archivedAt: null,
  createdAt: "2026-11-27T05:00:00.000Z",
  updatedAt: "2026-11-27T05:00:00.000Z",
  ...overrides,
});
