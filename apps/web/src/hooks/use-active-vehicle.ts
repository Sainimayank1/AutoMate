import type { Vehicle } from "@automate/shared";

import { useVehicles } from "@/features/garage/hooks/use-vehicles";
import { useActiveVehicleStore } from "@/stores/vehicle-store";

/**
 * The vehicle every module works on. The choice is remembered per device; if it no longer exists
 * (deleted, archived, another account) the first vehicle in the garage stands in.
 */
export function useActiveVehicle() {
  const query = useVehicles();
  const activeVehicleId = useActiveVehicleStore((state) => state.activeVehicleId);
  const setActiveVehicleId = useActiveVehicleStore((state) => state.setActiveVehicleId);

  const vehicles = query.data ?? [];
  const activeVehicle: Vehicle | null =
    vehicles.find((vehicle) => vehicle.id === activeVehicleId) ?? vehicles[0] ?? null;

  return { ...query, vehicles, activeVehicle, setActiveVehicleId };
}
