import type {
  OverviewParams,
  RecordListParams,
  ScheduleListParams,
} from "@/features/maintenance/services/maintenance-service";

/** Query keys of the maintenance module; other modules import these to refresh it. */
export const maintenanceKeys = {
  all: ["maintenance"] as const,
  providers: ["maintenance", "providers"] as const,
  vehicle: (vehicleId: string) => ["maintenance", vehicleId] as const,
  overview: (vehicleId: string, params: OverviewParams) =>
    ["maintenance", vehicleId, "overview", params] as const,
  lists: (vehicleId: string) => ["maintenance", vehicleId, "list"] as const,
  list: (vehicleId: string, params: ScheduleListParams) =>
    ["maintenance", vehicleId, "list", params] as const,
  detail: (vehicleId: string, id: string) => ["maintenance", vehicleId, "detail", id] as const,
  records: (vehicleId: string, params: RecordListParams) =>
    ["maintenance", vehicleId, "records", params] as const,
  record: (vehicleId: string, id: string) => ["maintenance", vehicleId, "record", id] as const,
};
