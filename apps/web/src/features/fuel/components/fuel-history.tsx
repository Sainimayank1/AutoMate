import { FUEL_UNIT, type FuelEntry, MileageStatus } from "@automate/shared";
import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "cn";
import { CircleDashed, EllipsisVertical, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DataTable } from "@/components/common/data-table";
import { SearchInput } from "@/components/common/search-input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { efficiencyUnit, MILEAGE_STATUS_TEXT } from "@/features/fuel/constants";
import { useDeleteFuelEntry } from "@/features/fuel/hooks/use-fuel";
import { FUEL_TYPE_LABELS } from "@/features/garage/constants";
import {
  formatCurrency,
  formatDate,
  formatDistance,
  formatEfficiency,
  formatNumber,
  formatVolume,
} from "@/utils/format";

const FILTERS = [
  { id: "all", label: "All logs", match: () => true },
  { id: "full", label: "Full tank", match: (entry: FuelEntry) => entry.isFullTank },
  { id: "partial", label: "Partial tank", match: (entry: FuelEntry) => !entry.isFullTank },
] as const;

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

/** Stitch "Fuel" history: filter chips and a table on desktop, a compact list on phones. */
export function FuelHistory({ entries, showFuel }: { entries: FuelEntry[]; showFuel: boolean }) {
  const [filterId, setFilterId] = useState<FilterId>("all");
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<FuelEntry | null>(null);
  const remove = useDeleteFuelEntry();

  const query = search.trim().toLowerCase();
  const filter = FILTERS.find((item) => item.id === filterId)!;
  const shown = entries.filter(
    (entry) =>
      filter.match(entry) &&
      (!query ||
        [entry.stationName, entry.location, entry.notes, FUEL_TYPE_LABELS[entry.fuelType]].some(
          (text) => text?.toLowerCase().includes(query),
        )),
  );

  const columns: ColumnDef<FuelEntry>[] = [
    {
      id: "date",
      header: "Date",
      accessorFn: (entry) => entry.filledAt,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {formatDate(row.original.filledAt)}
        </span>
      ),
    },
    {
      id: "station",
      header: "Station",
      enableSorting: false,
      cell: ({ row }) => fillLabel(row.original, showFuel),
    },
    {
      id: "odometer",
      header: () => <div className="text-right">Odometer</div>,
      accessorFn: (entry) => entry.odometerKm,
      cell: ({ row }) => (
        <div className="text-right font-mono text-muted-foreground tabular-nums">
          {formatDistance(row.original.odometerKm)}
        </div>
      ),
    },
    {
      id: "quantity",
      header: () => <div className="text-right">Quantity</div>,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="text-right font-mono text-muted-foreground tabular-nums">
          {formatVolume(row.original.quantity, FUEL_UNIT[row.original.fuelType])}
        </div>
      ),
    },
    {
      id: "mileage",
      header: () => <div className="text-right">Mileage</div>,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="text-right">
          <MileageCell entry={row.original} />
        </div>
      ),
    },
    {
      id: "total",
      header: () => <div className="text-right">Total</div>,
      // Sort order only; the cell shows the API's exact string.
      accessorFn: (entry) => Number(entry.totalAmount),
      cell: ({ row }) => (
        <div className="text-right tabular-nums">{formatCurrency(row.original.totalAmount)}</div>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="text-right">
          <RowActions entry={row.original} onDelete={() => setDeleting(row.original)} />
        </div>
      ),
    },
  ];

  const empty = query ? "No fill-ups match your search." : "No fill-ups of this kind yet.";

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
              onClick={() => setFilterId(item.id)}
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
            Showing {formatNumber(shown.length)} {shown.length === 1 ? "fill-up" : "fill-ups"}
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

      <div className="max-md:hidden">
        <DataTable columns={columns} data={shown} empty={empty} />
      </div>

      <ul className="flex flex-col divide-y rounded-lg border md:hidden">
        {shown.length === 0 && (
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

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this fill-up?"
        description={
          deleting
            ? `The ${formatDate(deleting.filledAt)} fill-up of ${formatVolume(deleting.quantity, FUEL_UNIT[deleting.fuelType])} (${formatCurrency(deleting.totalAmount)}) will be removed and mileage recalculated. This can't be undone.`
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
