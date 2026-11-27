import { PaymentState, type RecurringPayment } from "@automate/shared";
import { EllipsisVertical } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { Pager } from "@/components/common/pager";
import { Segmented } from "@/components/common/segmented";
import { StatusBadge } from "@/components/common/status-badge";
import { ErrorState } from "@/components/feedback/error-state";
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
import { CategoryIcon } from "@/features/expenses/components/category-icon";
import {
  PostponeDialog,
  RecordPaymentDialog,
} from "@/features/expenses/components/payment-dialogs";
import { PAYMENT_STATE } from "@/features/expenses/constants";
import {
  useRecurringPayments,
  useResetPayment,
  useSkipPayment,
} from "@/features/expenses/hooks/use-recurring";
import { formatCurrency, formatDate } from "@/utils/format";

const PAGE_SIZE = 8;
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Stitch "Expenses — Recurring" upcoming payments: every unpaid due date (overdue first, then the
 * next 90 days), each recorded, skipped or postponed here; History lists what was paid or skipped.
 * Recording a payment saves its expense, once.
 */
export function PaymentsCard({
  vehicleId,
  initialPay,
}: {
  vehicleId: string | undefined;
  /** A payment to open the record dialog for on arrival (the dashboard's "Record payment"). */
  initialPay?: { recurringId: string; dueDate: string };
}) {
  const [view, setView] = useState<"upcoming" | "history">("upcoming");
  const [page, setPage] = useState(1);
  const payments = useRecurringPayments({ vehicleId, view, page, pageSize: PAGE_SIZE });
  const target = useRecurringPayments(
    { vehicleId, recurringId: initialPay?.recurringId, view: "upcoming", pageSize: 100 },
    !!initialPay,
  );
  const [paying, setPaying] = useState<RecurringPayment | null>(null);
  const [opened, setOpened] = useState(false);
  const [moving, setMoving] = useState<RecurringPayment | null>(null);
  const skip = useSkipPayment();
  const reset = useResetPayment();

  // Opened once from the link; the dialog closes like any other afterwards.
  const linked =
    !opened && initialPay
      ? (target.data?.items.find((item) => item.dueDate === initialPay.dueDate) ?? null)
      : null;
  const recording = paying ?? linked;

  const items = payments.data?.items ?? [];
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle role="heading" aria-level={2}>
          {view === "upcoming" ? "Upcoming payments" : "Payment history"}
        </CardTitle>
        <Segmented
          aria-label="Payments"
          value={view}
          onChange={(next) => {
            setView(next);
            setPage(1);
          }}
          options={[
            { value: "upcoming", label: "Upcoming" },
            { value: "history", label: "History" },
          ]}
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {payments.isError && !payments.data ? (
          <ErrorState
            title="Couldn't load the payments"
            error={payments.error}
            onRetry={() => void payments.refetch()}
          />
        ) : payments.isPending ? (
          <div aria-busy className="flex flex-col gap-2">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {view === "upcoming"
              ? "Nothing due in the next 90 days."
              : "No payments recorded or skipped yet."}
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {items.map((payment) => (
              <li
                key={`${payment.recurringId}:${payment.dueDate}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3"
              >
                <PaymentRow payment={payment} />
                <div className="flex items-center gap-1 max-sm:w-full max-sm:justify-end">
                  {view === "upcoming" ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="max-md:h-10 max-sm:flex-1"
                        onClick={() => setPaying(payment)}
                      >
                        Record payment
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="max-md:size-10"
                            aria-label={`More for ${payment.title}, due ${formatDate(payment.dueDate)}`}
                          >
                            <EllipsisVertical />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() =>
                              skip.mutate({ id: payment.recurringId, dueDate: payment.dueDate })
                            }
                          >
                            Skip this one
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setMoving(payment)}>
                            Postpone
                          </DropdownMenuItem>
                          {payment.postponed && (
                            <DropdownMenuItem
                              onSelect={() =>
                                reset.mutate({ id: payment.recurringId, dueDate: payment.dueDate })
                              }
                            >
                              Back to its due date
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  ) : payment.expenseId ? (
                    <Button size="sm" variant="ghost" className="max-md:h-10" asChild>
                      <Link to={`/expenses/transactions/${payment.expenseId}`}>View expense</Link>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="max-md:h-10"
                      onClick={() =>
                        reset.mutate({ id: payment.recurringId, dueDate: payment.dueDate })
                      }
                    >
                      Undo skip
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {(payments.data?.meta.totalPages ?? 0) > 1 && (
          <Pager page={page} pageCount={payments.data!.meta.totalPages} onPageChange={setPage} />
        )}
      </CardContent>
      <RecordPaymentDialog
        payment={recording}
        onOpenChange={(open) => {
          if (open) return;
          setPaying(null);
          setOpened(true);
        }}
      />
      <PostponeDialog payment={moving} onOpenChange={(open) => !open && setMoving(null)} />
    </Card>
  );
}

function PaymentRow({ payment }: { payment: RecurringPayment }) {
  const state = PAYMENT_STATE[payment.state];
  const dueToday = payment.state === PaymentState.DUE && payment.date === today();
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <StatusBadge
        tone={state.tone}
        icon={state.icon}
        label={dueToday ? "Due today" : state.label}
        className="shrink-0 max-sm:hidden"
      />
      <CategoryIcon category={payment.category} size="sm" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">{payment.title}</span>
          <StatusBadge
            tone={state.tone}
            icon={state.icon}
            label={dueToday ? "Due today" : state.label}
            className="sm:hidden"
          />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {payment.loan
            ? `EMI ${payment.loan.number} of ${payment.loan.of} · ${formatCurrency(payment.loan.principal)} principal · ${formatCurrency(payment.loan.interest)} interest`
            : payment.category.name}
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
          {payment.postponed && <Badge variant="outline">Postponed</Badge>}
          {formatDate(payment.date)}
        </span>
        <span className="text-sm font-medium tabular-nums">{formatCurrency(payment.amount)}</span>
      </div>
    </div>
  );
}
