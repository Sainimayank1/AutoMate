import type { UpdateVehicleValues, Vehicle } from "@automate/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { vehicleName } from "@/features/garage/constants";
import { vehicleService } from "@/features/garage/services/vehicle-service";
import { useActiveVehicleStore } from "@/stores/vehicle-store";

export const vehicleKeys = {
  all: ["vehicles"] as const,
  list: (archived: boolean) => ["vehicles", "list", { archived }] as const,
  detail: (id: string) => ["vehicles", "detail", id] as const,
};

/** Vehicles in use (default) or the archived ones. */
export function useVehicles({ archived = false }: { archived?: boolean } = {}) {
  return useQuery({
    queryKey: vehicleKeys.list(archived),
    queryFn: () => vehicleService.list({ archived }),
  });
}

export function useVehicle(id: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: vehicleKeys.detail(id),
    queryFn: () => vehicleService.get(id),
    // Show the card's data instantly when coming from the garage list.
    placeholderData: () =>
      [false, true]
        .flatMap(
          (archived) => queryClient.getQueryData<Vehicle[]>(vehicleKeys.list(archived)) ?? [],
        )
        .find((vehicle) => vehicle.id === id),
  });
}

/** After any write: store the fresh vehicle and refetch the lists (counts, filters, archive state). */
function useSyncVehicle() {
  const queryClient = useQueryClient();
  return (vehicle: Vehicle) => {
    queryClient.setQueryData(vehicleKeys.detail(vehicle.id), vehicle);
    return queryClient.invalidateQueries({ queryKey: ["vehicles", "list"] });
  };
}

// The forms show errors inline (applyServerErrors), so these opt out of the global error toast.
const handledByForm = () => {};

export function useCreateVehicle() {
  const sync = useSyncVehicle();
  return useMutation({
    mutationFn: vehicleService.create,
    onSuccess: async (vehicle) => {
      // Skill rule: a newly added vehicle becomes the active one.
      useActiveVehicleStore.getState().setActiveVehicleId(vehicle.id);
      await sync(vehicle);
      toast.success(`${vehicleName(vehicle)} added to your garage.`);
    },
    onError: handledByForm,
  });
}

export function useUpdateVehicle(id: string) {
  const sync = useSyncVehicle();
  return useMutation({
    mutationFn: (values: UpdateVehicleValues) => vehicleService.update(id, values),
    onSuccess: async (vehicle) => {
      await sync(vehicle);
      toast.success("Vehicle updated.");
    },
    onError: handledByForm,
  });
}

export function useArchiveVehicle() {
  const sync = useSyncVehicle();
  return useMutation({
    mutationFn: vehicleService.archive,
    onSuccess: async (vehicle) => {
      await sync(vehicle);
      toast.success(`${vehicleName(vehicle)} archived. Its records are kept.`);
    },
  });
}

export function useRestoreVehicle() {
  const sync = useSyncVehicle();
  return useMutation({
    mutationFn: vehicleService.restore,
    onSuccess: async (vehicle) => {
      await sync(vehicle);
      toast.success(`${vehicleName(vehicle)} restored.`);
    },
  });
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vehicle: Vehicle) => vehicleService.remove(vehicle.id),
    onSuccess: async (_, vehicle) => {
      queryClient.removeQueries({ queryKey: vehicleKeys.detail(vehicle.id) });
      await queryClient.invalidateQueries({ queryKey: ["vehicles", "list"] });
      toast.success(`${vehicleName(vehicle)} deleted.`);
    },
  });
}
