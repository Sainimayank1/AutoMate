import { ExpenseKind, OWNERSHIP_PERIODS, type OwnershipPeriod } from "@automate/shared";
import { cn } from "cn";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Printer } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { Link, useSearchParams } from "react-router";

import { Segmented } from "@/components/common/segmented";
import { ErrorState } from "@/components/feedback/error-state";
import { BrandLogo } from "@/components/layout/brand-logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAllExpenses, useExpenseReport } from "@/features/expenses/hooks/use-expenses";
import { PAYMENT_METHOD_LABELS } from "@/features/fuel/constants";
import { vehicleName } from "@/features/garage/constants";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";
import { formatCurrency, formatDate, formatRegistration } from "@/utils/format";

const PERIOD_LABELS: Record<OwnershipPeriod, string> = {
  this_month: "This month",
  this_year: "This year",
  all_time: "Since purchase",
};

/** Paper is light: the page drops the dark theme while it's open, and restores it after. */
function useLightPage() {
  useEffect(() => {
    const root = document.documentElement;
    const dark = root.classList.contains("dark");
    const scheme = root.style.colorScheme;
    root.classList.remove("dark");
    root.style.colorScheme = "light";
    return () => {
      if (dark) root.classList.add("dark");
      root.style.colorScheme = scheme;
    };
  }, []);
}

/**
 * `/expenses/report?vehicle=&period=` (Stitch "Expense Report"): a printable sheet outside the
 * shell: the three money views, by category, by month and every transaction in the period. The
 * toolbar isn't printed; "Print or save as PDF" uses the browser's own dialog.
 */
export function Component() {
  useLightPage();
  const [params, setParams] = useSearchParams();
  const garage = useActiveVehicle();
  const asked = params.get("period");
  const period = (OWNERSHIP_PERIODS as readonly string[]).includes(asked ?? "")
    ? (asked as OwnershipPeriod)
    : "this_year";
  const vehicle =
    garage.vehicles.find((item) => item.id === params.get("vehicle")) ?? garage.activeVehicle;
  const report = useExpenseReport(vehicle ? { vehicleId: vehicle.id, period } : undefined);
  const range = report.data?.ownership.window;
  const rows = useAllExpenses(
    vehicle && range
      ? { vehicleId: vehicle.id, from: range.from, to: range.to, sort: "date_asc" }
      : undefined,
  );
  const data = report.data;

  return (
    <div className="min-h-svh bg-muted/60 py-6 print:bg-background print:py-0">
      <title>Expense report · AutoMate</title>
      <div className="mx-auto flex max-w-[860px] flex-wrap items-center justify-between gap-3 px-4 pb-4 print:hidden">
        <Button variant="ghost" asChild>
          <Link to={`/expenses/ownership?period=${period}`}>
            <ArrowLeft data-icon="inline-start" />
            Back
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            aria-label="Period"
            value={period}
            onChange={(value) =>
              setParams(
                (current) => {
                  current.set("period", value);
                  return current;
                },
                { replace: true },
              )
            }
            options={OWNERSHIP_PERIODS.map((value) => ({ value, label: PERIOD_LABELS[value] }))}
          />
          <Button onClick={() => window.print()} disabled={!data || rows.isPending}>
            <Printer data-icon="inline-start" />
            Print or save as PDF
          </Button>
        </div>
      </div>

      <article className="mx-auto flex max-w-[860px] flex-col gap-8 bg-background px-10 py-10 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        {report.isError && !data ? (
          <ErrorState
            title="Couldn't load the report"
            error={report.error}
            onRetry={() => void report.refetch()}
          />
        ) : !data || !vehicle ? (
          <Skeleton className="h-[600px] w-full" />
        ) : (
          <>
            <header className="flex flex-col gap-3 border-b-2 border-primary pb-4">
              <BrandLogo size="md" />
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h1 className="font-heading text-2xl font-semibold">Expense report</h1>
                  <p className="text-sm">
                    {vehicleName(vehicle)} · {formatRegistration(vehicle.registrationNumber)}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground tabular-nums">
                  {formatDate(data.ownership.window.from)} to {formatDate(data.ownership.window.to)}{" "}
                  · generated {formatDate(format(new Date(), "yyyy-MM-dd"))}
                </p>
              </div>
            </header>

            <Section title="The three views">
              <dl className="grid grid-cols-3 gap-4 text-sm tabular-nums">
                <View label="Operating cost" value={data.ownership.operating} />
                <View
                  label="Cash outflow"
                  value={data.ownership.cashOutflow}
                  note={
                    data.ownership.principal === "0.00"
                      ? undefined
                      : `Incl. ${formatCurrency(data.ownership.principal)} loan principal`
                  }
                />
                <View
                  label="Economic ownership cost"
                  value={data.ownership.economic}
                  note={
                    data.ownership.depreciation
                      ? `Estimate: depreciation ${formatCurrency(data.ownership.depreciation.amount)}`
                      : "No depreciation without a purchase price"
                  }
                />
              </dl>
            </Section>

            <div className="grid gap-8 sm:grid-cols-2 print:grid-cols-2">
              <Section title="By category">
                <ReportTable
                  head={["Category", "Amount", "Share"]}
                  rows={data.categories.map((row) => [
                    row.category.name,
                    formatCurrency(row.amount),
                    `${row.percent}%`,
                  ])}
                  empty="Nothing spent in this period."
                />
              </Section>
              <Section title="By month">
                <ReportTable
                  head={["Month", "Spent"]}
                  rows={data.months.map((row) => [
                    format(parseISO(`${row.month}-01`), "MMMM yyyy"),
                    formatCurrency(row.total),
                  ])}
                  empty="Nothing spent in this period."
                />
              </Section>
            </div>

            <Section title="Transactions">
              {rows.isPending ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <ReportTable
                  head={["Date", "Title", "Category", "Payment", "Amount"]}
                  rows={(rows.data ?? []).map((expense) => [
                    formatDate(expense.date),
                    expense.title,
                    expense.category.name,
                    expense.paymentMethod ? PAYMENT_METHOD_LABELS[expense.paymentMethod] : "—",
                    `${expense.kind === ExpenseKind.REFUND ? "−" : ""}${formatCurrency(expense.amount)}`,
                  ])}
                  empty="No transactions in this period."
                  total={["Total paid (cash outflow)", formatCurrency(data.ownership.cashOutflow)]}
                />
              )}
            </Section>

            <footer className="border-t pt-3 text-xs text-muted-foreground">
              Operating cost is running the vehicle. Cash outflow is everything paid, the full EMI
              included. Economic ownership cost adds insurance and taxes, loan interest and fees,
              accessories and depreciation, which is estimated on the IRDAI motor-insurance
              schedule. Loan principal pays the loan down, so it&apos;s never a cost. Refunds are
              subtracted.
            </footer>
          </>
        )}
      </article>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 break-inside-avoid-page">
      <h2 className="font-heading text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function View({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-1 border-l-2 pl-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-heading text-lg font-semibold">{formatCurrency(value)}</dd>
      {note && <dd className="text-xs text-muted-foreground">{note}</dd>}
    </div>
  );
}

function ReportTable({
  head,
  rows,
  empty,
  total,
}: {
  head: string[];
  rows: string[][];
  empty: string;
  /** A closing row: its label and the API's figure. */
  total?: [string, string];
}) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <table className="w-full text-sm tabular-nums">
      <thead>
        <tr className="border-b text-left text-xs text-muted-foreground">
          {head.map((cell, index) => (
            <th
              key={cell}
              scope="col"
              className={cn("py-1.5 font-medium", index === head.length - 1 && "text-right")}
            >
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b last:border-b-0">
            {row.map((cell, index) => (
              <td
                key={index}
                className={cn("py-1.5 pr-2 align-top", index === row.length - 1 && "text-right")}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {total && (
        <tfoot>
          <tr className="border-t-2 font-medium">
            <td colSpan={head.length - 1} className="py-1.5">
              {total[0]}
            </td>
            <td className="py-1.5 text-right">{total[1]}</td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}
