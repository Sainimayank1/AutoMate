import type {
  CreateTripCostValues,
  CreateTripValues,
  Page,
  Trip,
  TripBulkValues,
  TripCategoryValues,
  TripImportValues,
  UpdateTripCostValues,
  UpdateTripValues,
} from "@automate/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { dashboardKeys } from "@/features/dashboard/hooks/use-dashboard";
import { expenseKeys } from "@/features/expenses/hooks/use-expenses";
import { vehicleKeys } from "@/features/garage/hooks/use-vehicles";
import { maintenanceKeys } from "@/features/maintenance/hooks/maintenance-keys";
import { tripsKeys } from "@/features/trips/hooks/trips-keys";
import type {
  TripAnalyticsParams,
  TripCostListParams,
  TripCostSummaryParams,
  TripFilterParams,
  TripListParams,
  TripOverviewParams,
} from "@/features/trips/services/trips-service";
import { tripsService } from "@/features/trips/services/trips-service";

export function useTripOverview(params: TripOverviewParams, enabled = true) {
  return useQuery({
    queryKey: tripsKeys.overview(params),
    queryFn: () => tripsService.overview(params),
    enabled,
    // Changing the period or vehicle keeps the last figures on screen while the next load.
    placeholderData: (previous) => previous,
  });
}

export function useTripAnalytics(params: TripAnalyticsParams) {
  return useQuery({
    queryKey: tripsKeys.analytics(params),
    queryFn: () => tripsService.analytics(params),
    placeholderData: (previous) => previous,
  });
}

export function useTrips(params: TripListParams = {}) {
  return useQuery({
    queryKey: tripsKeys.list(params),
    queryFn: () => tripsService.list(params),
    placeholderData: (previous) => previous,
  });
}

/** Every matching trip (the printable report); off until there are params. */
export function useAllTrips(params: TripListParams | undefined) {
  return useQuery({
    queryKey: tripsKeys.every(params ?? {}),
    queryFn: () => tripsService.all(params),
    enabled: !!params,
  });
}

export function usePreviewTripImport() {
  return useMutation({
    mutationFn: (values: TripImportValues) => tripsService.previewImport(values),
    onError: handledByForm,
  });
}

export function useImportTrips() {
  const sync = useSyncTrips();
  return useMutation({
    mutationFn: (values: TripImportValues) => tripsService.importTrips(values),
    onSuccess: async ({ imported }) => {
      await sync();
      toast.success(`${imported} ${imported === 1 ? "trip" : "trips"} imported.`);
    },
    onError: handledByForm,
  });
}

export function useTripSummary(params: TripFilterParams = {}) {
  return useQuery({
    queryKey: tripsKeys.summary(params),
    queryFn: () => tripsService.summary(params),
    placeholderData: (previous) => previous,
  });
}

export function useBulkTrips() {
  const sync = useSyncTrips();
  return useMutation({
    mutationFn: (values: TripBulkValues) => tripsService.bulk(values),
    onSuccess: async ({ count }, { action }) => {
      await sync();
      toast.success(
        action === "delete"
          ? `${count} ${count === 1 ? "trip" : "trips"} deleted.`
          : `${count} ${count === 1 ? "trip" : "trips"} moved.`,
      );
    },
  });
}

export function useTrip(id: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: tripsKeys.detail(id),
    queryFn: () => tripsService.get(id),
    enabled: !!id,
    // Instant when opened from a list.
    placeholderData: () =>
      queryClient
        .getQueriesData<Page<Trip>>({ queryKey: tripsKeys.lists })
        .flatMap(([, page]) => page?.items ?? [])
        .find((trip) => trip.id === id),
  });
}

export function useTripCategories() {
  return useQuery({ queryKey: tripsKeys.categories, queryFn: tripsService.categories });
}

/**
 * A trip write may move the vehicle's odometer, which Maintenance's due figures and the
 * dashboard read: refresh trips, vehicles, maintenance and the dashboard.
 */
export function useSyncTrips() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: tripsKeys.all }),
      queryClient.invalidateQueries({ queryKey: vehicleKeys.all }),
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.all }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
    ]);
}

// The form shows errors inline (applyServerErrors), so these opt out of the global error toast.
export const handledByForm = () => {};

export function useCreateTrip() {
  const sync = useSyncTrips();
  return useMutation({
    mutationFn: (values: CreateTripValues) => tripsService.create(values),
    onSuccess: async () => {
      await sync();
      toast.success("Trip saved.");
    },
    onError: handledByForm,
  });
}

export function useUpdateTrip(id: string) {
  const sync = useSyncTrips();
  return useMutation({
    mutationFn: (values: UpdateTripValues) => tripsService.update(id, values),
    onSuccess: async () => {
      await sync();
      toast.success("Trip updated.");
    },
    onError: handledByForm,
  });
}

export function useDeleteTrip() {
  const queryClient = useQueryClient();
  const sync = useSyncTrips();
  return useMutation({
    mutationFn: (trip: Trip) => tripsService.remove(trip.id),
    onSuccess: async (_, trip) => {
      queryClient.removeQueries({ queryKey: tripsKeys.detail(trip.id) });
      await sync();
      toast.success("Trip deleted.");
    },
  });
}

/** A renamed type shows on its trips: refresh everything in trips. */
function useSyncCategories() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: tripsKeys.all });
}

export function useCreateTripCategory() {
  const sync = useSyncCategories();
  return useMutation({
    mutationFn: (values: TripCategoryValues) => tripsService.createCategory(values),
    onSuccess: sync,
    onError: handledByForm,
  });
}

export function useRenameTripCategory() {
  const sync = useSyncCategories();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: TripCategoryValues }) =>
      tripsService.renameCategory(id, values),
    onSuccess: sync,
    onError: handledByForm,
  });
}

export function useArchiveTripCategory() {
  const sync = useSyncCategories();
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      tripsService.setCategoryArchived(id, archived),
    onSuccess: sync,
  });
}

// ---- a trip's money

export function useTripCosts(tripId: string) {
  return useQuery({ queryKey: tripsKeys.costs(tripId), queryFn: () => tripsService.costs(tripId) });
}

export function useTripSpending(tripId: string) {
  return useQuery({
    queryKey: tripsKeys.spending(tripId),
    queryFn: () => tripsService.spending(tripId),
  });
}

export function useTripFuel(tripId: string) {
  return useQuery({
    queryKey: tripsKeys.fuel(tripId),
    queryFn: () => tripsService.fuelEntries(tripId),
  });
}

export function useFuelCandidates(tripId: string, enabled: boolean) {
  return useQuery({
    queryKey: tripsKeys.candidates(tripId),
    queryFn: () => tripsService.fuelCandidates(tripId),
    enabled,
  });
}

export function useTripCost(id: string) {
  return useQuery({
    queryKey: tripsKeys.cost(id),
    queryFn: () => tripsService.cost(id),
    enabled: !!id,
  });
}

export function useAllTripCosts(params: TripCostListParams) {
  return useQuery({
    queryKey: tripsKeys.allCosts(params),
    queryFn: () => tripsService.allCosts(params),
    placeholderData: (previous) => previous,
  });
}

export function useTripCostsSummary(params: TripCostSummaryParams) {
  return useQuery({
    queryKey: tripsKeys.costsSummary(params),
    queryFn: () => tripsService.costsSummary(params),
    placeholderData: (previous) => previous,
  });
}

/**
 * A cost write changes the trip's money and, for toll, parking and other, an expense: refresh
 * trips (lists show actual cost), expenses and the dashboard.
 */
function useSyncMoney() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: tripsKeys.all }),
      queryClient.invalidateQueries({ queryKey: expenseKeys.all }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
    ]);
}

export function useSaveTripCost(tripId: string) {
  const sync = useSyncMoney();
  return useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id?: string;
      values: CreateTripCostValues | UpdateTripCostValues;
    }) =>
      id
        ? tripsService.updateCost(tripId, id, values)
        : tripsService.createCost(tripId, values as CreateTripCostValues),
    onSuccess: async (_, { id }) => {
      await sync();
      toast.success(id ? "Cost updated." : "Cost added.");
    },
    onError: handledByForm,
  });
}

export function useDeleteTripCost(tripId: string) {
  const sync = useSyncMoney();
  return useMutation({
    mutationFn: (id: string) => tripsService.removeCost(tripId, id),
    onSuccess: async () => {
      await sync();
      toast.success("Cost deleted.");
    },
  });
}

/** Linking only changes Trips' view of the fill-up; Fuel's figures stay the same. */
export function useLinkFuel(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fuelEntryId, linked }: { fuelEntryId: string; linked: boolean }) =>
      linked
        ? tripsService.linkFuel(tripId, fuelEntryId)
        : tripsService.unlinkFuel(tripId, fuelEntryId),
    onSuccess: async (_, { linked }) => {
      await queryClient.invalidateQueries({ queryKey: tripsKeys.all });
      toast.success(linked ? "Fill-up linked." : "Fill-up unlinked.");
    },
  });
}

export function useTripAttachments(tripId: string) {
  return useQuery({
    queryKey: tripsKeys.attachments(tripId),
    queryFn: () => tripsService.attachments(tripId),
  });
}

export function useUploadTripAttachment(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, costId }: { file: File; costId?: string }) =>
      tripsService.uploadAttachment(tripId, file, costId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tripsKeys.attachments(tripId) }),
    // The panel shows the error on the file.
    onError: handledByForm,
  });
}

export function useDeleteTripAttachment(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tripsService.removeAttachment(tripId, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: tripsKeys.attachments(tripId) });
      toast.success("File deleted.");
    },
  });
}
