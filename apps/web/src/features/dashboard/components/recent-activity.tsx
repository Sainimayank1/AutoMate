import type { ActivityItem } from "@automate/shared";
import { cn } from "cn";
import {
  FileText,
  Fuel,
  type LucideIcon,
  ReceiptIndianRupee,
  Route,
  Undo2,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { Pager } from "@/components/common/pager";
import { ErrorState } from "@/components/feedback/error-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDashboardActivity } from "@/features/dashboard/hooks/use-dashboard";
import { formatCurrency, formatDateRange, formatDistance } from "@/utils/format";

const PAGE_SIZE = 8;

const KIND: Record<ActivityItem["kind"], { label: string; icon: LucideIcon; tone: string }> = {
  fuel: { label: "Fuel", icon: Fuel, tone: "text-chart-1" },
  expense: { label: "Expense", icon: ReceiptIndianRupee, tone: "text-muted-foreground" },
  refund: { label: "Refund", icon: Undo2, tone: "text-success" },
  service: { label: "Service", icon: Wrench, tone: "text-chart-2" },
  trip: { label: "Trip", icon: Route, tone: "text-chart-3" },
  document: { label: "Document", icon: FileText, tone: "text-muted-foreground" },
};

const day = (date: string) => formatDateRange({ from: date, to: date });
const amount = (item: ActivityItem) =>
  item.amount === null
    ? "—"
    : item.kind === "refund"
      ? `−${formatCurrency(item.amount)}`
      : formatCurrency(item.amount);

/**
 * Stitch "Dashboard" recent activity: fill-ups, expenses, refunds and services, newest first, a
 * page at a time; each row opens the record in its own module. Keyed by vehicle by the caller, so
 * a vehicle change starts again at page 1.
 */
export function RecentActivity({ vehicleId }: { vehicleId: string }) {
  const [page, setPage] = useState(1);
  const activity = useDashboardActivity({ vehicleId, page, pageSize: PAGE_SIZE });
  const items = activity.data?.items ?? [];
  const meta = activity.data?.meta;

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Recent activity
        </CardTitle>
        <p className="text-sm text-muted-foreground">Latest fill-ups, expenses and services</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {activity.isError && !activity.data ? (
          <ErrorState
            title="Couldn't load the activity"
            error={activity.error}
            onRetry={() => void activity.refetch()}
          />
        ) : activity.isPending ? (
          <div className="flex flex-col gap-2" aria-busy>
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nothing recorded yet. Fill-ups, expenses and services show up here.
          </p>
        ) : (
          <div
            aria-busy={activity.isPlaceholderData}
            className={cn("transition-opacity", activity.isPlaceholderData && "opacity-60")}
          >
            <Table className="max-md:hidden">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead className="text-right">Odometer</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {day(item.date)}
                    </TableCell>
                    <TableCell>
                      <Event item={item} />
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {item.odometerKm === null ? "—" : formatDistance(item.odometerKm)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium tabular-nums",
                        item.kind === "refund" && "text-success",
                      )}
                    >
                      {amount(item)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ul className="flex flex-col divide-y md:hidden">
              {items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Event
                    item={item}
                    meta={[
                      day(item.date),
                      item.odometerKm !== null && formatDistance(item.odometerKm),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                  <span
                    className={cn(
                      "shrink-0 text-sm font-medium tabular-nums",
                      item.kind === "refund" && "text-success",
                    )}
                  >
                    {amount(item)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {meta && <Pager page={meta.page} pageCount={meta.totalPages} onPageChange={setPage} />}
      </CardContent>
    </Card>
  );
}

/** Icon, source and title (opening the record), with its detail or the phone's meta line. */
function Event({ item, meta }: { item: ActivityItem; meta?: string }) {
  const kind = KIND[item.kind];
  const Icon = kind.icon;
  return (
    <Link
      to={item.href}
      className="flex min-w-0 items-center gap-3 rounded-md outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring max-md:min-h-10"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className={cn("size-4", kind.tone)} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">
          <span className="sr-only">{kind.label}: </span>
          {item.title}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {meta ?? [kind.label, item.detail].filter(Boolean).join(" · ")}
        </span>
      </span>
    </Link>
  );
}
