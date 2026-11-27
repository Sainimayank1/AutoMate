import { TripMethod } from "@automate/shared";
import { format, parseISO } from "date-fns";
import { SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";

import { DatePicker } from "@/components/common/date-picker";
import { NumberInput } from "@/components/common/number-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { METHOD_LABELS } from "@/features/trips/constants";
import { TRIP_FILTER_KEYS, type useTripHistory } from "@/features/trips/hooks/use-trip-history";
import { formatDate, formatDistance } from "@/utils/format";

type History = ReturnType<typeof useTripHistory>;
type Draft = Record<(typeof TRIP_FILTER_KEYS)[number], string>;
const ANY = "any";

const LABELS: Record<keyof Draft, (value: string) => string> = {
  from: (value) => `From ${formatDate(value)}`,
  to: (value) => `To ${formatDate(value)}`,
  minKm: (value) => `Over ${formatDistance(value)}`,
  maxKm: (value) => `Under ${formatDistance(value)}`,
  method: (value) => METHOD_LABELS[value as TripMethod],
  origin: (value) => `From "${value}"`,
  destination: (value) => `To "${value}"`,
};

/**
 * Stitch "Trip History" filters: dates, distance, how it was measured, and where from / to, edited
 * in a popover and applied together (a single request), then shown as removable chips.
 */
export function TripFilters({ history }: { history: History }) {
  const read = (): Draft =>
    Object.fromEntries(TRIP_FILTER_KEYS.map((key) => [key, history.raw(key)])) as Draft;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(read);
  const field = (key: keyof Draft) => ({
    value: draft[key],
    onChange: (value: string) => setDraft((current) => ({ ...current, [key]: value })),
  });
  const date = (key: "from" | "to", label: string) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`trip-filter-${key}`}>{label}</Label>
      <DatePicker
        id={`trip-filter-${key}`}
        value={draft[key] ? parseISO(draft[key]) : undefined}
        onChange={(next) => field(key).onChange(next ? format(next, "yyyy-MM-dd") : "")}
        disabledDates={{ after: new Date() }}
        placeholder="DD/MM/YYYY"
      />
    </div>
  );
  const km = (key: "minKm" | "maxKm", label: string) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`trip-filter-${key}`}>{label}</Label>
      <NumberInput
        id={`trip-filter-${key}`}
        value={draft[key]}
        onChange={(value) => field(key).onChange(value.replace(/,/g, ""))}
        suffix="km"
        decimals={1}
        placeholder="0"
      />
    </div>
  );
  const text = (key: "origin" | "destination", label: string) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`trip-filter-${key}`}>{label}</Label>
      <Input
        id={`trip-filter-${key}`}
        value={draft[key]}
        onChange={(event) => field(key).onChange(event.target.value)}
        maxLength={120}
      />
    </div>
  );

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (next) setDraft(read());
          setOpen(next);
        }}
      >
        <PopoverTrigger asChild>
          <Button variant="outline">
            <SlidersHorizontal data-icon="inline-start" />
            Filters
            {history.active.length > 0 && <Badge className="ml-0.5">{history.active.length}</Badge>}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="flex w-80 flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            {date("from", "From date")}
            {date("to", "To date")}
            {km("minKm", "Over")}
            {km("maxKm", "Under")}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="trip-filter-method">How measured</Label>
            <Select
              value={draft.method || ANY}
              onValueChange={(value) => field("method").onChange(value === ANY ? "" : value)}
            >
              <SelectTrigger id="trip-filter-method" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any</SelectItem>
                {Object.values(TripMethod).map((method) => (
                  <SelectItem key={method} value={method}>
                    {METHOD_LABELS[method]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {text("origin", "From contains")}
          {text("destination", "To contains")}
          <div className="flex justify-between gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                history.set(Object.fromEntries(TRIP_FILTER_KEYS.map((key) => [key, null])));
                setOpen(false);
              }}
            >
              Clear all
            </Button>
            <Button
              onClick={() => {
                history.set(
                  Object.fromEntries(TRIP_FILTER_KEYS.map((key) => [key, draft[key] || null])),
                );
                setOpen(false);
              }}
            >
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {history.active.length > 0 && (
        <ul className="flex w-full flex-wrap gap-2" aria-label="Active filters">
          {history.active.map((key) => (
            <li key={key}>
              <Badge variant="secondary" className="gap-1 pr-1">
                {LABELS[key](history.raw(key))}
                <button
                  type="button"
                  className="rounded-sm p-0.5 hover:bg-muted"
                  aria-label={`Remove filter: ${LABELS[key](history.raw(key))}`}
                  onClick={() => history.set({ [key]: null })}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
