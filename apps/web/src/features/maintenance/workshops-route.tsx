import { type ProviderProfile } from "@automate/shared";
import { Phone, SearchX, Star, Store } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { Pager } from "@/components/common/pager";
import { SearchInput } from "@/components/common/search-input";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { vehicleName } from "@/features/garage/constants";
import { MaintenanceLayout } from "@/features/maintenance/components/maintenance-layout";
import { WorkshopDialog } from "@/features/maintenance/components/workshop-dialog";
import { PROVIDER_TYPE_LABELS } from "@/features/maintenance/constants";
import { useWorkshops } from "@/features/maintenance/hooks/use-maintenance";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";
import { formatCurrency, formatDate, formatDistance, formatNumber } from "@/utils/format";

type View = "all" | "preferred" | "archived";
const VIEWS: [View, string][] = [
  ["all", "All"],
  ["preferred", "Preferred"],
  ["archived", "Archived"],
];
const filtersOf = (view: View) =>
  view === "preferred" ? { preferred: true } : view === "archived" ? { archived: true } : {};

/**
 * Stitch "Maintenance Workshops — Desktop / Mobile": the user's workshops (shared by all their
 * vehicles), preferred first, with visits and what was spent there (from Expenses).
 */
export function Component() {
  const vehicle = useActiveVehicle().activeVehicle;
  const [params, setParams] = useSearchParams();
  const raw = params.get("view");
  const view: View = raw === "preferred" || raw === "archived" ? raw : "all";
  const search = params.get("search") ?? "";
  const deferredSearch = useDeferredValue(search.trim());
  const page = Math.max(1, Number(params.get("page")) || 1);
  const list = useWorkshops({
    ...filtersOf(view),
    page,
    ...(deferredSearch && { search: deferredSearch }),
  });
  // Just the counts for the chips.
  const counts = {
    all: useWorkshops({ pageSize: 1 }).data?.meta.total,
    preferred: useWorkshops({ preferred: true, pageSize: 1 }).data?.meta.total,
    archived: useWorkshops({ archived: true, pageSize: 1 }).data?.meta.total,
  };
  const [adding, setAdding] = useState(false);

  const update = (changes: Record<string, string | null>) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        if (!("page" in changes)) next.delete("page");
        return next;
      },
      { replace: true },
    );

  const addButton = (
    <Button onClick={() => setAdding(true)}>
      <Store data-icon="inline-start" />
      Add workshop
    </Button>
  );
  const items = list.data?.items;
  return (
    <MaintenanceLayout
      tab="workshops"
      description={vehicle && `${vehicleName(vehicle)} · ${formatDistance(vehicle.odometerKm)}`}
      actions={addButton}
    >
      <section className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter workshops">
            {VIEWS.map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={view === value ? "default" : "outline"}
                aria-pressed={view === value}
                className="rounded-full"
                onClick={() => update({ view: value === "all" ? null : value })}
              >
                {label}
                {counts[value] !== undefined && (
                  <span className="tabular-nums opacity-80">{formatNumber(counts[value])}</span>
                )}
              </Button>
            ))}
          </div>
          <SearchInput
            value={search}
            onValueChange={(value) => update({ search: value || null })}
            placeholder="Search workshops"
            aria-label="Search workshops"
            className="w-full sm:w-64"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Your workshops are shared by all your vehicles. Spending comes from Expenses, net of
          refunds.
        </p>
      </section>

      {list.isError && !list.data ? (
        <ErrorState
          title="Couldn't load workshops"
          error={list.error}
          onRetry={() => void list.refetch()}
        />
      ) : !items ? (
        <div
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          aria-busy="true"
          aria-label="Loading workshops"
        >
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        search ? (
          <EmptyState
            className="rounded-xl border border-dashed"
            icon={SearchX}
            title="No workshops match"
            description="Try another search."
            action={
              <Button variant="outline" onClick={() => update({ search: null })}>
                Clear search
              </Button>
            }
          />
        ) : view === "archived" ? (
          <EmptyState
            className="rounded-xl border border-dashed"
            icon={Store}
            title="No archived workshops"
            description="Archived workshops leave your suggestions but keep their history."
          />
        ) : view === "preferred" ? (
          <EmptyState
            className="rounded-xl border border-dashed"
            icon={Star}
            title="No preferred workshops"
            description="Mark a workshop preferred to see it first in lists and suggestions."
          />
        ) : (
          <EmptyState
            className="rounded-xl border border-dashed"
            icon={Store}
            title="No workshops yet"
            description="Workshops you type in service records appear here. Add one to keep its contact details."
            action={addButton}
          />
        )
      ) : (
        <>
          <ul className="grid items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map((workshop) => (
              <li key={workshop.id}>
                <WorkshopCard workshop={workshop} />
              </li>
            ))}
          </ul>
          {list.data!.meta.totalPages > 1 && (
            <Pager
              page={page}
              pageCount={list.data!.meta.totalPages}
              onPageChange={(next) => update({ page: String(next) })}
            />
          )}
        </>
      )}
      <WorkshopDialog open={adding} onOpenChange={setAdding} />
    </MaintenanceLayout>
  );
}

function WorkshopCard({ workshop }: { workshop: ProviderProfile }) {
  const { stats } = workshop;
  return (
    <article className="relative flex h-full flex-col justify-between gap-4 rounded-xl border bg-card p-5 transition-colors hover:border-primary/50">
      <div className="flex flex-col gap-3">
        <div className="min-w-0">
          <h2 className="font-medium">
            {/* The whole card opens the workshop; the phone stays its own link. */}
            <Link
              to={`/maintenance/workshops/${workshop.id}`}
              className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
            >
              {workshop.name}
            </Link>
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{PROVIDER_TYPE_LABELS[workshop.type]}</Badge>
            {workshop.preferred && (
              <Badge variant="outline" className="border-transparent bg-warning/15 text-warning">
                <Star data-icon="inline-start" className="fill-current" aria-hidden />
                Preferred
              </Badge>
            )}
          </div>
        </div>
        {workshop.city || workshop.phone ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground tabular-nums">
            {workshop.city}
            {workshop.city && workshop.phone && <span aria-hidden>·</span>}
            {workshop.phone && (
              <a
                href={`tel:${workshop.phone.replace(/[\s()-]/g, "")}`}
                className="relative z-10 inline-flex items-center gap-1 hover:text-foreground hover:underline"
              >
                <Phone className="size-3.5 text-muted-foreground" aria-hidden />
                {workshop.phone}
              </a>
            )}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No contact details</p>
        )}
      </div>
      <p className="border-t pt-3 text-sm text-muted-foreground tabular-nums">
        {stats.visits === 0 ? (
          "No visits yet"
        ) : (
          <>
            {stats.visits} {stats.visits === 1 ? "visit" : "visits"} · Last{" "}
            {formatDate(stats.lastVisit!)} ·{" "}
            <span className="font-medium text-foreground">{formatCurrency(stats.spent)} spent</span>
          </>
        )}
      </p>
    </article>
  );
}
