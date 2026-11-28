import { REPAIR_RECORD_TYPES, type ServiceRecord } from "@automate/shared";
import { cn } from "cn";
import { Car, History, List, SearchX } from "lucide-react";
import { Link } from "react-router";

import { Pager } from "@/components/common/pager";
import { SearchInput } from "@/components/common/search-input";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { vehicleName } from "@/features/garage/constants";
import {
  AddScheduleButton,
  LogServiceButton,
} from "@/features/maintenance/components/add-schedule-button";
import {
  HistoryFilterChips,
  HistoryFilters,
} from "@/features/maintenance/components/history-filters";
import { MaintenanceLayout } from "@/features/maintenance/components/maintenance-layout";
import { RECORD_TYPE_LABELS } from "@/features/maintenance/constants";
import { useHistoryFilters } from "@/features/maintenance/hooks/use-history-filters";
import {
  useServiceRecords,
  useServiceRecordSummary,
} from "@/features/maintenance/hooks/use-maintenance";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";
import { formatCurrency, formatDate, formatDistance, formatNumber } from "@/utils/format";

const recordHref = (record: ServiceRecord) =>
  `/maintenance/records/${record.vehicleId}/${record.id}`;
const monthHeading = new Intl.DateTimeFormat("en-IN", { month: "long", timeZone: "UTC" });

/** "2026 · May" groups, newest first (the API already orders the page). */
function byMonth(records: ServiceRecord[]) {
  const groups: { heading: string; records: ServiceRecord[] }[] = [];
  for (const record of records) {
    const date = new Date(`${record.serviceDate}T00:00:00.000Z`);
    const heading = `${date.getUTCFullYear()} · ${monthHeading.format(date)}`;
    const last = groups.at(-1);
    if (last?.heading === heading) last.records.push(record);
    else groups.push({ heading, records: [record] });
  }
  return groups;
}

/**
 * Stitch "Service History — Desktop / Mobile": the vehicle's whole logbook (historical records
 * included), searched and filtered by the API, as a timeline grouped by month or as a list, a page
 * at a time, with the count and total of everything that matches.
 * Deviation: no attachments until Documents (maintenance.md §5).
 */
export function Component() {
  const garage = useActiveVehicle();
  const vehicle = garage.activeVehicle;
  const filters = useHistoryFilters();
  const records = useServiceRecords(vehicle?.id, { ...filters.filters, page: filters.page });
  const summary = useServiceRecordSummary(vehicle?.id, filters.filters);
  const filtered = filters.active.length > 0 || !!filters.filters.search;

  if (!garage.isPending && !vehicle) {
    return (
      <MaintenanceLayout tab="history">
        <EmptyState
          className="rounded-xl border border-dashed"
          icon={Car}
          title="Add a vehicle first"
          description="Maintenance is tracked per vehicle in your garage."
          action={
            <Button asChild>
              <Link to="/garage/new">Add vehicle</Link>
            </Button>
          }
        />
      </MaintenanceLayout>
    );
  }

  const items = records.data?.items;
  return (
    <MaintenanceLayout
      tab="history"
      description={vehicle && `${vehicleName(vehicle)} · ${formatDistance(vehicle.odometerKm)}`}
      actions={
        vehicle && (
          <>
            <AddScheduleButton variant="outline" />
            <LogServiceButton />
          </>
        )
      }
    >
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <SearchInput
              value={filters.params.get("q") ?? ""}
              onValueChange={(value) => filters.set({ q: value || null })}
              placeholder="Search title, workshop, parts, notes"
              aria-label="Search service history"
              className="w-full sm:w-80"
            />
            <HistoryFilters filters={filters} />
          </div>
          <ToggleGroup
            type="single"
            variant="outline"
            value={filters.view}
            onValueChange={(view) => view && filters.set({ view: view === "list" ? "list" : null })}
            aria-label="View"
          >
            <ToggleGroupItem value="timeline" aria-label="Timeline">
              <History aria-hidden />
              Timeline
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List">
              <List aria-hidden />
              List
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <HistoryFilterChips filters={filters} />
          {summary.data && summary.data.count > 0 && (
            <p className="ml-auto text-sm text-muted-foreground tabular-nums">
              {formatNumber(summary.data.count)} {summary.data.count === 1 ? "record" : "records"} ·{" "}
              {formatCurrency(summary.data.totalAmount)}
            </p>
          )}
        </div>
      </section>

      {records.isError && !records.data ? (
        <ErrorState
          title="Couldn't load service history"
          error={records.error}
          onRetry={() => void records.refetch()}
        />
      ) : !items ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading service history">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        filtered ? (
          <EmptyState
            className="rounded-xl border border-dashed"
            icon={SearchX}
            title="No records match"
            description="Try adjusting your search or filters."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  filters.clear();
                  filters.set({ q: null });
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            className="rounded-xl border border-dashed"
            icon={History}
            title="No service history"
            description="Your service history will appear here when you start recording services and repairs."
            action={<LogServiceButton />}
          />
        )
      ) : (
        <>
          {filters.view === "list" ? <HistoryList records={items} /> : <Timeline records={items} />}
          {records.data!.meta.totalPages > 1 && (
            <Pager
              page={filters.page}
              pageCount={records.data!.meta.totalPages}
              onPageChange={(page) => filters.set({ page: String(page) })}
            />
          )}
        </>
      )}
    </MaintenanceLayout>
  );
}

function Timeline({ records }: { records: ServiceRecord[] }) {
  return (
    <div className="flex flex-col gap-6">
      {byMonth(records).map((group) => (
        <section key={group.heading} aria-label={group.heading} className="flex flex-col gap-3">
          <h2 className="text-xs font-medium text-muted-foreground">{group.heading}</h2>
          <ol className="relative flex flex-col gap-3 border-l pl-5">
            {group.records.map((record) => {
              const repair = REPAIR_RECORD_TYPES.includes(record.type);
              const [first, second, ...rest] = record.items;
              return (
                <li key={record.id} className="relative">
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-5 -left-[1.6rem] size-2.5 rounded-full ring-4 ring-background",
                      repair ? "bg-warning" : "bg-muted-foreground",
                    )}
                  />
                  <Link
                    to={recordHref(record)}
                    className="flex items-start justify-between gap-4 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {[
                          formatDate(record.serviceDate),
                          record.odometerKm !== null && formatDistance(record.odometerKm),
                          record.provider?.name,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium">{record.title}</h3>
                        <Badge
                          variant="outline"
                          className={cn(repair && "border-transparent bg-warning/15 text-warning")}
                        >
                          {RECORD_TYPE_LABELS[record.type]}
                        </Badge>
                      </div>
                      {first && (
                        <div className="flex flex-wrap gap-1.5">
                          {[first, second].filter(Boolean).map((item) => (
                            <Badge key={item!.id} variant="secondary" className="font-normal">
                              {item!.name}
                            </Badge>
                          ))}
                          {rest.length > 0 && (
                            <Badge variant="secondary" className="font-normal">
                              +{rest.length}
                            </Badge>
                          )}
                        </div>
                      )}
                      {(record.notes ?? record.description) && (
                        <p className="line-clamp-1 text-sm text-muted-foreground">
                          {record.notes ?? record.description}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 font-heading font-medium tabular-nums">
                      {formatCurrency(record.totalAmount)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

function HistoryList({ records }: { records: ServiceRecord[] }) {
  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-card max-md:hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Title &amp; workshop</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Odometer</TableHead>
              <TableHead className="text-right">Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="tabular-nums">{formatDate(record.serviceDate)}</TableCell>
                <TableCell>
                  <Link to={recordHref(record)} className="font-medium hover:underline">
                    {record.title}
                  </Link>
                  {record.provider && (
                    <span className="block text-xs text-muted-foreground">
                      {record.provider.name}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{RECORD_TYPE_LABELS[record.type]}</Badge>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {record.odometerKm !== null ? formatDistance(record.odometerKm) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(record.items.length)}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatCurrency(record.totalAmount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="divide-y rounded-xl border bg-card md:hidden">
        {records.map((record) => (
          <li key={record.id}>
            <Link to={recordHref(record)} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium">{record.title}</p>
                <p className="truncate text-xs text-muted-foreground tabular-nums">
                  {[
                    formatDate(record.serviceDate),
                    record.odometerKm !== null && formatDistance(record.odometerKm),
                    RECORD_TYPE_LABELS[record.type],
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <span className="shrink-0 font-medium tabular-nums">
                {formatCurrency(record.totalAmount)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
