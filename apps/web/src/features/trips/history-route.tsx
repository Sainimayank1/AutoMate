import { type Trip, tripLabel, TripSort } from "@automate/shared";
import { cn } from "cn";
import { format, parseISO } from "date-fns";
import { ListIcon, Plus, Route, SearchX, Trash2, Waypoints } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Pager } from "@/components/common/pager";
import { SearchInput } from "@/components/common/search-input";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { vehicleName } from "@/features/garage/constants";
import { useVehicles } from "@/features/garage/hooks/use-vehicles";
import { TripFilters } from "@/features/trips/components/trip-filters";
import { TripsLayout } from "@/features/trips/components/trips-layout";
import { ALL_VEHICLES, useTripHistory } from "@/features/trips/hooks/use-trip-history";
import {
  useBulkTrips,
  useTripCategories,
  useTrips,
  useTripSummary,
} from "@/features/trips/hooks/use-trips";
import { durationText } from "@/features/trips/utils/trip-text";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";
import { formatCurrency, formatDate, formatDistance, formatNumber } from "@/utils/format";

const ANY = "any";
const SORTS: { value: TripSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "longest", label: "Longest" },
  { value: "shortest", label: "Shortest" },
];

/** Trips by month, in the order the API returned them. */
function byMonth(trips: Trip[]) {
  const groups: { month: string; trips: Trip[] }[] = [];
  for (const trip of trips) {
    const month = trip.date.slice(0, 7);
    const last = groups.at(-1);
    if (last?.month === month) last.trips.push(trip);
    else groups.push({ month, trips: [trip] });
  }
  return groups;
}

/**
 * Stitch "Trip History — Desktop / Mobile": every trip, filtered, searched and sorted on the
 * server, as a timeline by month or a list, with the filtered count and distance; select trips to
 * change their type or delete them together.
 */
export function Component() {
  const garage = useActiveVehicle();
  const vehicles = [...(useVehicles().data ?? []), ...(useVehicles({ archived: true }).data ?? [])];
  const history = useTripHistory(garage.activeVehicle?.id);
  const list = useTrips({ ...history.filters, sort: history.sort, page: history.page });
  const summary = useTripSummary(history.filters);
  const categories = (useTripCategories().data ?? []).filter((category) => !category.archivedAt);
  const bulk = useBulkTrips();
  const [selected, setSelected] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  const items = list.data?.items;
  const filtered = history.active.length > 0 || !!history.search || !!history.filters.categoryId;
  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  const nameOf = (id: string) => {
    const vehicle = vehicles.find((item) => item.id === id);
    return vehicle ? vehicleName(vehicle) : null;
  };
  // Mixed vehicles only when listing all of them.
  const showVehicle = !history.filters.vehicleId;

  return (
    <TripsLayout
      tab="history"
      actions={
        <Button asChild>
          <Link to="/trips/new">
            <Plus data-icon="inline-start" />
            Log trip
          </Link>
        </Button>
      }
    >
      <section className="flex flex-wrap items-center gap-2" aria-label="Find trips">
        <SearchInput
          value={history.search}
          onValueChange={(value) => history.set({ q: value || null })}
          placeholder="Search trips"
          aria-label="Search trips"
          className="w-full sm:w-64"
        />
        <Select value={history.vehicle} onValueChange={(value) => history.set({ vehicle: value })}>
          <SelectTrigger aria-label="Vehicle" className="w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {vehicles.map((vehicle) => (
              <SelectItem key={vehicle.id} value={vehicle.id}>
                {vehicleName(vehicle)}
              </SelectItem>
            ))}
            <SelectItem value={ALL_VEHICLES}>All vehicles</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={history.filters.categoryId ?? ANY}
          onValueChange={(value) => history.set({ type: value === ANY ? null : value })}
        >
          <SelectTrigger aria-label="Trip type" className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All types</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={history.sort}
          onValueChange={(value) => history.set({ sort: value === TripSort.NEWEST ? null : value })}
        >
          <SelectTrigger aria-label="Sort" className="w-full sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((sort) => (
              <SelectItem key={sort.value} value={sort.value}>
                {sort.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <TripFilters history={history} />
        <ToggleGroup
          type="single"
          value={history.view}
          onValueChange={(view) => view && history.set({ view: view === "list" ? "list" : null })}
          variant="outline"
          className="ml-auto"
          aria-label="View"
        >
          <ToggleGroupItem value="timeline" aria-label="Timeline">
            <Waypoints />
            Timeline
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="List">
            <ListIcon />
            List
          </ToggleGroupItem>
        </ToggleGroup>
      </section>
      {summary.data && items && items.length > 0 && (
        <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
          {formatNumber(summary.data.trips)} {summary.data.trips === 1 ? "trip" : "trips"} ·{" "}
          {formatDistance(summary.data.distanceKm)}
        </p>
      )}

      {list.isError && !list.data ? (
        <ErrorState
          title="Couldn't load your trips"
          error={list.error}
          onRetry={() => void list.refetch()}
        />
      ) : !items ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading trips">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        filtered ? (
          <EmptyState
            className="rounded-xl border border-dashed"
            icon={SearchX}
            title="No trips match"
            description="Try other filters or another search."
            action={
              <Button variant="outline" onClick={history.clear}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            className="rounded-xl border border-dashed"
            icon={Route}
            title="No trips yet"
            description="Your journeys will appear here as you start recording trips."
            action={
              <Button asChild>
                <Link to="/trips/new">Log your first trip</Link>
              </Button>
            }
          />
        )
      ) : (
        <>
          {history.view === "list" ? (
            <ul className="divide-y rounded-xl border bg-card">
              {items.map((trip) => (
                <li key={trip.id}>
                  <TripLine
                    trip={trip}
                    vehicle={showVehicle ? nameOf(trip.vehicleId) : null}
                    selected={selected.includes(trip.id)}
                    onSelect={() => toggle(trip.id)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col gap-6">
              {byMonth(items).map((group) => (
                <section key={group.month} aria-labelledby={`month-${group.month}`}>
                  <h2
                    id={`month-${group.month}`}
                    className="mb-2 text-sm font-semibold text-muted-foreground"
                  >
                    {format(parseISO(`${group.month}-01`), "MMMM yyyy")}
                  </h2>
                  <ul className="flex flex-col gap-2">
                    {group.trips.map((trip) => (
                      <li key={trip.id} className="rounded-xl border bg-card">
                        <TripLine
                          trip={trip}
                          vehicle={showVehicle ? nameOf(trip.vehicleId) : null}
                          selected={selected.includes(trip.id)}
                          onSelect={() => toggle(trip.id)}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
          {list.data!.meta.totalPages > 1 && (
            <Pager
              page={history.page}
              pageCount={list.data!.meta.totalPages}
              onPageChange={(next) => history.set({ page: String(next) })}
            />
          )}
        </>
      )}

      {selected.length > 0 && (
        <div
          role="region"
          aria-label="Selected trips"
          className="sticky bottom-4 z-20 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-lg"
        >
          <span className="text-sm font-medium tabular-nums">{selected.length} selected</span>
          <Select
            value=""
            onValueChange={(categoryId) =>
              bulk.mutate(
                { action: "category", ids: selected, categoryId },
                { onSuccess: () => setSelected([]) },
              )
            }
          >
            <SelectTrigger aria-label="Change type" className="w-40">
              <SelectValue placeholder="Change type" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleting(true)}
          >
            <Trash2 data-icon="inline-start" />
            Delete
          </Button>
          <Button variant="ghost" className="ml-auto" onClick={() => setSelected([])}>
            Clear
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${selected.length} ${selected.length === 1 ? "trip" : "trips"}?`}
        description="Their vehicles' odometers stay at the highest readings left."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          await bulk.mutateAsync({ action: "delete", ids: selected });
          setSelected([]);
        }}
      />
    </TripsLayout>
  );
}

function TripLine({
  trip,
  vehicle,
  selected,
  onSelect,
}: {
  trip: Trip;
  vehicle: string | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const label = tripLabel(trip);
  return (
    <div className={cn("flex items-center gap-3 px-4", selected && "bg-primary/5")}>
      <Checkbox checked={selected} onCheckedChange={onSelect} aria-label={`Select ${label}`} />
      <Link
        to={`/trips/${trip.id}`}
        className="flex min-w-0 flex-1 items-start justify-between gap-3 py-3 focus-visible:outline-none focus-visible:underline"
      >
        <div className="min-w-0">
          <p className="truncate font-medium">{label}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground tabular-nums">
            {formatDate(trip.date)}
            <Badge variant="secondary">{trip.category.name}</Badge>
            {vehicle}
          </p>
        </div>
        <div className="shrink-0 text-right text-sm tabular-nums">
          <p className="font-medium">{formatDistance(trip.distanceKm)}</p>
          {trip.actualCost && (
            <p className="text-muted-foreground">{formatCurrency(trip.actualCost)}</p>
          )}
          <p className="text-muted-foreground">
            {trip.method === "DISTANCE"
              ? "Distance entered"
              : trip.durationMinutes !== null
                ? durationText(trip.durationMinutes)
                : null}
          </p>
        </div>
      </Link>
    </div>
  );
}
