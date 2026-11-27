import type { CreateFuelEntryValues, FuelEntry, UpdateFuelEntryValues } from "@automate/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { fuelService } from "@/features/fuel/services/fuel-service";
import { vehicleKeys } from "@/features/garage/hooks/use-vehicles";
import { useActiveVehicleStore } from "@/stores/vehicle-store";

export const fuelKeys = {
  vehicle: (vehicleId: string) => ["fuel", vehicleId] as const,
  list: (vehicleId: string) => ["fuel", vehicleId, "list"] as const,
  summary: (vehicleId: string) => ["fuel", vehicleId, "summary"] as const,
  detail: (vehicleId: string, id: string) => ["fuel", vehicleId, "detail", id] as const,
};

/** A vehicle's fill-ups, newest first. `vehicleId` may be empty while the garage loads. */
export function useFuelEntries(vehicleId: string | undefined) {
  return useQuery({
    queryKey: fuelKeys.list(vehicleId ?? ""),
    queryFn: () => fuelService.list(vehicleId!),
    enabled: !!vehicleId,
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
        .getQueryData<FuelEntry[]>(fuelKeys.list(vehicleId))
        ?.find((entry) => entry.id === id),
  });
}

/**
 * After any write: one entry changes the mileage of its neighbours and the summary, and may raise
 * the vehicle's odometer, so refetch the vehicle's fuel data and the vehicles.
 */
function useSyncFuel() {
  const queryClient = useQueryClient();
  return (vehicleId: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: fuelKeys.vehicle(vehicleId) }),
      queryClient.invalidateQueries({ queryKey: vehicleKeys.all }),
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
