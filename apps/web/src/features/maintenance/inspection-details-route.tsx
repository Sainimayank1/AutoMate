import { FLAGGED_CONDITIONS, INSPECTION_AREAS, type InspectionItem } from "@automate/shared";
import { cn } from "cn";
import { ArrowLeft, CalendarCheck, ListPlus, Pencil, SearchX, Trash2, Wrench } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { PageContainer } from "@/components/common/page-container";
import { EmptyState } from "@/components/feedback/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RecordAttachments } from "@/features/attachments/components/record-attachments";
import {
  INSPECTION_CONDITION_META,
  INSPECTION_KIND_LABELS,
  SCHEDULE_STATUS_META,
  TONE_SOFT,
  TONE_TEXT,
} from "@/features/maintenance/constants";
import { useDeleteInspection, useInspection } from "@/features/maintenance/hooks/use-maintenance";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";
import { formatDate, formatDistance } from "@/utils/format";

/**
 * Stitch "Inspection Details": what was found (counts), the findings that need attention (each
 * can be followed up by a schedule, linked both ways), the full checklist by area, and the
 * follow-up. "Log repair" starts a service record from the issues.
 */
export function Component() {
  const { inspectionId = "" } = useParams();
  const navigate = useNavigate();
  const vehicle = useActiveVehicle().activeVehicle;
  const { data: inspection, isPending } = useInspection(vehicle?.id ?? "", inspectionId);
  const remove = useDeleteInspection();
  const [deleting, setDeleting] = useState(false);

  if (isPending || !vehicle) {
    return (
      <PageContainer>
        <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading inspection">
          <Skeleton className="h-16 w-80" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </PageContainer>
    );
  }
  if (!inspection) {
    return (
      <PageContainer>
        <EmptyState
          className="rounded-xl border border-dashed"
          icon={SearchX}
          title="Inspection not found"
          description="It may have been deleted, or it belongs to another vehicle."
          action={
            <Button variant="outline" asChild>
              <Link to="/maintenance/inspections">Back to inspections</Link>
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const { counts } = inspection;
  const flagged = inspection.items.filter((item) => FLAGGED_CONDITIONS.includes(item.condition));
  const areas = INSPECTION_AREAS.flatMap(([area, name]) => {
    const items = inspection.items.filter((item) => item.area === area);
    return items.length ? [{ area, name, items }] : [];
  });
  return (
    <PageContainer>
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <Link
            to="/maintenance/inspections"
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Inspections
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-heading text-2xl font-medium">{inspection.title}</h1>
            <Badge variant={inspection.kind === "PROFESSIONAL" ? "outline" : "secondary"}>
              {INSPECTION_KIND_LABELS[inspection.kind]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground tabular-nums">
            {[
              formatDate(inspection.date),
              inspection.odometerKm !== null && formatDistance(inspection.odometerKm),
              inspection.provider?.name,
              inspection.inspector &&
                `${inspection.kind === "PROFESSIONAL" ? "Inspector" : "Checked by"}: ${inspection.inspector}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {counts.issues > 0 && (
            <Button asChild>
              <Link to={`/maintenance/records/new?inspection=${inspection.id}`}>
                <Wrench data-icon="inline-start" />
                Log repair
              </Link>
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link to={`/maintenance/inspections/${inspection.id}/edit`}>
              <Pencil data-icon="inline-start" />
              Edit
            </Link>
          </Button>
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleting(true)}
          >
            <Trash2 data-icon="inline-start" />
            Delete
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4" aria-label="What was found">
        <Count label="Issues" value={counts.issues} className="text-warning" />
        <Count label="To monitor" value={counts.monitor} className="text-info" />
        <Count label="Good" value={counts.ok} className="text-success" />
        <Count
          label="Not inspected"
          value={counts.notInspected}
          className="text-muted-foreground"
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Needs attention</CardTitle>
        </CardHeader>
        <CardContent>
          {flagged.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing was flagged in this inspection.</p>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {flagged.map((item) => (
                <li key={item.id}>
                  <Finding inspectionId={inspection.id} item={item} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHeader>
            <CardTitle>Full checklist</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {areas.map(({ area, name, items }) => (
              <div key={area} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                <h3 className="text-xs font-medium text-muted-foreground">{name}</h3>
                <ul className="flex flex-col gap-2">
                  {items.map((item) => {
                    const meta = INSPECTION_CONDITION_META[item.condition];
                    return (
                      <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
                        <span className="min-w-0">
                          {item.label}
                          {item.notes && (
                            <span className="block text-muted-foreground">{item.notes}</span>
                          )}
                        </span>
                        <span className={cn("shrink-0 font-medium", TONE_TEXT[meta.tone])}>
                          {meta.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Follow-up &amp; notes</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Follow up by</span>
              <span
                className={cn(
                  "font-medium tabular-nums",
                  inspection.followUpDate && "text-warning",
                )}
              >
                {inspection.followUpDate ? formatDate(inspection.followUpDate) : "Not set"}
              </span>
            </div>
            {inspection.notes && <p className="whitespace-pre-line">{inspection.notes}</p>}
          </CardContent>
        </Card>
      </div>
      <RecordAttachments owner="inspection" ownerId={inspection.id} title="Photos" />

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${inspection.title} (${formatDate(inspection.date)})?`}
        description="Its checklist is deleted. Schedules created from its findings are kept."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          await remove.mutateAsync(inspection);
          navigate("/maintenance/inspections", { replace: true });
        }}
      />
    </PageContainer>
  );
}

function Count({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-card p-4">
      <span className={cn("text-sm font-medium", className)}>{label}</span>
      <span className="font-heading text-2xl font-medium tabular-nums">{value}</span>
    </div>
  );
}

function Finding({ inspectionId, item }: { inspectionId: string; item: InspectionItem }) {
  const meta = INSPECTION_CONDITION_META[item.condition];
  const schedule = item.followUpSchedule;
  return (
    <article
      className={cn("flex h-full flex-col justify-between gap-3 rounded-lg border bg-muted/40 p-4")}
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{item.label}</span>
          <Badge variant="outline" className={cn("shrink-0", TONE_SOFT[meta.tone])}>
            {meta.label}
          </Badge>
        </div>
        {item.notes && <p className="text-sm text-muted-foreground">{item.notes}</p>}
        {item.recommendedAction && (
          <p className={cn("text-sm font-medium", TONE_TEXT[meta.tone])}>
            Action: {item.recommendedAction}
          </p>
        )}
        {item.componentId && item.componentName && (
          <Link
            to={`/maintenance/components/${item.componentId}`}
            className="w-fit text-sm text-primary hover:underline"
          >
            {item.componentName}
          </Link>
        )}
      </div>
      {schedule ? (
        <Link
          to={`/maintenance/schedules/${schedule.id}`}
          className="inline-flex w-fit items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs font-medium text-primary hover:underline"
        >
          <CalendarCheck className="size-3.5" aria-hidden />
          Schedule: {schedule.name} · {SCHEDULE_STATUS_META[schedule.status].label.toLowerCase()}
        </Link>
      ) : (
        <Link
          to={`/maintenance/schedules/new?inspection=${inspectionId}&item=${item.id}`}
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <ListPlus className="size-4" aria-hidden />
          Create schedule
        </Link>
      )}
    </article>
  );
}
