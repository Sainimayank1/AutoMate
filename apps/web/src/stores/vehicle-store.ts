import { create } from "zustand";
import { persist } from "zustand/middleware";

type ActiveVehicleState = {
  /** Selected vehicle id. Vehicle data itself comes from TanStack Query, never from here. */
  activeVehicleId: string | null;
  setActiveVehicleId: (id: string | null) => void;
};

export const useActiveVehicleStore = create<ActiveVehicleState>()(
  persist(
    (set) => ({
      activeVehicleId: null,
      setActiveVehicleId: (activeVehicleId) => set({ activeVehicleId }),
    }),
    { name: "automate.active-vehicle" },
  ),
);
