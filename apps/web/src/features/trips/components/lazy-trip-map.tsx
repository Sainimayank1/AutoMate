import { lazy, Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";

const TripMap = lazy(() => import("@/features/trips/components/trip-map"));

/** The map, loaded only when shown (Leaflet stays out of the main bundle). */
export function LazyTripMap(props: Parameters<typeof TripMap>[0]) {
  return (
    <Suspense fallback={<Skeleton className="h-72 w-full rounded-lg" aria-label="Loading map" />}>
      <TripMap {...props} />
    </Suspense>
  );
}
