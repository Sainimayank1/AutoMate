import { MapPin, RotateCw, X } from "lucide-react";
import { useEffect, useId } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { useAddressAt, useCurrentLocation } from "@/features/fuel/hooks/use-current-location";
import { formatNumber } from "@/utils/format";

import type { FuelFormValues } from "./fuel-form-model";

const coordinates = (latitude: number, longitude: number) =>
  `${formatNumber(latitude, { minFractionDigits: 5, maxFractionDigits: 5 })}, ${formatNumber(longitude, { minFractionDigits: 5, maxFractionDigits: 5 })}`;

/**
 * Where the fill-up happened. Read-only: adding takes the device's position when the form opens
 * and looks up its address; the user can only refresh it or leave it out. Editing keeps what was
 * recorded (or lets it be removed). Saved as latitude/longitude plus the address, for a future map.
 */
export function LocationField({ capture }: { capture: boolean }) {
  const id = useId();
  const { control, getValues, setValue } = useFormContext<FuelFormValues>();
  const [latitude, longitude, address] = useWatch({
    control,
    name: ["latitude", "longitude", "location"],
  });
  const { state, locate } = useCurrentLocation();
  const found = state.status === "found" ? state : null;
  const lookup = useAddressAt(found);

  useEffect(() => {
    if (capture) locate();
  }, [capture, locate]);

  // Each fix fills the coordinates once. Not marked dirty: an automatic value alone isn't an
  // unsaved change. After "Remove", nothing comes back until the next refresh.
  useEffect(() => {
    if (!found) return;
    setValue("latitude", found.latitude);
    setValue("longitude", found.longitude);
    setValue("location", "");
  }, [found, setValue]);

  // The address arrives later (up to seconds): use it only if the form still holds that fix, so
  // a "Remove" made while it was loading stays removed.
  useEffect(() => {
    if (!found || !lookup.data) return;
    const { latitude, longitude } = getValues();
    if (latitude === found.latitude && longitude === found.longitude) {
      setValue("location", lookup.data.address ?? "");
    }
  }, [found, lookup.data, getValues, setValue]);

  const remove = () => {
    setValue("latitude", null, { shouldDirty: true });
    setValue("longitude", null, { shouldDirty: true });
    setValue("location", "", { shouldDirty: true });
  };

  const hasPlace = latitude !== null && longitude !== null;
  const text = hasPlace
    ? address || (lookup.isFetching ? "Looking up the address…" : coordinates(latitude, longitude))
    : state.status === "locating"
      ? "Finding your location…"
      : state.status === "denied"
        ? "Location access is blocked for this site"
        : state.status === "unavailable"
          ? "Couldn't get your location"
          : "Not recorded";
  const busy = state.status === "locating" || (hasPlace && !address && lookup.isFetching);

  return (
    <Field>
      <FieldLabel htmlFor={id}>
        Location <span className="font-normal text-muted-foreground">(automatic)</span>
      </FieldLabel>
      <InputGroup className="h-10">
        <InputGroupAddon>{busy ? <Spinner /> : <MapPin aria-hidden />}</InputGroupAddon>
        <InputGroupInput
          id={id}
          readOnly
          value={text}
          aria-describedby={`${id}-hint`}
          className={hasPlace ? undefined : "text-muted-foreground"}
        />
        <InputGroupAddon align="inline-end">
          {capture && state.status !== "locating" && (
            <InputGroupButton size="icon-xs" aria-label="Refresh location" onClick={locate}>
              <RotateCw />
            </InputGroupButton>
          )}
          {hasPlace && (
            <InputGroupButton size="icon-xs" aria-label="Remove location" onClick={remove}>
              <X />
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
      <FieldDescription id={`${id}-hint`}>
        {state.status === "denied"
          ? "Allow location for this site in your browser, then refresh. The fill-up saves without it."
          : "Recorded from your device so you can see where you filled up. Address data © OpenStreetMap contributors."}
      </FieldDescription>
    </Field>
  );
}
