import { z } from "zod";

/** Maps contract: place search and routes through the configured OpenStreetMap-style providers. */

export const latitudeSchema = z.number({ error: "Choose a place" }).min(-90).max(90);
export const longitudeSchema = z.number({ error: "Choose a place" }).min(-180).max(180);

/** `POST /geocode/search` (a body, so place names stay out of request logs). */
export const placeSearchSchema = z.object({
  query: z
    .string()
    .trim()
    .min(2, "Type at least 2 letters")
    .max(120, "Use 120 characters or fewer"),
});

export const routePointSchema = z.object({ latitude: latitudeSchema, longitude: longitudeSchema });
export const ROUTE_POINTS_MAX = 12;

/** `POST /trips/routes/calculate`: origin, stops in order, destination. */
export const routeCalculateSchema = z.object({
  points: z
    .array(routePointSchema)
    .min(2, "Choose where from and where to")
    .max(ROUTE_POINTS_MAX, `Up to ${ROUTE_POINTS_MAX} places`),
});

export type PlaceSearchValues = z.output<typeof placeSearchSchema>;
export type RoutePoint = z.output<typeof routePointSchema>;
export type RouteCalculateValues = z.output<typeof routeCalculateSchema>;

export interface PlaceResult {
  label: string;
  latitude: number;
  longitude: number;
}

/** One way to drive it, as the provider returned it. */
export interface RouteOption {
  distanceKm: string;
  durationMinutes: number;
  /** Encoded polyline, precision 6 (`decodePolyline`). */
  geometry: string;
}

export interface RouteResult {
  /** "OpenStreetMap (OSRM)" */
  provider: string;
  /** The provider's best route first; alternatives only when it offers them. */
  routes: RouteOption[];
}

/** An encoded polyline (Google's algorithm) as [latitude, longitude] pairs. */
export function decodePolyline(encoded: string, precision = 6): [number, number][] {
  const factor = 10 ** precision;
  const points: [number, number][] = [];
  let [index, lat, lng] = [0, 0, 0];
  const next = () => {
    let [result, shift, byte] = [0, 0, 0];
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < encoded.length) {
    lat += next();
    lng += next();
    points.push([lat / factor, lng / factor]);
  }
  return points;
}
