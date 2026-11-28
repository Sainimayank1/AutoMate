import { type RecurringExpense, RecurringStatus, type VehicleLoan } from "@automate/shared";
import { format, parseISO } from "date-fns";
import { EllipsisVertical, Landmark } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Pager } from "@/components/common/pager";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { frequencyLabel, RECURRING_STATUS } from "@/features/expenses/constants";
import {
  useDeleteRecurring,
  useLoans,
  useRecurringList,
  useSetRecurringStatus,
} from "@/features/expenses/hooks/use-recurring";
import { formatCurrency, formatDate, formatNumber } from "@/utils/format";

const monthYear = (date: string) => format(parseISO(date), "MMM yyyy");

/** Stitch "Expenses — Recurring" loans: each loan's position today, opening its schedule. */
export function LoansSection({ vehicleId }: { vehicleId: string | undefined }) {
  const [page, setPage] = useState(1);
  const loans = useLoans({ vehicleId, page, pageSize: 4 });
  const items = loans.data?.items ?? [];
  return (
    <section aria-labelledby="loans-title" className="flex flex-col gap-3">
      <h2 id="loans-title" className="font-heading text-base font-medium">
        Loans
      </h2>
      {loans.isError && !loans.data ? (
        <ErrorState
          title="Couldn't load the loans"
          error={loans.error}
          onRetry={() => void loans.refetch()}
        />
      ) : loans.isPending ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : items.length === 0 ? (
        <EmptyState
          className="rounded-xl border border-dashed"
          icon={Landmark}
          title="No loans tracked"
          description="Add your vehicle loan to schedule its EMIs, each with its principal and interest."
          action={
            <Button asChild variant="outline">
              <Link to="/expenses/loans/new">Add loan</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((loan) => (
            <LoanCard key={loan.id} loan={loan} />
          ))}
        </div>
      )}
      {(loans.data?.meta.totalPages ?? 0) > 1 && (
        <Pager page={page} pageCount={loans.data!.meta.totalPages} onPageChange={setPage} />
      )}
    </section>
  );
}

function LoanCard({ loan }: { loan: VehicleLoan }) {
  const figures = [
    { label: "Outstanding", value: formatCurrency(loan.outstanding) },
    { label: "EMI", value: formatCurrency(loan.emi) },
    { label: "Rate", value: `${formatNumber(loan.annualRate, { minFractionDigits: 2 })}%` },
    { label: "Ends", value: monthYear(loan.endDate) },
  ];
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <CardTitle role="heading" aria-level={3}>
            {loan.lender}
            {loan.accountNumber && ` · ${loan.accountNumber}`}
          </CardTitle>
          {loan.next && (
            <p className="text-xs text-muted-foreground tabular-nums">
              Next EMI {formatDate(loan.next.date)}
            </p>
          )}
        </div>
        <Link
          to={`/expenses/loans/${loan.id}`}
          className="text-sm font-medium text-primary hover:underline max-md:inline-flex max-md:min-h-10 max-md:items-center"
        >
          View schedule →
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {figures.map((figure) => (
            <div key={figure.label} className="rounded-lg border bg-elevated p-3">
              <dt className="text-xs text-muted-foreground">{figure.label}</dt>
              <dd className="font-heading font-medium tabular-nums">{figure.value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-1.5">
          <Progress
            value={(loan.repaid.emis / Math.max(loan.emisTotal, 1)) * 100}
            aria-label={`${loan.repaid.emis} of ${loan.emisTotal} EMIs paid`}
            className="h-1.5"
          />
          <p className="flex flex-wrap justify-between gap-x-4 text-xs text-muted-foreground tabular-nums">
            <span>
              {loan.repaid.emis} of {loan.emisTotal} EMIs paid
              {loan.beforeTracking.emis > 0 && ` · ${loan.beforeTracking.emis} before AutoMate`}
            </span>
            <span>
              Principal repaid {formatCurrency(loan.repaid.principal)} · Interest paid{" "}
              {formatCurrency(loan.repaid.interest)}
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/** Stitch "Expenses — Recurring" schedules: each with its frequency, next due date and status. */
export function SchedulesSection({ vehicleId }: { vehicleId: string | undefined }) {
  const [page, setPage] = useState(1);
  const list = useRecurringList({ vehicleId, page, pageSize: 10 });
  const setStatus = useSetRecurringStatus();
  const remove = useDeleteRecurring();
  const [confirm, setConfirm] = useState<{
    schedule: RecurringExpense;
    action: "cancel" | "delete";
  } | null>(null);
  const items = list.data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Schedules
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {list.isError && !list.data ? (
          <ErrorState
            title="Couldn't load the schedules"
            error={list.error}
            onRetry={() => void list.refetch()}
          />
        ) : list.isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No recurring payments yet. Add parking passes, premiums or subscriptions to see them
            coming.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="max-md:hidden">Frequency</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="max-sm:hidden">Next due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((schedule) => {
                const status = RECURRING_STATUS[schedule.status];
                return (
                  <TableRow key={schedule.id}>
                    <TableCell className="font-medium">{schedule.title}</TableCell>
                    <TableCell className="text-muted-foreground max-md:hidden">
                      {frequencyLabel(schedule.every, schedule.unit)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(schedule.amount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums max-sm:hidden">
                      {schedule.next ? formatDate(schedule.next.date) : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={status.tone} icon={status.icon} label={status.label} />
                    </TableCell>
                    <TableCell className="text-right">
                      {schedule.loanId ? (
                        <Link
                          to={`/expenses/loans/${schedule.loanId}`}
                          className="text-xs text-muted-foreground hover:underline"
                        >
                          From loan
                        </Link>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="max-md:size-10"
                              aria-label={`Actions for ${schedule.title}`}
                            >
                              <EllipsisVertical />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {schedule.status !== RecurringStatus.CANCELLED && (
                              <>
                                <DropdownMenuItem asChild>
                                  <Link to={`/expenses/recurring/${schedule.id}/edit`}>Edit</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() =>
                                    setStatus.mutate({
                                      id: schedule.id,
                                      action:
                                        schedule.status === RecurringStatus.PAUSED
                                          ? "resume"
                                          : "pause",
                                    })
                                  }
                                >
                                  {schedule.status === RecurringStatus.PAUSED ? "Resume" : "Pause"}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() => setConfirm({ schedule, action: "cancel" })}
                                >
                                  Cancel
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setConfirm({ schedule, action: "delete" })}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {(list.data?.meta.totalPages ?? 0) > 1 && (
          <Pager page={page} pageCount={list.data!.meta.totalPages} onPageChange={setPage} />
        )}
      </CardContent>
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={
          confirm?.action === "delete"
            ? `Delete ${confirm.schedule.title}?`
            : `Cancel ${confirm?.schedule.title ?? ""}?`
        }
        description={
          confirm?.action === "delete"
            ? "The schedule goes. Payments already recorded stay as expenses."
            : "No more due dates, for good. Payments already recorded stay as expenses."
        }
        confirmLabel={confirm?.action === "delete" ? "Delete" : "Cancel schedule"}
        cancelLabel="Keep it"
        destructive
        onConfirm={async () => {
          if (!confirm) return;
          if (confirm.action === "delete") await remove.mutateAsync(confirm.schedule.id);
          else await setStatus.mutateAsync({ id: confirm.schedule.id, action: "cancel" });
          setConfirm(null);
        }}
      />
    </Card>
  );
}
