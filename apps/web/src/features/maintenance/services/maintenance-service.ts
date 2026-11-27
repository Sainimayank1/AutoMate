import type {
  CreateScheduleValues,
  CreateServiceRecordValues,
  MaintenanceOverview,
  MaintenanceOverviewQuery,
  MaintenanceProvider,
  MaintenanceSchedule,
  ScheduleListQuery,
  ServiceRecord,
  ServiceRecordListQuery,
  UpdateScheduleValues,
  UpdateServiceRecordValues,
} from "@automate/shared";

import { request, requestAllPages, requestPage } from "@/lib/api-client";

const schedules = (vehicleId: string) => `/vehicles/${vehicleId}/maintenance-schedules`;

const records = (vehicleId: string) => `/vehicles/${vehicleId}/service-records`;

export type ScheduleListParams = Partial<ScheduleListQuery>;
export type RecordListParams = Partial<ServiceRecordListQuery>;
export type OverviewParams = Partial<MaintenanceOverviewQuery>;

/** Maintenance endpoints, nested under the vehicle. Every call is scoped to the signed-in user. */
export const maintenanceService = {
  overview: (vehicleId: string, params: OverviewParams = {}) =>
    request<MaintenanceOverview>({ url: `/vehicles/${vehicleId}/maintenance-overview`, params }),
  /** One page, most urgent first. */
  list: (vehicleId: string, params: ScheduleListParams = {}) =>
    requestPage<MaintenanceSchedule>({ url: schedules(vehicleId), params }),
  get: (vehicleId: string, id: string) =>
    request<MaintenanceSchedule>({ url: `${schedules(vehicleId)}/${id}` }),
  create: (vehicleId: string, values: CreateScheduleValues) =>
    request<MaintenanceSchedule>({ method: "POST", url: schedules(vehicleId), data: values }),
  update: (vehicleId: string, id: string, values: UpdateScheduleValues) =>
    request<MaintenanceSchedule>({
      method: "PATCH",
      url: `${schedules(vehicleId)}/${id}`,
      data: values,
    }),
  setPaused: (vehicleId: string, id: string, paused: boolean) =>
    request<MaintenanceSchedule>({
      method: "POST",
      url: `${schedules(vehicleId)}/${id}/${paused ? "pause" : "resume"}`,
    }),
  remove: (vehicleId: string, id: string) =>
    request<void>({ method: "DELETE", url: `${schedules(vehicleId)}/${id}` }),
  records: (vehicleId: string, params: RecordListParams = {}) =>
    requestPage<ServiceRecord>({ url: records(vehicleId), params }),
  record: (vehicleId: string, id: string) =>
    request<ServiceRecord>({ url: `${records(vehicleId)}/${id}` }),
  createRecord: (vehicleId: string, values: CreateServiceRecordValues) =>
    request<ServiceRecord>({ method: "POST", url: records(vehicleId), data: values }),
  updateRecord: (vehicleId: string, id: string, values: UpdateServiceRecordValues) =>
    request<ServiceRecord>({ method: "PATCH", url: `${records(vehicleId)}/${id}`, data: values }),
  removeRecord: (vehicleId: string, id: string) =>
    request<void>({ method: "DELETE", url: `${records(vehicleId)}/${id}` }),
  /** The user's workshops (suggestions for the record form; small, read whole). */
  providers: () => requestAllPages<MaintenanceProvider>({ url: "/maintenance-providers" }),
};
