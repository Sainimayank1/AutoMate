import {
  LoanMethod,
  loanRateChangeSchema,
  type LoanRateChangeValues,
  type VehicleLoan,
} from "@automate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import { ArrowLeft, EllipsisVertical, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { type Control, type Resolver, useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DatePicker } from "@/components/common/date-picker";
import { FormError } from "@/components/common/form-error";
import { FormField } from "@/components/common/form-field";
import { NumberInput } from "@/components/common/number-input";
import { PageContainer } from "@/components/common/page-container";
import { Pager } from "@/components/common/pager";
import { Segmented } from "@/components/common/segmented";
import { StatusBadge } from "@/components/common/status-badge";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LOAN_METHOD_LABELS, PAYMENT_STATE } from "@/features/expenses/constants";
import {
  useAddRateChange,
  useDeleteLoan,
  useLoan,
  useLoanSchedule,
  useRemoveRateChange,
} from "@/features/expenses/hooks/use-recurring";
import { applyServerErrors } from "@/lib/forms";
import { formatCurrency, formatDate, formatNumber } from "@/utils/format";

const PAGE_SIZE = 12;
const rate = (value: string) => `${formatNumber(value, { minFractionDigits: 2 })}%`;
const monthYear = (date: string) => format(parseISO(date), "MMM yyyy");

/**
 * `/expenses/loans/:loanId` (Stitch "Loan Details"): the loan's position today, its rate changes
 * and the amortisation schedule (worked out by the API, with each EMI's payment state).
 */
export function Component() {
  const { loanId = "" } = useParams();
  const loan = useLoan(loanId);
  const navigate = useNavigate();
  const remove = useDeleteLoan();
  const [deleting, setDeleting] = useState(false);

  if (loan.isPending) return <LoadingState label="Loading the loan…" />;
  if (loan.isError || !loan.data) {
    return (
      <PageContainer>
        <ErrorState
          title="Couldn't load the loan"
          error={loan.error}
          onRetry={() => void loan.refetch()}
        />
      </PageContainer>
    );
  }
  const data = loan.data;
  return (
    <PageContainer>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Button variant="outline" size="icon" className="size-10 shrink-0" asChild>
            <Link to="/expenses/recurring" aria-label="Back to recurring payments">
              <ArrowLeft />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate font-heading text-2xl font-semibold tracking-tight">
              {data.lender}
              {data.accountNumber && ` · ${data.accountNumber}`}
            </h1>
            <p className="text-sm text-muted-foreground tabular-nums">
              {LOAN_METHOD_LABELS[data.method]} · {formatCurrency(data.principal)} at{" "}
              {rate(data.annualRate)} for {data.tenureMonths} months
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild className="max-md:h-10">
            <Link to={`/expenses/loans/${data.id}/edit`}>Edit loan</Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="max-md:size-10" aria-label="More">
                <EllipsisVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                <Trash2 />
                Delete loan
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Position loan={data} />
      <RateChanges loan={data} />
      <Schedule loan={data} />

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete the ${data.lender} loan?`}
        description="Its EMI schedule goes too. EMIs and prepayments already recorded stay as expenses."
        confirmLabel="Delete loan"
        destructive
        onConfirm={async () => {
          await remove.mutateAsync(data.id);
          navigate("/expenses/recurring", { replace: true });
        }}
      />
    </PageContainer>
  );
}

function Position({ loan }: { loan: VehicleLoan }) {
  const tiles = [
    {
      label: "Outstanding",
      value: formatCurrency(loan.outstanding),
      note: `${loan.emisTotal - loan.paid.emis} EMIs to go`,
    },
    { label: "Current EMI", value: formatCurrency(loan.emi), note: rate(loan.annualRate) },
    {
      label: "Next EMI",
      value: loan.next ? formatDate(loan.next.date) : "—",
      note: loan.next
        ? `${formatCurrency(loan.next.principal)} principal · ${formatCurrency(loan.next.interest)} interest`
        : "All EMIs recorded",
    },
    { label: "Ends", value: monthYear(loan.endDate), note: `EMI ${loan.emisTotal}` },
  ];
  return (
    <section aria-label="Loan position" className="flex flex-col gap-3">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label} className="gap-1 py-4">
            <CardContent className="flex flex-col gap-1">
              <dt className="text-xs tracking-wider text-muted-foreground uppercase">
                {tile.label}
              </dt>
              <dd className="font-heading text-xl font-semibold tabular-nums">{tile.value}</dd>
              <dd className="text-xs text-muted-foreground tabular-nums">{tile.note}</dd>
            </CardContent>
          </Card>
        ))}
      </dl>
      <Card className="py-4">
        <CardContent className="flex flex-col gap-2">
          <Progress
            value={(loan.paid.emis / Math.max(loan.emisTotal, 1)) * 100}
            aria-label={`${loan.paid.emis} of ${loan.emisTotal} EMIs paid`}
            className="h-1.5"
          />
          <p className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
            <span>
              {loan.paid.emis} of {loan.emisTotal} EMIs paid
            </span>
            <span>
              Principal repaid {formatCurrency(loan.paid.principal)} · Interest paid{" "}
              {formatCurrency(loan.paid.interest)} · Total interest{" "}
              {formatCurrency(loan.totalInterest)}
            </span>
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

function RateChanges({ loan }: { loan: VehicleLoan }) {
  const [adding, setAdding] = useState(false);
  const remove = useRemoveRateChange(loan.id);
  if (loan.method === LoanMethod.FLAT) return null;
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle role="heading" aria-level={2}>
          Rate changes
        </CardTitle>
        <Button variant="outline" size="sm" className="max-md:h-10" onClick={() => setAdding(true)}>
          <Plus data-icon="inline-start" />
          Add rate change
        </Button>
      </CardHeader>
      <CardContent>
        {loan.rateChanges.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            None. A floating-rate loan&apos;s changes go here; the schedule follows them.
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {loan.rateChanges.map((change) => (
              <li key={change.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="tabular-nums">
                  From {formatDate(change.effectiveFrom)} · {rate(change.annualRate)} ·{" "}
                  <span className="text-muted-foreground">
                    {change.keepEmi ? "EMI kept, tenure moves" : "Tenure kept, EMI moves"}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="max-md:size-10"
                  aria-label={`Remove the rate change from ${formatDate(change.effectiveFrom)}`}
                  onClick={() => remove.mutate(change.id)}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <RateChangeDialog loan={loan} open={adding} onOpenChange={setAdding} />
    </Card>
  );
}

type RateForm = { effectiveFrom: string; annualRate: string; keepEmi: boolean };

function RateChangeDialog({
  loan,
  open,
  onOpenChange,
}: {
  loan: VehicleLoan;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const add = useAddRateChange(loan.id);
  const form = useForm<RateForm, unknown, LoanRateChangeValues>({
    resolver: zodResolver(loanRateChangeSchema) as unknown as Resolver<
      RateForm,
      unknown,
      LoanRateChangeValues
    >,
    defaultValues: { effectiveFrom: "", annualRate: "", keepEmi: true },
  });
  const { isSubmitting, errors } = form.formState;
  const control = form.control as unknown as Control<RateForm>;
  const submit = form.handleSubmit(async (values) => {
    try {
      await add.mutateAsync(values);
      form.reset();
      onOpenChange(false);
    } catch (error) {
      applyServerErrors(form.setError, error);
    }
  });
  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add rate change</DialogTitle>
          <DialogDescription>
            It applies from the first EMI on or after the date. Banks usually keep the EMI and move
            the end date.
          </DialogDescription>
        </DialogHeader>
        <form id="rate-form" noValidate onSubmit={submit} className="flex flex-col gap-4">
          <FormError message={errors.root?.server?.message} />
          <FormField
            control={control}
            name="effectiveFrom"
            label="From"
            render={(field) => (
              <DatePicker
                ref={field.ref}
                id={field.id}
                aria-invalid={field["aria-invalid"]}
                value={field.value ? parseISO(field.value) : undefined}
                onChange={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                disabledDates={{ before: parseISO(loan.firstEmiDate) }}
              />
            )}
          />
          <FormField
            control={control}
            name="annualRate"
            label="New rate"
            render={(field) => <NumberInput {...field} suffix="% a year" decimals={2} />}
          />
          <FormField
            control={control}
            name="keepEmi"
            label="What changes"
            render={(field) => (
              <Segmented
                aria-labelledby={`${field.id}-label`}
                className="grid w-full grid-cols-2"
                value={field.value ? "emi" : "tenure"}
                onChange={(value) => field.onChange(value === "emi")}
                options={[
                  { value: "emi", label: "Keep the EMI" },
                  { value: "tenure", label: "Keep the tenure" },
                ]}
              />
            )}
          />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="rate-form" disabled={isSubmitting}>
            {isSubmitting && <Spinner data-icon="inline-start" />}
            Save rate change
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Schedule({ loan }: { loan: VehicleLoan }) {
  const [page, setPage] = useState(1);
  const schedule = useLoanSchedule(loan.id, page, PAGE_SIZE);
  const rows = schedule.data?.items ?? [];
  const money = (value: string) => formatCurrency(value);
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Amortisation schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {schedule.isError && !schedule.data ? (
          <ErrorState
            title="Couldn't load the schedule"
            error={schedule.error}
            onRetry={() => void schedule.refetch()}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[48rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Opening</TableHead>
                  <TableHead className="text-right">EMI</TableHead>
                  <TableHead className="text-right">Interest</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead className="text-right">Prepayment</TableHead>
                  <TableHead className="text-right">Closing</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="tabular-nums">
                {rows.map((row) => {
                  const state = PAYMENT_STATE[row.state];
                  return (
                    <TableRow key={row.number}>
                      <TableCell className="text-muted-foreground">{row.number}</TableCell>
                      <TableCell>{formatDate(row.date)}</TableCell>
                      <TableCell className="text-right">{rate(row.annualRate)}</TableCell>
                      <TableCell className="text-right">{money(row.openingBalance)}</TableCell>
                      <TableCell className="text-right font-medium">{money(row.emi)}</TableCell>
                      <TableCell className="text-right">{money(row.interest)}</TableCell>
                      <TableCell className="text-right">{money(row.principal)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {Number(row.prepayment) ? money(row.prepayment) : "—"}
                      </TableCell>
                      <TableCell className="text-right">{money(row.closingBalance)}</TableCell>
                      <TableCell>
                        <StatusBadge tone={state.tone} icon={state.icon} label={state.label} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {(schedule.data?.meta.totalPages ?? 0) > 1 && (
          <Pager page={page} pageCount={schedule.data!.meta.totalPages} onPageChange={setPage} />
        )}
        <p className="text-xs text-muted-foreground">
          Part-prepayments are expenses in Finance, tagged with this loan; they keep the EMI and end
          the loan sooner.
        </p>
      </CardContent>
    </Card>
  );
}
