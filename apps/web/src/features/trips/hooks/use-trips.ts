import type {
  CreateTripValues,
  Page,
  Trip,
  TripCategoryValues,
  UpdateTripValues,
} from "@automate/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { dashboardKeys } from "@/features/dashboard/hooks/use-dashboard";
import { vehicleKeys } from "@/features/garage/hooks/use-vehicles";
import { maintenanceKeys } from "@/features/maintenance/hooks/maintenance-keys";
import { tripsKeys } from "@/features/trips/hooks/trips-keys";
import type { TripListParams, TripOverviewParams } from "@/features/trips/services/trips-service";
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

export function useTrips(params: TripListParams = {}) {
  return useQuery({
    queryKey: tripsKeys.list(params),
    queryFn: () => tripsService.list(params),
    placeholderData: (previous) => previous,
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
function useSyncTrips() {
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
const handledByForm = () => {};

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
