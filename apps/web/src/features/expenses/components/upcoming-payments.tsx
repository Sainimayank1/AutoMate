import { Link } from "react-router";

import { StatusBadge } from "@/components/common/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PAYMENT_STATE } from "@/features/expenses/constants";
import { useRecurringPayments } from "@/features/expenses/hooks/use-recurring";
import { formatCurrency, formatDate } from "@/utils/format";

/**
 * Stitch "Expenses" upcoming payments: the next few recurring payments and EMIs (overdue first),
 * opening the Recurring tab. Scheduled payments aren't spending until they're recorded.
 */
export function UpcomingPayments({
  vehicleId,
  ready,
}: {
  vehicleId: string | undefined;
  ready: boolean;
}) {
  const payments = useRecurringPayments({ vehicleId, view: "upcoming", pageSize: 4 }, ready);
  const items = payments.data?.items ?? [];
  return (
    <Card className="lg:col-span-6">
      <CardHeader className="flex items-center justify-between gap-2">
        <CardTitle role="heading" aria-level={2}>
          Upcoming payments
        </CardTitle>
        <Link
          to="/expenses/recurring"
          className="text-sm font-medium text-primary hover:underline max-md:inline-flex max-md:min-h-10 max-md:items-center"
        >
          View all →
        </Link>
      </CardHeader>
      <CardContent>
        {payments.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing due in the next 90 days. Add recurring payments or a loan to see what&apos;s
            coming.
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {items.map((payment) => {
              const state = PAYMENT_STATE[payment.state];
              return (
                <li
                  key={`${payment.recurringId}:${payment.dueDate}`}
                  className="flex items-center gap-3 py-2.5"
                >
                  <StatusBadge tone={state.tone} icon={state.icon} label={state.label} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {payment.title}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatDate(payment.date)}
                  </span>
                  <span className="w-24 text-right text-sm tabular-nums">
                    {formatCurrency(payment.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
