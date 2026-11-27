import { type Expense, type ExpenseSummary } from "@automate/shared";
import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "cn";
import { format, parseISO, subMonths } from "date-fns";
import { ReceiptIndianRupee } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router";

import { DataTable } from "@/components/common/data-table";
import { StatCard } from "@/components/common/stat-card";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ExpenseAmount } from "@/features/expenses/components/expense-amount";
import { ExpenseTitle } from "@/features/expenses/components/expense-title";
import { ExpensesLayout } from "@/features/expenses/components/expenses-layout";
import { categoryTone } from "@/features/expenses/constants";
import { ALL_VEHICLES, useExpenseFilters } from "@/features/expenses/hooks/use-expense-filters";
import {
  useExpenseCategories,
  useExpenses,
  useExpenseSummary,
} from "@/features/expenses/hooks/use-expenses";
import { PAYMENT_METHOD_LABELS } from "@/features/fuel/constants";
import { vehicleName } from "@/features/garage/constants";
import { useVehicles } from "@/features/garage/hooks/use-vehicles";
import { formatCurrency, formatDate, formatDistance, formatNumber } from "@/utils/format";

const RECENT_ROWS = 5;
/** Category chips above the ledger: the most used ones. */
const CHIPS = 4;

const monthName = (month: string, back = 0) =>
  format(subMonths(parseISO(`${month}-01`), back), back ? "MMMM" : "MMMM yyyy");
const plural = (count: number, word: string) =>
  `${formatNumber(count)} ${word}${count === 1 ? "" : "s"}`;

/**
 * Stitch "Expenses — Desktop / Mobile" (Overview tab): this month's and year's running cost, cost
 * per km, loan outflow, the category breakdown and the latest expenses. Every figure comes from
 * `GET /expenses/summary`. Deviations: cost per km and the EMI are in the normal text colour
 * (teal is for AI content, amber for warnings), and "Verified" became the km it's priced over.
 */
export function Component() {
  const filters = useExpenseFilters();
  const vehicles = useVehicles();
  const categories = useExpenseCategories();
  const { search } = useLocation();
  const vehicleId = filters.query.vehicleId;
  const summary = useExpenseSummary(vehicleId, { enabled: filters.ready });
  const [chip, setChip] = useState<string>();
  const recent = useExpenses(
    { vehicleId, categoryId: chip, pageSize: RECENT_ROWS },
    { enabled: filters.ready },
  );

  const chips = (categories.data ?? [])
    .filter((category) => category.usage > 0)
    .sort((a, b) => b.usage - a.usage)
    .slice(0, CHIPS);
  const data = summary.data;
  const rows = recent.data?.items ?? [];
  const total = recent.data?.meta.total ?? 0;
  const nothingYet = !chip && recent.data !== undefined && total === 0;
  const allHref = {
    pathname: "/expenses/transactions",
    search: new URLSearchParams({
      ...(filters.get("vehicle") ? { vehicle: filters.vehicle } : {}),
      ...(chip ? { category: chip } : {}),
    }).toString(),
  };
  const detailsHref = (expense: Expense) => ({
    pathname: `/expenses/transactions/${expense.id}`,
    search,
  });

  const columns: ColumnDef<Expense>[] = [
    {
      id: "date",
      header: "Date",
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">{formatDate(row.original.date)}</span>
      ),
    },
    {
      id: "title",
      header: "Title & category",
      cell: ({ row }) => (
        <Link
          to={detailsHref(row.original)}
          className="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ExpenseTitle expense={row.original} />
        </Link>
      ),
    },
    {
      id: "payment",
      header: "Payment",
      cell: ({ row }) =>
        row.original.paymentMethod ? PAYMENT_METHOD_LABELS[row.original.paymentMethod] : "—",
    },
    {
      id: "amount",
      header: () => <div className="text-right">Amount</div>,
      cell: ({ row }) => <ExpenseAmount expense={row.original} />,
    },
  ];

  return (
    <ExpensesLayout tab="overview">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={filters.vehicle} onValueChange={(value) => filters.set("vehicle", value)}>
          <SelectTrigger aria-label="Vehicle scope" className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VEHICLES}>All vehicles</SelectItem>
            {(vehicles.data ?? []).map((vehicle) => (
              <SelectItem key={vehicle.id} value={vehicle.id}>
                {vehicleName(vehicle)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {data && (
          <span className="text-sm font-medium text-muted-foreground">{monthName(data.month)}</span>
        )}
      </div>

      {summary.isError && !data ? (
        <ErrorState
          title="Couldn't load the overview"
          error={summary.error}
          onRetry={() => void summary.refetch()}
        />
      ) : nothingYet ? (
        <EmptyState
          className="rounded-xl border border-dashed"
          icon={ReceiptIndianRupee}
          title="No expenses yet"
          description="Log tolls, servicing, insurance and every other cost to see where your money goes."
          action={
            <Button asChild>
              <Link to="/expenses/new">Add expense</Link>
            </Button>
          }
        />
      ) : (
        <>
          <Kpis summary={data} />
          <p className="text-sm text-muted-foreground">
            Operating cost is running the vehicle: fuel, servicing, repairs, tolls, parking,
            washing. Loan EMIs, insurance and accessories aren't in it; refunds are subtracted.
          </p>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <section
              aria-labelledby="breakdown-title"
              className="flex flex-col gap-5 rounded-xl border bg-card p-4 sm:p-5 lg:col-span-4"
            >
              <header>
                <h2 id="breakdown-title" className="font-heading text-lg font-semibold">
                  Category breakdown
                </h2>
                {data && (
                  <p className="text-sm text-muted-foreground">
                    {monthName(data.month)} running cost ({formatCurrency(data.operating.thisMonth)}
                    )
                  </p>
                )}
              </header>
              {!data ? (
                <div className="flex flex-col gap-4">
                  {[0, 1, 2].map((key) => (
                    <Skeleton key={key} className="h-8 w-full" />
                  ))}
                </div>
              ) : data.categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">No running cost this month yet.</p>
              ) : (
                <ul className="flex flex-col gap-3.5">
                  {data.categories.map((item) => (
                    <li key={item.category.id} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate font-medium">{item.category.name}</span>
                        <span className="shrink-0 tabular-nums">
                          {formatCurrency(item.amount)}{" "}
                          <span className="text-muted-foreground">
                            ({formatNumber(item.percent, { maxFractionDigits: 0 })}%)
                          </span>
                        </span>
                      </div>
                      <Progress
                        value={item.percent}
                        aria-label={`${item.category.name}, ${formatNumber(item.percent, { maxFractionDigits: 0 })}% of running cost`}
                        className={cn(
                          "h-2 [&>[data-slot=progress-indicator]]:bg-current",
                          categoryTone(item.category),
                        )}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section
              aria-labelledby="recent-title"
              aria-busy={recent.isPlaceholderData}
              className={cn(
                "flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4 transition-opacity sm:p-5 lg:col-span-8",
                recent.isPlaceholderData && "opacity-60",
              )}
            >
              <header className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="recent-title" className="font-heading text-lg font-semibold">
                  Recent expenses
                </h2>
                <div className="flex items-center gap-3 text-sm">
                  {recent.data && total > 0 && (
                    <span className="text-muted-foreground" aria-live="polite">
                      Showing {formatNumber(rows.length)} of {formatNumber(total)}
                    </span>
                  )}
                  <Link to={allHref} className="font-medium text-primary hover:underline">
                    View all
                  </Link>
                </div>
              </header>
              {chips.length > 1 && (
                <div
                  className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1"
                  role="group"
                  aria-label="Filter by category"
                >
                  {[{ id: undefined, name: "All" }, ...chips].map((category) => {
                    const on = chip === category.id;
                    return (
                      <Button
                        key={category.id ?? "all"}
                        size="sm"
                        variant="outline"
                        aria-pressed={on}
                        className={cn("shrink-0", on && "border-primary text-primary")}
                        onClick={() => setChip(category.id)}
                      >
                        {category.name}
                      </Button>
                    );
                  })}
                </div>
              )}

              {recent.isError && !recent.data ? (
                <ErrorState
                  title="Couldn't load expenses"
                  error={recent.error}
                  onRetry={() => void recent.refetch()}
                />
              ) : recent.data && total === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No expenses in this category yet.
                </p>
              ) : (
                <>
                  <div className="max-md:hidden">
                    <DataTable
                      columns={columns}
                      data={rows}
                      loading={recent.isPending}
                      paginate={false}
                    />
                  </div>
                  <ul className="flex flex-col divide-y rounded-lg border md:hidden">
                    {recent.isPending
                      ? [0, 1, 2].map((key) => (
                          <li key={key} className="p-3">
                            <Skeleton className="h-9 w-full" />
                          </li>
                        ))
                      : rows.map((expense) => (
                          <li key={expense.id}>
                            <Link
                              to={detailsHref(expense)}
                              className="flex items-center gap-3 p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <div className="min-w-0 flex-1">
                                <ExpenseTitle
                                  expense={expense}
                                  meta={[
                                    formatDate(expense.date),
                                    expense.paymentMethod &&
                                      PAYMENT_METHOD_LABELS[expense.paymentMethod],
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                />
                              </div>
                              <ExpenseAmount expense={expense} className="shrink-0" />
                            </Link>
                          </li>
                        ))}
                  </ul>
                </>
              )}
            </section>
          </div>
        </>
      )}
    </ExpensesLayout>
  );
}

/** The five figures of the Stitch KPI strip; skeletons until the summary arrives. */
function Kpis({ summary }: { summary: ExpenseSummary | undefined }) {
  const loading = !summary;
  const operating = summary?.operating;
  const year = summary?.month.slice(0, 4);
  const change = operating?.changePercent ?? null;
  return (
    <section aria-label="This month and year" className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <StatCard
        // Short labels (Stitch mobile) so they fit two cards across a phone.
        label={
          summary ? `Operating (${format(parseISO(`${summary.month}-01`), "MMM")})` : "Operating"
        }
        loading={loading}
        value={formatCurrency(operating?.thisMonth)}
        hint={
          summary &&
          (change === null ? (
            `Nothing in ${monthName(summary.month, 1)}`
          ) : (
            <span
              className={cn(
                "tabular-nums",
                change > 0 && "text-warning",
                change < 0 && "text-success",
              )}
            >
              {change > 0 ? "+" : ""}
              {formatNumber(change)}% vs {monthName(summary.month, 1)}
            </span>
          ))
        }
      />
      <StatCard
        label={year ? `Operating (${year})` : "Operating"}
        loading={loading}
        value={formatCurrency(operating?.thisYear)}
        hint={
          operating && (operating.monthsCovered ? plural(operating.monthsCovered, "month") : year)
        }
      />
      <StatCard
        label="Monthly average"
        loading={loading}
        value={formatCurrency(operating?.monthlyAverage)}
        hint={year}
      />
      <StatCard
        label="Running cost / km"
        loading={loading}
        value={formatCurrency(summary?.costPerKm)}
        hint={
          summary &&
          (summary.distanceKm
            ? `Over ${formatDistance(summary.distanceKm)} in ${year}`
            : "Needs two odometer readings this year")
        }
      />
      <StatCard
        label="Loan EMI outflow"
        className="max-lg:col-span-2"
        loading={loading}
        value={formatCurrency(summary?.loanOutflowThisMonth)}
        hint={summary && `Of ${formatCurrency(summary.cashOutflowThisMonth)} paid this month`}
      />
    </section>
  );
}
