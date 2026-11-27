import type { CreateVehicleValues, UpdateVehicleValues, Vehicle } from "@automate/shared";

import { request } from "@/lib/api-client";

/** Garage endpoints (`/vehicles`). Every call is scoped to the signed-in user by the API. */
export const vehicleService = {
  list: ({ archived = false }: { archived?: boolean } = {}) =>
    request<Vehicle[]>({ url: "/vehicles", params: archived ? { archived: true } : undefined }),
  get: (id: string) => request<Vehicle>({ url: `/vehicles/${id}` }),
  create: (values: CreateVehicleValues) =>
    request<Vehicle>({ method: "POST", url: "/vehicles", data: values }),
  update: (id: string, values: UpdateVehicleValues) =>
    request<Vehicle>({ method: "PATCH", url: `/vehicles/${id}`, data: values }),
  archive: (id: string) => request<Vehicle>({ method: "POST", url: `/vehicles/${id}/archive` }),
  restore: (id: string) => request<Vehicle>({ method: "POST", url: `/vehicles/${id}/restore` }),
  remove: (id: string) => request<void>({ method: "DELETE", url: `/vehicles/${id}` }),
};
