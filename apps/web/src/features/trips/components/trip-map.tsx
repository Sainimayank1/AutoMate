import "leaflet/dist/leaflet.css";

import { decodePolyline } from "@automate/shared";
import { latLngBounds } from "leaflet";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip } from "react-leaflet";

import { env } from "@/lib/env";

const TILES = env.VITE_MAP_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export type MapPlace = { label: string; latitude: number; longitude: number };

/**
 * A trip on an OpenStreetMap map: the provider's route line when there is one, the start (muted),
 * numbered stops and the end (primary) as markers. Never a drawn guess: no route, no line.
 * Loaded lazily (Leaflet is only fetched when a map is shown).
 */
export default function TripMap({
  places,
  geometry,
  className,
}: {
  /** Start, stops in order, end; only the pinned ones. */
  places: MapPlace[];
  /** Encoded polyline (precision 6) from the route provider. */
  geometry?: string | null;
  className?: string;
}) {
  const line = geometry ? decodePolyline(geometry) : [];
  const points = [
    ...line,
    ...places.map((place) => [place.latitude, place.longitude] as [number, number]),
  ];
  if (!points.length) return null;
  const bounds = latLngBounds(points).pad(0.1);
  return (
    <MapContainer
      bounds={bounds}
      scrollWheelZoom={false}
      className={className ?? "h-72 w-full rounded-lg"}
      aria-label="Trip map"
    >
      <TileLayer url={TILES} attribution={ATTRIBUTION} />
      {line.length > 0 && (
        <Polyline positions={line} pathOptions={{ color: "var(--primary)", weight: 4 }} />
      )}
      {places.map((place, index) => {
        const last = index === places.length - 1 && places.length > 1;
        return (
          <CircleMarker
            key={`${place.label}-${index}`}
            center={[place.latitude, place.longitude]}
            radius={index === 0 || last ? 7 : 5}
            pathOptions={{
              color: last ? "var(--primary)" : "var(--muted-foreground)",
              fillColor: last ? "var(--primary)" : "var(--muted-foreground)",
              fillOpacity: 1,
            }}
          >
            <Tooltip>
              {index === 0 ? "From" : last ? "To" : `Stop ${index}`}: {place.label}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
