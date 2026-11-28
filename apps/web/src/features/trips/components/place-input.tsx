import type { PlaceResult } from "@automate/shared";
import { MapPin, Search } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { tripsService } from "@/features/trips/services/trips-service";

export type PlaceValue = { label: string; latitude: number | null; longitude: number | null };

/**
 * A place: typed freely, or searched (Enter or the search button) and picked from the results,
 * which pins its coordinates. Explicit searches only: OpenStreetMap's Nominatim policy forbids
 * search-as-you-type. Editing the text unpins it.
 */
export function PlaceInput({
  id,
  value,
  onChange,
  placeholder,
  invalid,
  label,
}: {
  id?: string;
  value: PlaceValue;
  onChange: (value: PlaceValue) => void;
  placeholder?: string;
  invalid?: boolean;
  /** Names the search button and results for screen readers. */
  label: string;
}) {
  const [results, setResults] = useState<PlaceResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const pinned = value.latitude != null && value.longitude != null;

  const search = async () => {
    if (value.label.trim().length < 2) return;
    setSearching(true);
    setFailed(false);
    try {
      setResults(await tripsService.searchPlaces(value.label.trim()));
    } catch {
      setFailed(true);
      setResults(null);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="relative flex flex-col gap-1.5">
      <div className="flex gap-2">
        <div className="relative flex-1">
          {pinned && (
            <MapPin
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-primary"
              aria-hidden
            />
          )}
          <Input
            id={id}
            value={value.label}
            aria-invalid={invalid}
            aria-description={pinned ? "Place chosen from the search" : undefined}
            placeholder={placeholder}
            maxLength={120}
            className={pinned ? "pl-8" : undefined}
            onChange={(event) => {
              setResults(null);
              onChange({ label: event.target.value, latitude: null, longitude: null });
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void search();
              }
            }}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Search places for ${label}`}
          disabled={searching || value.label.trim().length < 2}
          onClick={() => void search()}
        >
          {searching ? <Spinner /> : <Search />}
        </Button>
      </div>
      {failed && (
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t search places right now. You can keep the name as typed.
        </p>
      )}
      {results && (
        <ul
          className="flex flex-col divide-y rounded-lg border bg-popover text-sm shadow-md"
          aria-label={`Places for ${label}`}
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground">No places found. Try another name.</li>
          ) : (
            results.map((place) => (
              <li key={`${place.latitude},${place.longitude}`}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  onClick={() => {
                    onChange(place);
                    setResults(null);
                  }}
                >
                  {place.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
