import { type ProviderProfile } from "@automate/shared";
import { cn } from "cn";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Mail,
  MapPin,
  MoreVertical,
  Pencil,
  Phone,
  SearchX,
  Star,
  Trash2,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { PageContainer } from "@/components/common/page-container";
import { Pager } from "@/components/common/pager";
import { EmptyState } from "@/components/feedback/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { vehicleName } from "@/features/garage/constants";
import { useVehicles } from "@/features/garage/hooks/use-vehicles";
import { LogServiceButton } from "@/features/maintenance/components/add-schedule-button";
import { WorkshopDialog } from "@/features/maintenance/components/workshop-dialog";
import { PROVIDER_TYPE_LABELS, RECORD_TYPE_LABELS } from "@/features/maintenance/constants";
import {
  useArchiveWorkshop,
  useDeleteWorkshop,
  useUpdateWorkshop,
  useWorkshop,
  useWorkshopVisits,
} from "@/features/maintenance/hooks/use-maintenance";
import { formatCurrency, formatDate, formatDistance } from "@/utils/format";

/**
 * Stitch "Workshop Details — Desktop / Mobile": visits, what was spent (from Expenses, net of
 * refunds), the visit history across the user's vehicles, contact and notes. Actions: log a
 * service, edit, preferred, archive / restore, delete (only with no history).
 */
export function Component() {
  const { providerId = "" } = useParams();
  const navigate = useNavigate();
  const { data: workshop, isPending } = useWorkshop(providerId);
  const archive = useArchiveWorkshop();
  const remove = useDeleteWorkshop();
  const prefer = useUpdateWorkshop(providerId);
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);

  if (isPending) {
    return (
      <PageContainer>
        <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading workshop">
          <Skeleton className="h-16 w-80" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </PageContainer>
    );
  }
  if (!workshop) {
    return (
      <PageContainer>
        <EmptyState
          className="rounded-xl border border-dashed"
          icon={SearchX}
          title="Workshop not found"
          description="It may have been deleted."
          action={
            <Button variant="outline" asChild>
              <Link to="/maintenance/workshops">Back to workshops</Link>
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const { stats } = workshop;
  const archived = !!workshop.archivedAt;
  return (
    <PageContainer>
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <Link
            to="/maintenance/workshops"
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Workshops
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">{workshop.name}</h1>
            <Badge variant="secondary">{PROVIDER_TYPE_LABELS[workshop.type]}</Badge>
            {workshop.preferred && (
              <Badge variant="outline" className="border-transparent bg-warning/15 text-warning">
                <Star data-icon="inline-start" className="fill-current" aria-hidden />
                Preferred
              </Badge>
            )}
          </div>
          {workshop.city && <p className="text-sm text-muted-foreground">{workshop.city}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!archived && <LogServiceButton />}
          <Button variant="outline" onClick={() => setDialog("edit")}>
            <Pencil data-icon="inline-start" />
            Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions">
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!archived && (
                <DropdownMenuItem
                  onSelect={() =>
                    prefer
                      .mutateAsync({ preferred: !workshop.preferred })
                      .catch(() => toast.error("Couldn't update the workshop."))
                  }
                >
                  <Star />
                  {workshop.preferred ? "Unmark preferred" : "Mark preferred"}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => archive.mutate({ workshop, archived: !archived })}>
                {archived ? <ArchiveRestore /> : <Archive />}
                {archived ? "Restore" : "Archive"}
              </DropdownMenuItem>
              {stats.visits === 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
                    <Trash2 />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </section>

      {archived && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          <span>Archived. Hidden from suggestions; its history stays.</span>
          <Button
            variant="link"
            className="h-auto p-0"
            onClick={() => archive.mutate({ workshop, archived: false })}
          >
            Restore
          </Button>
        </div>
      )}

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Summary">
        <Stat label="Visits">{stats.visits}</Stat>
        <Stat label="Total spent" caption="From Expenses, net of refunds">
          {formatCurrency(stats.spent)}
        </Stat>
        <Stat label="Last visit">{stats.lastVisit ? formatDate(stats.lastVisit) : "—"}</Stat>
        <Stat label="First visit">{stats.firstVisit ? formatDate(stats.firstVisit) : "—"}</Stat>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-12">
        <Visits workshop={workshop} />
        <div className="flex flex-col gap-6 lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {!workshop.phone && !workshop.email && !workshop.address ? (
                <p className="text-muted-foreground">
                  No contact details. Edit the workshop to add them.
                </p>
              ) : (
                <>
                  {workshop.phone && (
                    <ContactRow icon={Phone}>
                      <a
                        href={`tel:${workshop.phone.replace(/[\s()-]/g, "")}`}
                        className="text-primary hover:underline"
                      >
                        {workshop.phone}
                      </a>
                    </ContactRow>
                  )}
                  {workshop.email && (
                    <ContactRow icon={Mail}>
                      <a
                        href={`mailto:${workshop.email}`}
                        className="break-all text-primary hover:underline"
                      >
                        {workshop.email}
                      </a>
                    </ContactRow>
                  )}
                  {workshop.address && (
                    <ContactRow icon={MapPin}>
                      <span className="whitespace-pre-line">{workshop.address}</span>
                    </ContactRow>
                  )}
                </>
              )}
            </CardContent>
          </Card>
          {workshop.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-line">{workshop.notes}</p>
              </CardContent>
            </Card>
          )}
          {stats.visits > 0 && !archived && (
            <p className="text-sm text-muted-foreground">
              This workshop has {stats.visits} {stats.visits === 1 ? "visit" : "visits"}, so it
              can't be deleted. Archive it to hide it from suggestions; its history stays.
            </p>
          )}
        </div>
      </div>

      <WorkshopDialog
        workshop={workshop}
        open={dialog === "edit"}
        onOpenChange={(open) => setDialog(open ? "edit" : null)}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(open) => setDialog(open ? "delete" : null)}
        title={`Delete ${workshop.name}?`}
        description="It has no visits, components or inspections, so nothing else changes."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          await remove.mutateAsync(workshop);
          navigate("/maintenance/workshops", { replace: true });
        }}
      />
    </PageContainer>
  );
}

function Stat({
  label,
  caption,
  children,
}: {
  label: string;
  caption?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-heading text-xl font-semibold tabular-nums">{children}</span>
      {caption && <span className="text-xs text-muted-foreground">{caption}</span>}
    </div>
  );
}

function ContactRow({ icon: Icon, children }: { icon: typeof Phone; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      {children}
    </div>
  );
}

function Visits({ workshop }: { workshop: ProviderProfile }) {
  const [page, setPage] = useState(1);
  const visits = useWorkshopVisits(workshop.id, { page });
  const vehicles = [
    ...(useVehicles().data ?? []),
    ...(useVehicles({ archived: true }).data ?? []),
  ];
  const items = visits.data?.items;
  return (
    <Card className="lg:col-span-8">
      <CardHeader>
        <CardTitle>Visit history</CardTitle>
        <CardDescription>All your vehicles</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!items ? (
          <Skeleton className="h-32 rounded-lg" aria-label="Loading visits" />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No visits yet. Type this workshop's name when you log a service.
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {items.map((record) => {
              const car = vehicles.find((vehicle) => vehicle.id === record.vehicleId);
              const free = Number(record.totalAmount) === 0;
              return (
                <li key={record.id}>
                  <Link
                    to={`/maintenance/records/${record.vehicleId}/${record.id}`}
                    className="flex items-start justify-between gap-3 py-3 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        <span className="text-muted-foreground tabular-nums">
                          {formatDate(record.serviceDate)}
                        </span>{" "}
                        · {record.title}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground tabular-nums">
                        <Badge variant="secondary">{RECORD_TYPE_LABELS[record.type]}</Badge>
                        {[
                          car && vehicleName(car),
                          record.odometerKm !== null && formatDistance(record.odometerKm),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-sm font-medium tabular-nums",
                        free && "text-muted-foreground",
                      )}
                    >
                      {free ? "No charge" : formatCurrency(record.totalAmount)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {visits.data && visits.data.meta.totalPages > 1 && (
          <Pager page={page} pageCount={visits.data.meta.totalPages} onPageChange={setPage} />
        )}
      </CardContent>
    </Card>
  );
}
