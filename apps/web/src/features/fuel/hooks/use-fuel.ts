import type {
  CreateFuelEntryValues,
  FuelEntry,
  Page,
  UpdateFuelEntryValues,
} from "@automate/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { expenseKeys } from "@/features/expenses/hooks/use-expenses";
import { type FuelListParams, fuelService } from "@/features/fuel/services/fuel-service";
import { vehicleKeys } from "@/features/garage/hooks/use-vehicles";
import { useActiveVehicleStore } from "@/stores/vehicle-store";

export const fuelKeys = {
  vehicle: (vehicleId: string) => ["fuel", vehicleId] as const,
  lists: (vehicleId: string) => ["fuel", vehicleId, "list"] as const,
  list: (vehicleId: string, params: FuelListParams) => ["fuel", vehicleId, "list", params] as const,
  summary: (vehicleId: string) => ["fuel", vehicleId, "summary"] as const,
  detail: (vehicleId: string, id: string) => ["fuel", vehicleId, "detail", id] as const,
};

/**
 * One page of a vehicle's fill-ups, newest first (page 1 by default). `vehicleId` may be empty
 * while the garage loads. Paging or filtering keeps the last page on screen until the next one
 * arrives, but never shows another vehicle's.
 */
export function useFuelEntries(vehicleId: string | undefined, params: FuelListParams = {}) {
  return useQuery({
    queryKey: fuelKeys.list(vehicleId ?? "", params),
    queryFn: () => fuelService.list(vehicleId!, params),
    enabled: !!vehicleId,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === vehicleId ? previous : undefined,
  });
}

export function useFuelSummary(vehicleId: string | undefined) {
  return useQuery({
    queryKey: fuelKeys.summary(vehicleId ?? ""),
    queryFn: () => fuelService.summary(vehicleId!),
    enabled: !!vehicleId,
  });
}

export function useFuelEntry(vehicleId: string, id: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: fuelKeys.detail(vehicleId, id),
    queryFn: () => fuelService.get(vehicleId, id),
    // Instant when coming from the history list.
    placeholderData: () =>
      queryClient
        .getQueriesData<Page<FuelEntry>>({ queryKey: fuelKeys.lists(vehicleId) })
        .flatMap(([, page]) => page?.items ?? [])
        .find((entry) => entry.id === id),
  });
}

/**
 * After any write: one entry changes the mileage of its neighbours and the summary, may raise
 * the vehicle's odometer, and is also an expense (created, updated or deleted with it), so
 * refetch the vehicle's fuel data, the vehicles and every expense view.
 */
function useSyncFuel() {
  const queryClient = useQueryClient();
  return (vehicleId: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: fuelKeys.vehicle(vehicleId) }),
      queryClient.invalidateQueries({ queryKey: vehicleKeys.all }),
      queryClient.invalidateQueries({ queryKey: expenseKeys.all }),
      queryClient.invalidateQueries({ queryKey: expenseKeys.categories }),
    ]);
}

// The form shows errors inline (applyServerErrors), so these opt out of the global error toast.
const handledByForm = () => {};

export function useCreateFuelEntry() {
  const sync = useSyncFuel();
  return useMutation({
    mutationFn: ({ vehicleId, values }: { vehicleId: string; values: CreateFuelEntryValues }) =>
      fuelService.create(vehicleId, values),
    onSuccess: async (entry) => {
      // The fuel page shows the active vehicle: make it the one just logged.
      useActiveVehicleStore.getState().setActiveVehicleId(entry.vehicleId);
      await sync(entry.vehicleId);
      toast.success("Fill-up saved.");
    },
    onError: handledByForm,
  });
}

export function useUpdateFuelEntry(vehicleId: string, id: string) {
  const sync = useSyncFuel();
  return useMutation({
    mutationFn: (values: UpdateFuelEntryValues) => fuelService.update(vehicleId, id, values),
    onSuccess: async () => {
      await sync(vehicleId);
      toast.success("Fill-up updated.");
    },
    onError: handledByForm,
  });
}

export function useDeleteFuelEntry() {
  const queryClient = useQueryClient();
  const sync = useSyncFuel();
  return useMutation({
    mutationFn: (entry: FuelEntry) => fuelService.remove(entry.vehicleId, entry.id),
    onSuccess: async (_, entry) => {
      queryClient.removeQueries({ queryKey: fuelKeys.detail(entry.vehicleId, entry.id) });
      await sync(entry.vehicleId);
      toast.success("Fill-up deleted.");
    },
  });
}
