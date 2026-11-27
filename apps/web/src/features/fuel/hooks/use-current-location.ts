import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { fuelService } from "@/features/fuel/services/fuel-service";

export type DevicePosition = { latitude: number; longitude: number };

export type LocationState =
  | { status: "idle" }
  | { status: "locating" }
  | ({ status: "found" } & DevicePosition)
  /** The user (or the browser's settings) said no. */
  | { status: "denied" }
  /** No geolocation API, no fix, or a timeout. */
  | { status: "unavailable" };

/** ~0.1 m: as precise as the column stores, and stable as a query key. */
const round = (value: number) => Math.round(value * 1e6) / 1e6;

/** The device's position, asked for on demand (the browser shows its own permission prompt). */
export function useCurrentLocation() {
  const [state, setState] = useState<LocationState>({ status: "idle" });

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setState({ status: "unavailable" });
      return;
    }
    setState({ status: "locating" });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        setState({
          status: "found",
          latitude: round(coords.latitude),
          longitude: round(coords.longitude),
        }),
      (error) =>
        setState({ status: error.code === error.PERMISSION_DENIED ? "denied" : "unavailable" }),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }, []);

  return { state, locate };
}

/** The address at a position, looked up by the API (cached for the session). */
export function useAddressAt(position: DevicePosition | null) {
  return useQuery({
    queryKey: ["geocode", position?.latitude, position?.longitude],
    queryFn: () => fuelService.addressAt(position!.latitude, position!.longitude),
    enabled: position !== null,
    staleTime: Infinity,
  });
}
