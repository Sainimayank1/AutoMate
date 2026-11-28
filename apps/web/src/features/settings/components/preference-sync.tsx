import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";

import { usePreferences } from "@/features/settings/hooks/use-settings";
import { useActiveVehicleStore } from "@/stores/vehicle-store";

/**
 * Applies the account's preferences once per sign-in: its theme, and its default vehicle when no
 * vehicle is active yet on this device. Later changes on this device win until the next sign-in.
 */
export function PreferenceSync() {
  const preferences = usePreferences();
  const { setTheme } = useTheme();
  const applied = useRef(false);
  useEffect(() => {
    const data = preferences.data;
    if (!data || applied.current) return;
    applied.current = true;
    setTheme(data.theme.toLowerCase());
    const store = useActiveVehicleStore.getState();
    if (!store.activeVehicleId && data.defaultVehicleId)
      store.setActiveVehicleId(data.defaultVehicleId);
  }, [preferences.data, setTheme]);
  return null;
}
