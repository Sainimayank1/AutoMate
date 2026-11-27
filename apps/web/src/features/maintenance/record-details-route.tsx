import { maintenanceCategoryName, type ServiceRecord } from "@automate/shared";
import {
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  MoreVertical,
  Pencil,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { PageContainer } from "@/components/common/page-container";
import { EmptyState } from "@/components/feedback/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { PAYMENT_METHOD_LABELS } from "@/features/fuel/constants";
import { RECORD_TYPE_LABELS } from "@/features/maintenance/constants";
import {
  useDeleteServiceRecord,
  useServiceRecord,
} from "@/features/maintenance/hooks/use-maintenance";
import { formatCurrency, formatDate, formatDistance, formatNumber } from "@/utils/format";

/**
 * Stitch "Service Record Details": a service logbook page. Hero (date, odometer, workshop, total),
 * work done (items that completed schedules link to them), description and notes; the cost
 * breakdown, warranty and the linked expense on the right. Deviation: the linked expense names no
 * category (the API owns that mapping); attachments arrive with Documents (maintenance.md §5).
 */
export function Component() {
  const { vehicleId = "", recordId = "" } = useParams();
  const navigate = useNavigate();
  const { data: record, isPending } = useServiceRecord(vehicleId, recordId);
  const remove = useDeleteServiceRecord();
  const [deleting, setDeleting] = useState(false);

  if (isPending) {
    return (
      <PageContainer>
        <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading service record">
          <Skeleton className="h-16 w-80" />
          <div className="grid gap-6 lg:grid-cols-12">
            <Skeleton className="h-64 rounded-xl lg:col-span-8" />
            <Skeleton className="h-64 rounded-xl lg:col-span-4" />
          </div>
        </div>
      </PageContainer>
    );
  }
  if (!record) {
    return (
      <PageContainer>
        <EmptyState
          className="rounded-xl border border-dashed"
          icon={Trash2}
          title="Service record not found"
          description="It may have been deleted, or it isn't yours."
          action={
            <Button variant="outline" asChild>
              <Link to="/maintenance">Back to maintenance</Link>
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const edit = `/maintenance/records/${vehicleId}/${recordId}/edit`;
  return (
    <PageContainer>
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <Link
            to="/maintenance"
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Maintenance
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">{record.title}</h1>
            <Badge variant="outline">{RECORD_TYPE_LABELS[record.type]}</Badge>
            <Badge variant="secondary">{maintenanceCategoryName(record.categoryKey)}</Badge>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" asChild>
            <Link to={edit}>
              <Pencil data-icon="inline-start" />
              Edit
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions">
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-8">
          <Hero record={record} />
          <WorkDone record={record} />
          {(record.description || record.notes) && (
            <Card>
              <CardContent className="flex flex-col gap-4">
                {record.description && (
                  <TextBlock title="Description">{record.description}</TextBlock>
                )}
                {record.notes && <TextBlock title="Notes">{record.notes}</TextBlock>}
              </CardContent>
            </Card>
          )}
        </div>
        <div className="flex flex-col gap-6 lg:col-span-4">
          <CostBreakdown record={record} />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" aria-hidden />
                Warranty
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm tabular-nums">
                {record.warrantyUntil || record.warrantyNotes
                  ? [
                      record.warrantyUntil && `Until ${formatDate(record.warrantyUntil)}`,
                      record.warrantyNotes,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : "No warranty recorded"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-2.5">
              <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Linked expense
              </span>
              {record.expenseId ? (
                <>
                  <p className="text-sm tabular-nums">
                    {formatCurrency(record.totalAmount)} in Expenses
                  </p>
                  <Link
                    to={`/expenses/transactions/${record.expenseId}`}
                    className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    View expense
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No expense: this record cost nothing.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${record.title}?`}
        description={`${
          record.expenseId
            ? `Its expense of ${formatCurrency(record.totalAmount)} is deleted too, and s`
            : "S"
        }chedules it completed count from their previous service again.`}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          await remove.mutateAsync(record);
          navigate("/maintenance", { replace: true });
        }}
      />
    </PageContainer>
  );
}

function Hero({ record }: { record: ServiceRecord }) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-5">
        <dl className="grid min-w-0 flex-1 gap-5 sm:grid-cols-3">
          <Fact label="Service date">{formatDate(record.serviceDate)}</Fact>
          <Fact label="Odometer">
            {record.odometerKm !== null ? formatDistance(record.odometerKm) : "Not recorded"}
          </Fact>
          <Fact label="Workshop">
            {record.provider?.name ?? "Not recorded"}
            {record.technician && (
              <span className="block text-sm font-normal text-muted-foreground">
                Technician: {record.technician}
              </span>
            )}
          </Fact>
        </dl>
        <div className="shrink-0 sm:border-l sm:pl-5 sm:text-right">
          <span className="block text-xs text-muted-foreground">Total paid</span>
          <span className="font-heading text-3xl font-semibold tracking-tight tabular-nums">
            {formatCurrency(record.totalAmount)}
          </span>
          {record.paymentMethod && (
            <span className="block text-sm text-muted-foreground">
              Paid via {PAYMENT_METHOD_LABELS[record.paymentMethod]}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{children}</dd>
    </div>
  );
}

function WorkDone({ record }: { record: ServiceRecord }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Work done</CardTitle>
        <span className="text-sm text-muted-foreground tabular-nums">
          {formatNumber(record.items.length)} {record.items.length === 1 ? "item" : "items"}
        </span>
      </CardHeader>
      <CardContent>
        {record.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items recorded.</p>
        ) : (
          <ul className="divide-y">
            {record.items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
              >
                <span className="text-sm">
                  {item.name}
                  {item.partNumber && (
                    <span className="font-mono text-xs text-muted-foreground">
                      {" "}
                      · part {item.partNumber}
                    </span>
                  )}
                </span>
                {item.scheduleId && item.scheduleName && (
                  <Link
                    to={`/maintenance/schedules/${item.scheduleId}`}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-success/30 bg-success/15 px-2.5 py-0.5 text-xs font-medium text-success hover:underline"
                  >
                    <CircleCheck className="size-3" aria-hidden />
                    Completed: {item.scheduleName}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function CostBreakdown({ record }: { record: ServiceRecord }) {
  const rows = [
    ["Labour", record.labourAmount],
    ["Parts", record.partsAmount],
    ["Other", record.otherAmount],
    ["Tax", record.taxAmount],
  ] as const;
  const breakdown = rows.some(([, value]) => value !== null) || record.discountAmount !== null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col gap-2.5 text-sm tabular-nums">
          {breakdown ? (
            <>
              {rows.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd>{formatCurrency(value ?? "0")}</dd>
                </div>
              ))}
              {record.discountAmount !== null && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Discount</dt>
                  <dd>−{formatCurrency(record.discountAmount)}</dd>
                </div>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">Only the total was recorded.</p>
          )}
          <div className="flex items-center justify-between gap-3 border-t pt-2.5">
            <dt className="font-medium">Total</dt>
            <dd className="font-heading text-lg font-semibold">
              {formatCurrency(record.totalAmount)}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function TextBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 not-first:border-t not-first:pt-3">
      <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {title}
      </h2>
      <p className="text-sm text-pretty whitespace-pre-line">{children}</p>
    </div>
  );
}
