import {
  type ComponentHistoryEntry,
  componentKindName,
  type MaintenanceGroupKey,
  type VehicleComponentDetail,
} from "@automate/shared";
import { cn } from "cn";
import {
  ArrowLeft,
  MoreVertical,
  Pencil,
  RefreshCw,
  ScanSearch,
  SearchX,
  ShieldCheck,
  Trash2,
  Unplug,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { PageContainer } from "@/components/common/page-container";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { RecordAttachments } from "@/features/attachments/components/record-attachments";
import { InspectDialog, RemoveDialog } from "@/features/maintenance/components/component-dialogs";
import {
  COMPONENT_STATUS_META,
  CONDITION_LABELS,
  GROUP_ICONS,
  INSPECTION_CONDITION_META,
  SCHEDULE_STATUS_META,
  TONE_PROGRESS,
  TONE_TEXT,
} from "@/features/maintenance/constants";
import { useComponent, useDeleteComponent } from "@/features/maintenance/hooks/use-maintenance";
import { kindGroup, lifeText, warrantyText } from "@/features/maintenance/utils/component-text";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";
import { formatDate, formatDistance, formatNumber } from "@/utils/format";

const HISTORY_LABELS: Record<ComponentHistoryEntry["type"], string> = {
  INSTALLED: "Installed",
  INSPECTED: "Inspected",
  REPLACED: "Replaced",
  REMOVED: "Removed",
  SERVICED: "Serviced",
};

/**
 * Stitch "Component Details": the part's estimated life per track (always called an estimate),
 * its lifecycle (fitted, inspections, records that worked on it, replaced or removed), details,
 * warranty and the schedules watching it. Actions: record inspection, replace, edit, mark
 * removed, delete. A part taken off is read-only and links to its successor.
 */
export function Component() {
  const { componentId = "" } = useParams();
  const navigate = useNavigate();
  const vehicle = useActiveVehicle().activeVehicle;
  const { data: part, isPending } = useComponent(vehicle?.id ?? "", componentId);
  const remove = useDeleteComponent();
  const [dialog, setDialog] = useState<"inspect" | "remove" | "delete" | null>(null);

  if (isPending || !vehicle) {
    return (
      <PageContainer>
        <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading component">
          <Skeleton className="h-16 w-80" />
          <div className="grid gap-6 lg:grid-cols-12">
            <Skeleton className="h-72 rounded-xl lg:col-span-8" />
            <Skeleton className="h-72 rounded-xl lg:col-span-4" />
          </div>
        </div>
      </PageContainer>
    );
  }
  if (!part) {
    return (
      <PageContainer>
        <EmptyState
          className="rounded-xl border border-dashed"
          icon={SearchX}
          title="Component not found"
          description="It may have been deleted, or it belongs to another vehicle."
          action={
            <Button variant="outline" asChild>
              <Link to="/maintenance/components">Back to components</Link>
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const meta = COMPONENT_STATUS_META[part.status];
  const Icon = GROUP_ICONS[kindGroup(part.kind) as MaintenanceGroupKey];
  const fitted = part.state === "INSTALLED";
  return (
    <PageContainer>
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <Link
            to="/maintenance/components"
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Components
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <div
              className={cn(
                "flex size-11 items-center justify-center rounded-md border bg-muted",
                TONE_TEXT[meta.tone],
              )}
            >
              <Icon className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-heading text-2xl font-semibold tracking-tight">{part.name}</h1>
                <StatusBadge tone={meta.tone} icon={meta.icon} label={meta.label} />
              </div>
              <p className="text-sm text-muted-foreground">
                {[part.brand, part.partNumber && `part ${part.partNumber}`, part.position]
                  .filter(Boolean)
                  .join(" · ") || componentKindName(part.kind)}
              </p>
            </div>
          </div>
        </div>
        {fitted && (
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" onClick={() => setDialog("inspect")}>
              <ScanSearch data-icon="inline-start" />
              Record inspection
            </Button>
            <Button asChild>
              <Link to={`/maintenance/components/${part.id}/replace`}>
                <RefreshCw data-icon="inline-start" />
                Replace
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More actions">
                  <MoreVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to={`/maintenance/components/${part.id}/edit`}>
                    <Pencil />
                    Edit
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDialog("remove")}>
                  <Unplug />
                  Mark removed
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
                  <Trash2 />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </section>

      {!fitted && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          <span>
            {part.state === "REPLACED" ? "Replaced" : "Removed"}
            {part.removedAt && ` on ${formatDate(part.removedAt)}`}
            {part.removedKm !== null && ` at ${formatDistance(part.removedKm)}`}
            {part.replacedBy && ` by ${part.replacedBy.name}`}. Its history is kept and read-only.
          </span>
          {part.replacedBy && (
            <Link
              to={`/maintenance/components/${part.replacedBy.id}`}
              className="font-medium text-primary hover:underline"
            >
              View the new part
            </Link>
          )}
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-8">
          <LifeCard part={part} />
          <Lifecycle part={part} />
        </div>
        <div className="flex flex-col gap-6 lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-2.5 text-sm">
                <Row label="Kind">{componentKindName(part.kind)}</Row>
                {part.position && <Row label="Position">{part.position}</Row>}
                {part.brand && <Row label="Brand">{part.brand}</Row>}
                {part.partNumber && <Row label="Part number">{part.partNumber}</Row>}
                <Row label="Installed">
                  {[
                    part.installedAt && formatDate(part.installedAt),
                    part.installedKm !== null && formatDistance(part.installedKm),
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Not recorded"}
                </Row>
                {part.provider && <Row label="Workshop">{part.provider.name}</Row>}
                <Row label="Condition">{CONDITION_LABELS[part.condition]}</Row>
                {part.replaces && (
                  <Row label="Replaces">
                    <Link
                      to={`/maintenance/components/${part.replaces.id}`}
                      className="text-primary hover:underline"
                    >
                      {part.replaces.name}
                    </Link>
                  </Row>
                )}
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" aria-hidden />
                Warranty
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={cn("text-sm tabular-nums", part.warrantyActive && "text-success")}>
                {warrantyText(part) ?? "No warranty recorded"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Linked schedules</CardTitle>
            </CardHeader>
            <CardContent>
              {part.schedules.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No schedule watches this part. Link one from a schedule's "Component" field.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {part.schedules.map((schedule) => (
                    <li
                      key={schedule.id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <Link
                        to={`/maintenance/schedules/${schedule.id}`}
                        className="hover:underline"
                      >
                        {schedule.name}
                      </Link>
                      <span
                        className={cn(
                          "text-xs",
                          TONE_TEXT[SCHEDULE_STATUS_META[schedule.status].tone],
                        )}
                      >
                        {SCHEDULE_STATUS_META[schedule.status].label}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          {part.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-line">{part.notes}</p>
              </CardContent>
            </Card>
          )}
          <RecordAttachments owner="component" ownerId={part.id} title="Warranty card & photos" />
        </div>
      </div>

      {fitted && (
        <>
          <InspectDialog
            part={part}
            open={dialog === "inspect"}
            onOpenChange={(open) => setDialog(open ? "inspect" : null)}
          />
          <RemoveDialog
            part={part}
            open={dialog === "remove"}
            onOpenChange={(open) => setDialog(open ? "remove" : null)}
          />
        </>
      )}
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(open) => setDialog(open ? "delete" : null)}
        title={`Delete ${part.name}?`}
        description="Its lifecycle history is deleted. Service records and schedules that mention it are kept. To keep the history, mark it removed instead."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          await remove.mutateAsync(part);
          navigate("/maintenance/components", { replace: true });
        }}
      />
    </PageContainer>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{children}</dd>
    </div>
  );
}

function LifeCard({ part }: { part: VehicleComponentDetail }) {
  const { life } = part;
  const tone = COMPONENT_STATUS_META[part.status].tone;
  const track = (label: string, used: number, total: number, unit: string) => (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          {formatNumber(used)} of {formatNumber(total)} {unit}
        </span>
      </div>
      <Progress
        value={Math.min(100, Math.round((used / total) * 100))}
        aria-label={`${label} used`}
        className={cn("h-1.5", TONE_PROGRESS[tone])}
      />
    </div>
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Estimated life</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!life ? (
          <p className="text-sm text-muted-foreground">
            No lifespan set. Add an expected life in km or months (with the install point) to see an
            estimate.
          </p>
        ) : (
          <>
            {life.kmUsed !== null &&
              part.expectedLifeKm !== null &&
              track("Distance", life.kmUsed, part.expectedLifeKm, "km")}
            {life.monthsUsed !== null &&
              part.expectedLifeMonths !== null &&
              track("Time", life.monthsUsed, part.expectedLifeMonths, "months")}
            <p className="text-sm">{lifeText(part)}</p>
            {part.state === "INSTALLED" && (life.estimatedDate || life.estimatedKm !== null) && (
              <p className="text-sm text-muted-foreground tabular-nums">
                Estimated replacement around{" "}
                {[
                  life.estimatedDate && formatDate(life.estimatedDate),
                  life.estimatedKm !== null && formatDistance(life.estimatedKm),
                ]
                  .filter(Boolean)
                  .join(" or ")}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Estimates from the lifespan you set; not a guarantee.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Lifecycle({ part }: { part: VehicleComponentDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lifecycle</CardTitle>
      </CardHeader>
      <CardContent>
        {part.history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing recorded yet. Inspections, services that list this part, and its replacement
            appear here.
          </p>
        ) : (
          <ol className="relative flex flex-col gap-4 border-l pl-5">
            {part.history.map((entry, index) => (
              <li key={`${entry.type}-${entry.date}-${index}`} className="relative">
                <span
                  aria-hidden
                  className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full bg-muted-foreground ring-4 ring-card"
                />
                <p className="text-sm font-medium">
                  {HISTORY_LABELS[entry.type]}{" "}
                  <span className="font-normal text-muted-foreground tabular-nums">
                    {[
                      formatDate(entry.date),
                      entry.odometerKm !== null && formatDistance(entry.odometerKm),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </p>
                {entry.condition && (
                  <p className="text-sm text-muted-foreground">
                    Condition: {CONDITION_LABELS[entry.condition]}
                  </p>
                )}
                {entry.checklistCondition && (
                  <p className="text-sm text-muted-foreground">
                    Found:{" "}
                    <span
                      className={
                        TONE_TEXT[INSPECTION_CONDITION_META[entry.checklistCondition].tone]
                      }
                    >
                      {INSPECTION_CONDITION_META[entry.checklistCondition].label}
                    </span>
                  </p>
                )}
                {entry.inspectionId && entry.inspectionTitle && (
                  <Link
                    to={`/maintenance/inspections/${entry.inspectionId}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {entry.inspectionTitle}
                  </Link>
                )}
                {entry.recordId && entry.recordTitle && (
                  <Link
                    to={`/maintenance/records/${part.vehicleId}/${entry.recordId}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {entry.recordTitle}
                  </Link>
                )}
                {entry.notes && <p className="text-sm text-muted-foreground">{entry.notes}</p>}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
