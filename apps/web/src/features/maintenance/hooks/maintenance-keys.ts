import type {
  ComponentListParams,
  InspectionListParams,
  OverviewParams,
  PageParams,
  RecordFilterParams,
  RecordListParams,
  ScheduleListParams,
  WorkshopListParams,
} from "@/features/maintenance/services/maintenance-service";

/** Query keys of the maintenance module; other modules import these to refresh it. */
export const maintenanceKeys = {
  all: ["maintenance"] as const,
  /** The workshops: suggestions, lists, profiles and visits all start with this key. */
  providers: ["maintenance", "providers"] as const,
  workshops: (params: WorkshopListParams) => ["maintenance", "providers", "list", params] as const,
  workshop: (id: string) => ["maintenance", "providers", "detail", id] as const,
  workshopVisits: (id: string, params: PageParams) =>
    ["maintenance", "providers", "visits", id, params] as const,
  vehicle: (vehicleId: string) => ["maintenance", vehicleId] as const,
  plan: (vehicleId: string) => ["maintenance", vehicleId, "plan"] as const,
  analytics: (vehicleId: string, period: string) =>
    ["maintenance", vehicleId, "analytics", period] as const,
  overview: (vehicleId: string, params: OverviewParams) =>
    ["maintenance", vehicleId, "overview", params] as const,
  lists: (vehicleId: string) => ["maintenance", vehicleId, "list"] as const,
  list: (vehicleId: string, params: ScheduleListParams) =>
    ["maintenance", vehicleId, "list", params] as const,
  detail: (vehicleId: string, id: string) => ["maintenance", vehicleId, "detail", id] as const,
  recordSummary: (vehicleId: string, params: RecordFilterParams) =>
    ["maintenance", vehicleId, "records-summary", params] as const,
  records: (vehicleId: string, params: RecordListParams) =>
    ["maintenance", vehicleId, "records", params] as const,
  record: (vehicleId: string, id: string) => ["maintenance", vehicleId, "record", id] as const,
  components: (vehicleId: string, params: ComponentListParams) =>
    ["maintenance", vehicleId, "components", params] as const,
  component: (vehicleId: string, id: string) =>
    ["maintenance", vehicleId, "component", id] as const,
  inspections: (vehicleId: string, params: InspectionListParams) =>
    ["maintenance", vehicleId, "inspections", params] as const,
  inspection: (vehicleId: string, id: string) =>
    ["maintenance", vehicleId, "inspection", id] as const,
};
