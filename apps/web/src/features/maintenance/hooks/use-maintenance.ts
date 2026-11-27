import type {
  CreateComponentValues,
  CreateInspectionValues,
  CreateProviderValues,
  CreateScheduleValues,
  CreateServiceRecordValues,
  InspectComponentValues,
  Inspection,
  MaintenanceSchedule,
  Page,
  ProviderProfile,
  RemoveComponentValues,
  ReplaceComponentValues,
  ServiceRecord,
  UpdateComponentValues,
  UpdateInspectionValues,
  UpdateProviderValues,
  UpdateScheduleValues,
  UpdateServiceRecordValues,
  VehicleComponent,
} from "@automate/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { dashboardKeys } from "@/features/dashboard/hooks/use-dashboard";
import { expenseKeys } from "@/features/expenses/hooks/use-expenses";
import { vehicleKeys } from "@/features/garage/hooks/use-vehicles";
import { maintenanceKeys } from "@/features/maintenance/hooks/maintenance-keys";
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
import { maintenanceService } from "@/features/maintenance/services/maintenance-service";

/** `vehicleId` may be empty while the garage loads. */
export function useMaintenanceOverview(vehicleId: string | undefined, params: OverviewParams = {}) {
  return useQuery({
    queryKey: maintenanceKeys.overview(vehicleId ?? "", params),
    queryFn: () => maintenanceService.overview(vehicleId!, params),
    enabled: !!vehicleId,
    // Changing the period keeps the page on screen, but never shows another vehicle's.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === vehicleId ? previous : undefined,
  });
}

export function useSchedules(vehicleId: string | undefined, params: ScheduleListParams = {}) {
  return useQuery({
    queryKey: maintenanceKeys.list(vehicleId ?? "", params),
    queryFn: () => maintenanceService.list(vehicleId!, params),
    enabled: !!vehicleId,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === vehicleId ? previous : undefined,
  });
}

export function useSchedule(vehicleId: string, id: string, enabled = true) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: maintenanceKeys.detail(vehicleId, id),
    queryFn: () => maintenanceService.get(vehicleId, id),
    enabled: enabled && !!vehicleId && !!id,
    // Instant when opened from a list.
    placeholderData: () =>
      queryClient
        .getQueriesData<Page<MaintenanceSchedule>>({ queryKey: maintenanceKeys.lists(vehicleId) })
        .flatMap(([, page]) => page?.items ?? [])
        .find((schedule) => schedule.id === id),
  });
}

/**
 * Any schedule, component or inspection write changes the vehicle's maintenance views; a
 * workshop typed in may be new.
 */
function useSyncMaintenance() {
  const queryClient = useQueryClient();
  return (vehicleId: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.vehicle(vehicleId) }),
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.providers }),
      // The dashboard's status panel lists due and overdue schedules.
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
    ]);
}

/**
 * A record write also completes schedules, keeps an expense and may raise the odometer: refresh
 * maintenance, every expense view, the vehicles and the dashboard.
 */
function useSyncRecords() {
  const queryClient = useQueryClient();
  return (vehicleId: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.vehicle(vehicleId) }),
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.providers }),
      queryClient.invalidateQueries({ queryKey: expenseKeys.all }),
      queryClient.invalidateQueries({ queryKey: vehicleKeys.all }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
    ]);
}

export function useServiceRecords(vehicleId: string | undefined, params: RecordListParams = {}) {
  return useQuery({
    queryKey: maintenanceKeys.records(vehicleId ?? "", params),
    queryFn: () => maintenanceService.records(vehicleId!, params),
    enabled: !!vehicleId,
    // Paging or filtering keeps the last page on screen, but never another vehicle's.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === vehicleId ? previous : undefined,
  });
}

export function useServiceRecordSummary(
  vehicleId: string | undefined,
  params: RecordFilterParams = {},
) {
  return useQuery({
    queryKey: maintenanceKeys.recordSummary(vehicleId ?? "", params),
    queryFn: () => maintenanceService.recordSummary(vehicleId!, params),
    enabled: !!vehicleId,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === vehicleId ? previous : undefined,
  });
}

export function useServiceRecord(vehicleId: string, id: string) {
  return useQuery({
    queryKey: maintenanceKeys.record(vehicleId, id),
    queryFn: () => maintenanceService.record(vehicleId, id),
    enabled: !!vehicleId && !!id,
  });
}

export function useProviders() {
  return useQuery({ queryKey: maintenanceKeys.providers, queryFn: maintenanceService.providers });
}

export function useCreateServiceRecord(vehicleId: string) {
  const sync = useSyncRecords();
  return useMutation({
    mutationFn: (values: CreateServiceRecordValues) =>
      maintenanceService.createRecord(vehicleId, values),
    onSuccess: async () => {
      await sync(vehicleId);
      toast.success("Service record saved.");
    },
    onError: handledByForm,
  });
}

export function useUpdateServiceRecord(vehicleId: string, id: string) {
  const sync = useSyncRecords();
  return useMutation({
    mutationFn: (values: UpdateServiceRecordValues) =>
      maintenanceService.updateRecord(vehicleId, id, values),
    onSuccess: async () => {
      await sync(vehicleId);
      toast.success("Service record updated.");
    },
    onError: handledByForm,
  });
}

export function useDeleteServiceRecord() {
  const queryClient = useQueryClient();
  const sync = useSyncRecords();
  return useMutation({
    mutationFn: (record: ServiceRecord) =>
      maintenanceService.removeRecord(record.vehicleId, record.id),
    onSuccess: async (_, record) => {
      queryClient.removeQueries({ queryKey: maintenanceKeys.record(record.vehicleId, record.id) });
      await sync(record.vehicleId);
      toast.success("Service record deleted.");
    },
  });
}

// The form shows errors inline (applyServerErrors), so these opt out of the global error toast.
const handledByForm = () => {};

export function useCreateSchedule(vehicleId: string) {
  const sync = useSyncMaintenance();
  return useMutation({
    mutationFn: (values: CreateScheduleValues) => maintenanceService.create(vehicleId, values),
    onSuccess: async () => {
      await sync(vehicleId);
      toast.success("Schedule added.");
    },
    onError: handledByForm,
  });
}

export function useUpdateSchedule(vehicleId: string, id: string) {
  const sync = useSyncMaintenance();
  return useMutation({
    mutationFn: (values: UpdateScheduleValues) => maintenanceService.update(vehicleId, id, values),
    onSuccess: async () => {
      await sync(vehicleId);
      toast.success("Schedule updated.");
    },
    onError: handledByForm,
  });
}

export function usePauseSchedule() {
  const sync = useSyncMaintenance();
  return useMutation({
    mutationFn: ({ schedule, paused }: { schedule: MaintenanceSchedule; paused: boolean }) =>
      maintenanceService.setPaused(schedule.vehicleId, schedule.id, paused),
    onSuccess: async (schedule, { paused }) => {
      await sync(schedule.vehicleId);
      toast.success(paused ? "Schedule paused." : "Schedule resumed.");
    },
  });
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient();
  const sync = useSyncMaintenance();
  return useMutation({
    mutationFn: (schedule: MaintenanceSchedule) =>
      maintenanceService.remove(schedule.vehicleId, schedule.id),
    onSuccess: async (_, schedule) => {
      queryClient.removeQueries({
        queryKey: maintenanceKeys.detail(schedule.vehicleId, schedule.id),
      });
      await sync(schedule.vehicleId);
      toast.success("Schedule deleted.");
    },
  });
}

export function useComponents(vehicleId: string | undefined, params: ComponentListParams = {}) {
  return useQuery({
    queryKey: maintenanceKeys.components(vehicleId ?? "", params),
    queryFn: () => maintenanceService.components(vehicleId!, params),
    enabled: !!vehicleId,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === vehicleId ? previous : undefined,
  });
}

export function useComponent(vehicleId: string, id: string) {
  return useQuery({
    queryKey: maintenanceKeys.component(vehicleId, id),
    queryFn: () => maintenanceService.component(vehicleId, id),
    enabled: !!vehicleId && !!id,
  });
}

export function useCreateComponent(vehicleId: string) {
  const sync = useSyncMaintenance();
  return useMutation({
    mutationFn: (values: CreateComponentValues) =>
      maintenanceService.createComponent(vehicleId, values),
    onSuccess: async () => {
      await sync(vehicleId);
      toast.success("Component added.");
    },
    onError: handledByForm,
  });
}

export function useUpdateComponent(vehicleId: string, id: string) {
  const sync = useSyncMaintenance();
  return useMutation({
    mutationFn: (values: UpdateComponentValues) =>
      maintenanceService.updateComponent(vehicleId, id, values),
    onSuccess: async () => {
      await sync(vehicleId);
      toast.success("Component updated.");
    },
    onError: handledByForm,
  });
}

export function useInspectComponent(vehicleId: string, id: string) {
  const sync = useSyncMaintenance();
  return useMutation({
    mutationFn: (values: InspectComponentValues) =>
      maintenanceService.inspectComponent(vehicleId, id, values),
    onSuccess: async () => {
      await sync(vehicleId);
      toast.success("Inspection recorded.");
    },
    onError: handledByForm,
  });
}

/** A replacement is also a service record (expense, schedules, odometer): refresh like one. */
export function useReplaceComponent(vehicleId: string, id: string) {
  const sync = useSyncRecords();
  return useMutation({
    mutationFn: (values: ReplaceComponentValues) =>
      maintenanceService.replaceComponent(vehicleId, id, values),
    onSuccess: async () => {
      await sync(vehicleId);
      toast.success("Component replaced.");
    },
    onError: handledByForm,
  });
}

export function useRetireComponent(vehicleId: string, id: string) {
  const sync = useSyncMaintenance();
  return useMutation({
    mutationFn: (values: RemoveComponentValues) =>
      maintenanceService.retireComponent(vehicleId, id, values),
    onSuccess: async () => {
      await sync(vehicleId);
      toast.success("Component marked removed.");
    },
    onError: handledByForm,
  });
}

export function useDeleteComponent() {
  const queryClient = useQueryClient();
  const sync = useSyncMaintenance();
  return useMutation({
    mutationFn: (part: VehicleComponent) =>
      maintenanceService.removeComponent(part.vehicleId, part.id),
    onSuccess: async (_, part) => {
      queryClient.removeQueries({ queryKey: maintenanceKeys.component(part.vehicleId, part.id) });
      await sync(part.vehicleId);
      toast.success("Component deleted.");
    },
  });
}

export function useInspections(vehicleId: string | undefined, params: InspectionListParams = {}) {
  return useQuery({
    queryKey: maintenanceKeys.inspections(vehicleId ?? "", params),
    queryFn: () => maintenanceService.inspections(vehicleId!, params),
    enabled: !!vehicleId,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === vehicleId ? previous : undefined,
  });
}

export function useInspection(vehicleId: string, id: string) {
  return useQuery({
    queryKey: maintenanceKeys.inspection(vehicleId, id),
    queryFn: () => maintenanceService.inspection(vehicleId, id),
    enabled: !!vehicleId && !!id,
  });
}

export function useCreateInspection(vehicleId: string) {
  const sync = useSyncMaintenance();
  return useMutation({
    mutationFn: (values: CreateInspectionValues) =>
      maintenanceService.createInspection(vehicleId, values),
    onSuccess: async () => {
      await sync(vehicleId);
      toast.success("Inspection saved.");
    },
    onError: handledByForm,
  });
}

export function useUpdateInspection(vehicleId: string, id: string) {
  const sync = useSyncMaintenance();
  return useMutation({
    mutationFn: (values: UpdateInspectionValues) =>
      maintenanceService.updateInspection(vehicleId, id, values),
    onSuccess: async () => {
      await sync(vehicleId);
      toast.success("Inspection updated.");
    },
    onError: handledByForm,
  });
}

export function useDeleteInspection() {
  const queryClient = useQueryClient();
  const sync = useSyncMaintenance();
  return useMutation({
    mutationFn: (inspection: Inspection) =>
      maintenanceService.removeInspection(inspection.vehicleId, inspection.id),
    onSuccess: async (_, inspection) => {
      queryClient.removeQueries({
        queryKey: maintenanceKeys.inspection(inspection.vehicleId, inspection.id),
      });
      await sync(inspection.vehicleId);
      toast.success("Inspection deleted.");
    },
  });
}

export function useWorkshops(params: WorkshopListParams = {}) {
  return useQuery({
    queryKey: maintenanceKeys.workshops(params),
    queryFn: () => maintenanceService.workshops(params),
    placeholderData: (previous) => previous,
  });
}

export function useWorkshop(id: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: maintenanceKeys.workshop(id),
    queryFn: () => maintenanceService.workshop(id),
    enabled: !!id,
    // Instant when opened from a list.
    placeholderData: () =>
      queryClient
        .getQueriesData<Page<ProviderProfile>>({
          queryKey: [...maintenanceKeys.providers, "list"],
        })
        .flatMap(([, page]) => page?.items ?? [])
        .find((workshop) => workshop.id === id),
  });
}

export function useWorkshopVisits(id: string, params: PageParams = {}) {
  return useQuery({
    queryKey: maintenanceKeys.workshopVisits(id, params),
    queryFn: () => maintenanceService.workshopVisits(id, params),
    enabled: !!id,
    placeholderData: (previous) => previous,
  });
}

/** A workshop's name shows on its records: refresh all of maintenance. */
function useSyncWorkshops() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: maintenanceKeys.all });
}

export function useCreateWorkshop() {
  const sync = useSyncWorkshops();
  return useMutation({
    mutationFn: (values: CreateProviderValues) => maintenanceService.createWorkshop(values),
    onSuccess: async () => {
      await sync();
      toast.success("Workshop added.");
    },
    onError: handledByForm,
  });
}

export function useUpdateWorkshop(id: string) {
  const sync = useSyncWorkshops();
  return useMutation({
    mutationFn: (values: UpdateProviderValues) => maintenanceService.updateWorkshop(id, values),
    onSuccess: async () => {
      await sync();
      toast.success("Workshop updated.");
    },
    onError: handledByForm,
  });
}

export function useArchiveWorkshop() {
  const sync = useSyncWorkshops();
  return useMutation({
    mutationFn: ({ workshop, archived }: { workshop: ProviderProfile; archived: boolean }) =>
      maintenanceService.setWorkshopArchived(workshop.id, archived),
    onSuccess: async (_, { archived }) => {
      await sync();
      toast.success(archived ? "Workshop archived." : "Workshop restored.");
    },
  });
}

export function useDeleteWorkshop() {
  const queryClient = useQueryClient();
  const sync = useSyncWorkshops();
  return useMutation({
    mutationFn: (workshop: ProviderProfile) => maintenanceService.removeWorkshop(workshop.id),
    onSuccess: async (_, workshop) => {
      queryClient.removeQueries({ queryKey: maintenanceKeys.workshop(workshop.id) });
      await sync();
      toast.success("Workshop deleted.");
    },
  });
}
