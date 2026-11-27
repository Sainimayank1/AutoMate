import type {
  ComponentListQuery,
  CreateComponentValues,
  CreateInspectionValues,
  CreateProviderValues,
  CreateScheduleValues,
  CreateServiceRecordValues,
  InspectComponentValues,
  Inspection,
  InspectionListQuery,
  MaintenanceOverview,
  MaintenanceOverviewQuery,
  MaintenanceProvider,
  MaintenanceSchedule,
  PaginationQuery,
  ProviderListQuery,
  ProviderProfile,
  RemoveComponentValues,
  ReplaceComponentValues,
  ScheduleListQuery,
  ServiceRecord,
  ServiceRecordFilters,
  ServiceRecordListQuery,
  ServiceRecordSummary,
  UpdateComponentValues,
  UpdateInspectionValues,
  UpdateProviderValues,
  UpdateScheduleValues,
  UpdateServiceRecordValues,
  VehicleComponent,
  VehicleComponentDetail,
} from "@automate/shared";

import { request, requestAllPages, requestPage } from "@/lib/api-client";

const schedules = (vehicleId: string) => `/vehicles/${vehicleId}/maintenance-schedules`;

const records = (vehicleId: string) => `/vehicles/${vehicleId}/service-records`;
const components = (vehicleId: string) => `/vehicles/${vehicleId}/components`;
const inspections = (vehicleId: string) => `/vehicles/${vehicleId}/inspections`;
const PROVIDERS = "/maintenance-providers";

export type ScheduleListParams = Partial<ScheduleListQuery>;
export type RecordListParams = Partial<ServiceRecordListQuery>;
export type RecordFilterParams = Partial<ServiceRecordFilters>;
export type ComponentListParams = Partial<ComponentListQuery>;
export type InspectionListParams = Partial<InspectionListQuery>;
export type WorkshopListParams = Partial<ProviderListQuery>;
export type PageParams = Partial<PaginationQuery>;
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
  recordSummary: (vehicleId: string, params: RecordFilterParams = {}) =>
    request<ServiceRecordSummary>({ url: `${records(vehicleId)}/summary`, params }),
  record: (vehicleId: string, id: string) =>
    request<ServiceRecord>({ url: `${records(vehicleId)}/${id}` }),
  createRecord: (vehicleId: string, values: CreateServiceRecordValues) =>
    request<ServiceRecord>({ method: "POST", url: records(vehicleId), data: values }),
  updateRecord: (vehicleId: string, id: string, values: UpdateServiceRecordValues) =>
    request<ServiceRecord>({ method: "PATCH", url: `${records(vehicleId)}/${id}`, data: values }),
  removeRecord: (vehicleId: string, id: string) =>
    request<void>({ method: "DELETE", url: `${records(vehicleId)}/${id}` }),
  components: (vehicleId: string, params: ComponentListParams = {}) =>
    requestPage<VehicleComponent>({ url: components(vehicleId), params }),
  component: (vehicleId: string, id: string) =>
    request<VehicleComponentDetail>({ url: `${components(vehicleId)}/${id}` }),
  createComponent: (vehicleId: string, values: CreateComponentValues) =>
    request<VehicleComponentDetail>({ method: "POST", url: components(vehicleId), data: values }),
  updateComponent: (vehicleId: string, id: string, values: UpdateComponentValues) =>
    request<VehicleComponentDetail>({
      method: "PATCH",
      url: `${components(vehicleId)}/${id}`,
      data: values,
    }),
  inspectComponent: (vehicleId: string, id: string, values: InspectComponentValues) =>
    request<VehicleComponentDetail>({
      method: "POST",
      url: `${components(vehicleId)}/${id}/inspect`,
      data: values,
    }),
  replaceComponent: (vehicleId: string, id: string, values: ReplaceComponentValues) =>
    request<VehicleComponentDetail>({
      method: "POST",
      url: `${components(vehicleId)}/${id}/replace`,
      data: values,
    }),
  retireComponent: (vehicleId: string, id: string, values: RemoveComponentValues) =>
    request<VehicleComponentDetail>({
      method: "POST",
      url: `${components(vehicleId)}/${id}/remove`,
      data: values,
    }),
  removeComponent: (vehicleId: string, id: string) =>
    request<void>({ method: "DELETE", url: `${components(vehicleId)}/${id}` }),
  inspections: (vehicleId: string, params: InspectionListParams = {}) =>
    requestPage<Inspection>({ url: inspections(vehicleId), params }),
  inspection: (vehicleId: string, id: string) =>
    request<Inspection>({ url: `${inspections(vehicleId)}/${id}` }),
  createInspection: (vehicleId: string, values: CreateInspectionValues) =>
    request<Inspection>({ method: "POST", url: inspections(vehicleId), data: values }),
  updateInspection: (vehicleId: string, id: string, values: UpdateInspectionValues) =>
    request<Inspection>({
      method: "PATCH",
      url: `${inspections(vehicleId)}/${id}`,
      data: values,
    }),
  removeInspection: (vehicleId: string, id: string) =>
    request<void>({ method: "DELETE", url: `${inspections(vehicleId)}/${id}` }),
  /** The user's workshops in use (suggestions for the forms; small, read whole). */
  providers: () => requestAllPages<MaintenanceProvider>({ url: PROVIDERS }),
  workshops: (params: WorkshopListParams = {}) =>
    requestPage<ProviderProfile>({ url: PROVIDERS, params }),
  workshop: (id: string) => request<ProviderProfile>({ url: `${PROVIDERS}/${id}` }),
  createWorkshop: (values: CreateProviderValues) =>
    request<ProviderProfile>({ method: "POST", url: PROVIDERS, data: values }),
  updateWorkshop: (id: string, values: UpdateProviderValues) =>
    request<ProviderProfile>({ method: "PATCH", url: `${PROVIDERS}/${id}`, data: values }),
  setWorkshopArchived: (id: string, archived: boolean) =>
    request<ProviderProfile>({
      method: "POST",
      url: `${PROVIDERS}/${id}/${archived ? "archive" : "restore"}`,
    }),
  removeWorkshop: (id: string) => request<void>({ method: "DELETE", url: `${PROVIDERS}/${id}` }),
  /** A workshop's visits across the user's vehicles, newest first. */
  workshopVisits: (id: string, params: PageParams = {}) =>
    requestPage<ServiceRecord>({ url: `${PROVIDERS}/${id}/service-records`, params }),
};
