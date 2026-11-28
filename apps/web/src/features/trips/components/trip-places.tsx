import type { RouteOption, RoutePoint, RouteResult, Trip } from "@automate/shared";
import { ArrowDown, ArrowUp, Plus, Route, X } from "lucide-react";
import { useState } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { LazyTripMap } from "@/features/trips/components/lazy-trip-map";
import { PlaceInput, type PlaceValue } from "@/features/trips/components/place-input";
import type { TripFormValues } from "@/features/trips/components/trip-form-model";
import { tripsService } from "@/features/trips/services/trips-service";
import { durationText } from "@/features/trips/utils/trip-text";
import { normalizeApiError } from "@/lib/api-error";
import { formatDistance } from "@/utils/format";

type Pinned = { label: string; latitude: number; longitude: number };

/** The form's places in order (start, stops, end) that were chosen from the search. */
function usePinnedPlaces(): { places: Pinned[]; complete: boolean } {
  const { control } = useFormContext<TripFormValues>();
  const [origin, originLat, originLng, destination, destinationLat, destinationLng, stops] =
    useWatch({
      control,
      name: [
        "origin",
        "originLat",
        "originLng",
        "destination",
        "destinationLat",
        "destinationLng",
        "stops",
      ],
    });
  const all = [
    { label: origin, latitude: originLat, longitude: originLng },
    ...(stops ?? []),
    { label: destination, latitude: destinationLat, longitude: destinationLng },
  ];
  const places = all.filter(
    (place): place is Pinned => place.latitude != null && place.longitude != null,
  );
  return { places, complete: places.length === all.length };
}

/** From, the stops in order (add, move, remove) and To; each place typed or searched. */
export function PlacesFields() {
  const form = useFormContext<TripFormValues>();
  const { control, formState } = form;
  // keyName: the stops' own fields stay theirs.
  const stops = useFieldArray({ control, name: "stops", keyName: "key" });
  const values = useWatch({ control });

  const end = (which: "origin" | "destination", label: string, placeholder: string) => {
    const lat = which === "origin" ? "originLat" : "destinationLat";
    const lng = which === "origin" ? "originLng" : "destinationLng";
    const value: PlaceValue = {
      label: values[which] ?? "",
      latitude: values[lat] ?? null,
      longitude: values[lng] ?? null,
    };
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`trip-${which}`}>
          {label} <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <PlaceInput
          id={`trip-${which}`}
          label={label}
          value={value}
          placeholder={placeholder}
          invalid={!!formState.errors[which]}
          onChange={(next) => {
            form.setValue(which, next.label, {
              shouldDirty: true,
              shouldValidate: formState.isSubmitted,
            });
            form.setValue(lat, next.latitude, { shouldDirty: true });
            form.setValue(lng, next.longitude, { shouldDirty: true });
          }}
        />
        <FieldError errors={[formState.errors[which]]} />
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {end("origin", "From", "e.g. Hisar")}
      {stops.fields.length > 0 && (
        <ol className="flex flex-col gap-3 border-l-2 border-dashed pl-4" aria-label="Stops">
          {stops.fields.map((stop, index) => {
            const current = values.stops?.[index];
            return (
              <li key={stop.key} className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">Stop {index + 1}</span>
                  <span className="flex gap-1">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Move stop ${index + 1} up`}
                      disabled={index === 0}
                      onClick={() => stops.move(index, index - 1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Move stop ${index + 1} down`}
                      disabled={index === stops.fields.length - 1}
                      onClick={() => stops.move(index, index + 1)}
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Remove stop ${index + 1}`}
                      onClick={() => stops.remove(index)}
                    >
                      <X />
                    </Button>
                  </span>
                </div>
                <PlaceInput
                  label={`stop ${index + 1}`}
                  value={{
                    label: current?.label ?? "",
                    latitude: current?.latitude ?? null,
                    longitude: current?.longitude ?? null,
                  }}
                  placeholder="e.g. Chandigarh"
                  invalid={!!formState.errors.stops?.[index]?.label}
                  onChange={(next) => {
                    form.setValue(`stops.${index}.label`, next.label, { shouldDirty: true });
                    form.setValue(`stops.${index}.latitude`, next.latitude, { shouldDirty: true });
                    form.setValue(`stops.${index}.longitude`, next.longitude, {
                      shouldDirty: true,
                    });
                  }}
                />
                <FieldError
                  errors={[
                    formState.errors.stops?.[index]?.label,
                    // Itinerary rules a reorder can break (days are set in the itinerary).
                    formState.errors.stops?.[index]?.day,
                    formState.errors.stops?.[index]?.overnight,
                  ]}
                />
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`stop-${index}-arrival`} className="text-xs">
                      Arrived (optional)
                    </Label>
                    <Input
                      id={`stop-${index}-arrival`}
                      type="time"
                      {...form.register(`stops.${index}.arrivalTime`)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`stop-${index}-departure`} className="text-xs">
                      Left (optional)
                    </Label>
                    <Input
                      id={`stop-${index}-departure`}
                      type="time"
                      {...form.register(`stops.${index}.departureTime`)}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={stops.fields.length >= 10}
        onClick={() =>
          stops.append({
            label: "",
            latitude: null,
            longitude: null,
            arrivalTime: "",
            departureTime: "",
          })
        }
      >
        <Plus data-icon="inline-start" />
        Add stop
      </Button>
      {end("destination", "To", "e.g. Manali")}
    </div>
  );
}

/**
 * Method Route: the provider's routes through the pinned places, on a map, one chosen. The
 * server measures the chosen route again when saving; nothing here is invented.
 */
export function RoutePreview({
  stored,
  onChoose,
}: {
  stored?: Trip["route"];
  /** The route picked (the planner budgets on its distance). */
  onChoose?: (route: RouteOption) => void;
}) {
  const form = useFormContext<TripFormValues>();
  const routeIndex = useWatch({ control: form.control, name: "routeIndex" });
  const { places, complete } = usePinnedPlaces();
  const key = places.map((place) => `${place.latitude},${place.longitude}`).join(";");
  const [result, setResult] = useState<{ key: string; routes: RouteResult } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A preview of other places doesn't apply any more.
  const current = result?.key === key ? result.routes : null;
  const showStored = !current && stored && complete && !form.formState.dirtyFields.stops;

  const choose = (routes: RouteResult, index: number) => {
    form.setValue("routeIndex", index, { shouldDirty: true });
    const route = routes.routes[index];
    if (route) onChoose?.(route);
  };

  const calculate = async () => {
    setLoading(true);
    setError(null);
    try {
      const points: RoutePoint[] = places.map(({ latitude, longitude }) => ({
        latitude,
        longitude,
      }));
      const routes = await tripsService.calculateRoute(points);
      setResult({ key, routes });
      choose(routes, 0);
    } catch (failure) {
      setError(normalizeApiError(failure).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Choose From, To and any stops in the search, then calculate the route. The distance comes
        from OpenStreetMap&apos;s route (no live traffic).
      </p>
      <Button
        type="button"
        variant="outline"
        className="w-fit"
        disabled={!complete || places.length < 2 || loading}
        onClick={() => void calculate()}
      >
        {loading ? <Spinner data-icon="inline-start" /> : <Route data-icon="inline-start" />}
        Calculate route
      </Button>
      {error && (
        <p className="text-sm text-warning" role="alert">
          {error}
        </p>
      )}
      {current && (
        <>
          <LazyTripMap places={places} geometry={current.routes[routeIndex]?.geometry} />
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Route options">
            {current.routes.map((route, index) => (
              <button
                key={index}
                type="button"
                role="radio"
                aria-checked={routeIndex === index}
                onClick={() => choose(current, index)}
                className={`rounded-lg border p-3 text-left text-sm ${routeIndex === index ? "border-primary bg-primary/5" : ""}`}
              >
                <span className="font-medium">
                  {index === 0 ? "Best route" : `Alternative ${index}`}
                </span>{" "}
                · {formatDistance(route.distanceKm)} · {durationText(route.durationMinutes)}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Route by {current.provider}</p>
        </>
      )}
      {showStored && (
        <>
          <LazyTripMap places={places} geometry={stored.geometry} />
          <p className="text-sm text-muted-foreground">
            Saved route: {formatDistance(stored.distanceKm)} ·{" "}
            {durationText(stored.durationMinutes)} ({stored.provider})
          </p>
        </>
      )}
    </div>
  );
}
