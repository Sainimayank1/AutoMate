import { FUEL_UNIT, type FuelEntry, MileageStatus } from "@automate/shared";
import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "cn";
import { CircleDashed, EllipsisVertical, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DataTable } from "@/components/common/data-table";
import { Pager } from "@/components/common/pager";
import { SearchInput } from "@/components/common/search-input";
import { ErrorState } from "@/components/feedback/error-state";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { efficiencyUnit, MILEAGE_STATUS_TEXT } from "@/features/fuel/constants";
import { useDeleteFuelEntry, useFuelEntries } from "@/features/fuel/hooks/use-fuel";
import { FUEL_TYPE_LABELS } from "@/features/garage/constants";
import {
  formatCurrency,
  formatDate,
  formatDistance,
  formatEfficiency,
  formatNumber,
  formatVolume,
} from "@/utils/format";

/** Filter chips; the API filters (`tank`), so mileage still comes from the whole history. */
const FILTERS = [
  { id: "all", label: "All logs" },
  { id: "full", label: "Full tank" },
  { id: "partial", label: "Partial tank" },
] as const;

const SEARCH_DELAY_MS = 300;

type FilterId = (typeof FILTERS)[number]["id"];

const editHref = (entry: FuelEntry) => `/fuel/${entry.vehicleId}/${entry.id}/edit`;

/** "IndianOil XP95 · Full", plus the fuel on bi-fuel vehicles. */
function fillLabel(entry: FuelEntry, showFuel: boolean) {
  return [
    entry.stationName ?? "Fill-up",
    entry.isFullTank ? "Full" : "Partial",
    showFuel && FUEL_TYPE_LABELS[entry.fuelType],
  ]
    .filter(Boolean)
    .join(" · ");
}

/** The figure, or why there's none (muted and explained, never a warning). */
function MileageCell({ entry, compact }: { entry: FuelEntry; compact?: boolean }) {
  if (entry.mileageStatus === MileageStatus.CALCULATED) {
    return (
      <span className="font-mono tabular-nums">
        {formatEfficiency(entry.mileage, efficiencyUnit(entry.fuelType))}
      </span>
    );
  }
  const { label, hint } = MILEAGE_STATUS_TEXT[entry.mileageStatus];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CircleDashed className="size-3.5 shrink-0" aria-hidden />
          {compact ? "—" : label}
          <span className="sr-only">. {hint}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-60">{hint}</TooltipContent>
    </Tooltip>
  );
}

function RowActions({ entry, onDelete }: { entry: FuelEntry; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Actions for ${formatDate(entry.filledAt)} fill-up`}
        >
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link to={editHref(entry)}>
            <Pencil />
            Edit
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Stitch "Fuel" history: filter chips and a table on desktop, a compact list on phones.
 * Server-paged (every list endpoint is): filters, search and the page are API query params.
 */
export function FuelHistory({ vehicleId, showFuel }: { vehicleId: string; showFuel: boolean }) {
  const [filterId, setFilterId] = useState<FilterId>("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<FuelEntry | null>(null);
  const remove = useDeleteFuelEntry();

  // Search once typing pauses, from the first page.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const list = useFuelEntries(vehicleId, {
    page,
    tank: filterId === "all" ? undefined : filterId,
    search: query || undefined,
  });
  const shown = list.data?.items ?? [];
  const meta = list.data?.meta;
  const total = meta?.total ?? 0;

  // The list shrank under this page (a delete here or in another tab): adjust while rendering.
  const lastPage = Math.max(meta?.totalPages ?? 1, 1);
  if (meta && page > lastPage) setPage(lastPage);

  const columns: ColumnDef<FuelEntry>[] = [
    {
      id: "date",
      header: "Date",
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {formatDate(row.original.filledAt)}
        </span>
      ),
    },
    {
      id: "station",
      header: "Station",
      cell: ({ row }) => fillLabel(row.original, showFuel),
    },
    {
      id: "odometer",
      header: () => <div className="text-right">Odometer</div>,
      cell: ({ row }) => (
        <div className="text-right font-mono text-muted-foreground tabular-nums">
          {formatDistance(row.original.odometerKm)}
        </div>
      ),
    },
    {
      id: "quantity",
      header: () => <div className="text-right">Quantity</div>,
      cell: ({ row }) => (
        <div className="text-right font-mono text-muted-foreground tabular-nums">
          {formatVolume(row.original.quantity, FUEL_UNIT[row.original.fuelType])}
        </div>
      ),
    },
    {
      id: "mileage",
      header: () => <div className="text-right">Mileage</div>,
      cell: ({ row }) => (
        <div className="text-right">
          <MileageCell entry={row.original} />
        </div>
      ),
    },
    {
      id: "total",
      header: () => <div className="text-right">Total</div>,
      cell: ({ row }) => (
        <div className="text-right tabular-nums">{formatCurrency(row.original.totalAmount)}</div>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="text-right">
          <RowActions entry={row.original} onDelete={() => setDeleting(row.original)} />
        </div>
      ),
    },
  ];

  const empty = query ? "No fill-ups match your search." : "No fill-ups of this kind yet.";
  const pager = meta && (
    <Pager page={meta.page} pageCount={meta.totalPages} onPageChange={setPage} />
  );

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filter fill-ups" className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <Button
              key={item.id}
              variant="outline"
              size="sm"
              aria-pressed={item.id === filterId}
              onClick={() => {
                setFilterId(item.id);
                setPage(1);
              }}
              className={cn(
                item.id === filterId &&
                  "border-primary bg-secondary text-primary hover:text-primary",
              )}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <div className="flex w-full items-center gap-3 sm:w-auto">
          <span
            className="text-sm whitespace-nowrap text-muted-foreground max-sm:hidden"
            aria-live="polite"
          >
            {formatNumber(total)} {total === 1 ? "fill-up" : "fill-ups"}
          </span>
          <SearchInput
            value={search}
            onValueChange={setSearch}
            placeholder="Search stations, notes…"
            aria-label="Search fill-ups"
            className="h-9 w-full sm:w-64"
          />
        </div>
      </div>

      {list.isError && !list.data ? (
        <ErrorState
          title="Couldn't load fill-ups"
          error={list.error}
          onRetry={() => void list.refetch()}
        />
      ) : (
        <>
          <div className="max-md:hidden">
            <DataTable
              columns={columns}
              data={shown}
              empty={empty}
              loading={list.isPending}
              paginate={false}
            />
          </div>

          <ul className="flex flex-col divide-y rounded-lg border md:hidden">
            {!list.isPending && shown.length === 0 && (
              <li className="p-6 text-center text-sm text-muted-foreground">{empty}</li>
            )}
            {shown.map((entry) => (
              <li key={entry.id} className="flex items-center gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{fillLabel(entry, showFuel)}</p>
                  <p className="truncate text-xs text-muted-foreground tabular-nums">
                    {formatDate(entry.filledAt)} ·{" "}
                    {formatVolume(entry.quantity, FUEL_UNIT[entry.fuelType])} ·{" "}
                    {formatDistance(entry.odometerKm)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-sm font-medium tabular-nums">
                    {formatCurrency(entry.totalAmount)}
                  </span>
                  <MileageCell entry={entry} compact />
                </div>
                <RowActions entry={entry} onDelete={() => setDeleting(entry)} />
              </li>
            ))}
          </ul>
          {pager}
        </>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this fill-up?"
        description={
          deleting
            ? `The ${formatDate(deleting.filledAt)} fill-up of ${formatVolume(deleting.quantity, FUEL_UNIT[deleting.fuelType])} (${formatCurrency(deleting.totalAmount)}) will be removed with its expense, and mileage recalculated. This can't be undone.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (deleting) await remove.mutateAsync(deleting);
        }}
      />
    </section>
  );
}
