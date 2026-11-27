import { type Expense, ExpenseKind } from "@automate/shared";
import { Copy, Pencil, Trash2, Undo2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryIcon } from "@/features/expenses/components/category-icon";
import { RefundDialog } from "@/features/expenses/components/refund-dialog";
import {
  COST_CLASS_TEXT,
  REFUND_REASON_LABELS,
  SOURCE_LABELS,
} from "@/features/expenses/constants";
import { useDeleteExpense, useExpense } from "@/features/expenses/hooks/use-expenses";
import {
  canRefund,
  deleteText,
  remainingRefund,
  sourceHref,
} from "@/features/expenses/utils/expense-helpers";
import { PAYMENT_METHOD_LABELS } from "@/features/fuel/constants";
import { vehicleName } from "@/features/garage/constants";
import { useVehicles } from "@/features/garage/hooks/use-vehicles";
import { normalizeApiError } from "@/lib/api-error";
import { formatCurrency, formatDate, formatDistance, formatRegistration } from "@/utils/format";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}

/**
 * Stitch "Expense Details": a side sheet over the transactions (a bottom sheet on phones) with
 * the amount, its fields, the loan split, refunds and the actions. Linked expenses send you to
 * their own module to edit.
 */
export function Component() {
  const { expenseId = "" } = useParams();
  const navigate = useNavigate();
  const { search } = useLocation();
  const { data: expense, isPending, error } = useExpense(expenseId);
  const inUse = useVehicles();
  const archived = useVehicles({ archived: true });
  const remove = useDeleteExpense();
  const [deleting, setDeleting] = useState(false);
  const [refunding, setRefunding] = useState(false);

  const close = () => navigate({ pathname: "/expenses/transactions", search });
  const vehicles = [...(inUse.data ?? []), ...(archived.data ?? [])];
  const vehicleOf = (id: string) => vehicles.find((vehicle) => vehicle.id === id);
  const label = (id: string) => {
    const vehicle = vehicleOf(id);
    return vehicle
      ? `${vehicleName(vehicle)} (${formatRegistration(vehicle.registrationNumber)})`
      : "—";
  };

  return (
    <Sheet open onOpenChange={(open) => !open && close()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        {isPending ? (
          <div className="flex flex-col gap-4 p-6" aria-busy>
            <SheetTitle className="sr-only">Loading expense</SheetTitle>
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-12 w-48" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : !expense ? (
          <SheetHeader>
            <SheetTitle>Expense not found</SheetTitle>
            <SheetDescription>
              {normalizeApiError(error).status === 404
                ? "It may have been deleted, or it isn't yours."
                : normalizeApiError(error).message}
            </SheetDescription>
          </SheetHeader>
        ) : (
          <>
            <SheetHeader className="gap-3">
              <div className="flex items-center gap-3">
                <CategoryIcon category={expense.subcategory ?? expense.category} />
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">
                    {expense.subcategory?.name ?? expense.category.name}
                  </Badge>
                  {expense.kind === ExpenseKind.REFUND && <Badge variant="outline">Refund</Badge>}
                </div>
              </div>
              <SheetTitle className="text-lg">{expense.title}</SheetTitle>
              <SheetDescription>
                {expense.category.name} · {COST_CLASS_TEXT[expense.category.costClass].label}
              </SheetDescription>
              <p className="font-heading text-3xl font-semibold tracking-tight tabular-nums">
                {expense.kind === ExpenseKind.REFUND ? "−" : ""}
                {formatCurrency(expense.amount)}
              </p>
            </SheetHeader>

            <div className="flex flex-col gap-4 px-4 pb-4">
              <dl className="divide-y">
                <Row label="Date">{formatDate(expense.date)}</Row>
                <Row label="Vehicle">{label(expense.vehicleId)}</Row>
                <Row label="Payment">
                  {expense.paymentMethod ? PAYMENT_METHOD_LABELS[expense.paymentMethod] : "—"}
                </Row>
                {expense.vendor && <Row label="Vendor">{expense.vendor}</Row>}
                {expense.odometerKm !== null && (
                  <Row label="Odometer">{formatDistance(expense.odometerKm)}</Row>
                )}
                <Row label="Source">
                  {sourceHref(expense) ? (
                    <Link
                      to={sourceHref(expense)!}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {SOURCE_LABELS[expense.source]}
                    </Link>
                  ) : (
                    SOURCE_LABELS[expense.source]
                  )}
                </Row>
                {expense.refundReason && (
                  <Row label="Reason">{REFUND_REASON_LABELS[expense.refundReason]}</Row>
                )}
                {expense.description && <Row label="Description">{expense.description}</Row>}
                {expense.notes && <Row label="Notes">{expense.notes}</Row>}
              </dl>

              {expense.group.length > 1 && (
                <Block title={`Shared across ${expense.group.length} vehicles`}>
                  <dl className="divide-y">
                    {expense.group.map((share) => (
                      <Row key={share.expenseId} label={label(share.vehicleId)}>
                        <span className="tabular-nums">{formatCurrency(share.amount)}</span>
                      </Row>
                    ))}
                  </dl>
                </Block>
              )}

              {expense.finance && (
                <Block
                  title="Loan split"
                  note="Principal reduces the loan; only interest and charges are ownership costs."
                >
                  <dl className="divide-y">
                    <Row label="Principal">
                      <span className="tabular-nums">
                        {formatCurrency(expense.finance.principal ?? "0")}
                      </span>
                    </Row>
                    <Row label="Interest">
                      <span className="tabular-nums">
                        {formatCurrency(expense.finance.interest ?? "0")}
                      </span>
                    </Row>
                    <Row label="Charges">
                      <span className="tabular-nums">
                        {formatCurrency(expense.finance.charges ?? "0")}
                      </span>
                    </Row>
                    {expense.finance.loanReference && (
                      <Row label="Loan reference">{expense.finance.loanReference}</Row>
                    )}
                    {expense.finance.loanOutstanding && (
                      <Row label="Outstanding">
                        <span className="tabular-nums">
                          {formatCurrency(expense.finance.loanOutstanding)}
                        </span>
                      </Row>
                    )}
                  </dl>
                </Block>
              )}

              <Details expense={expense} />

              {expense.kind === ExpenseKind.EXPENSE && (
                <Block
                  title="Refunds"
                  action={
                    canRefund(expense) && remainingRefund(expense) !== "0.00" ? (
                      <Button variant="ghost" size="sm" onClick={() => setRefunding(true)}>
                        <Undo2 data-icon="inline-start" />
                        Add refund
                      </Button>
                    ) : null
                  }
                >
                  {expense.refunds.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No refunds</p>
                  ) : (
                    <dl className="divide-y">
                      {expense.refunds.map((refund) => (
                        <Row
                          key={refund.id}
                          label={`${formatDate(refund.date)} · ${REFUND_REASON_LABELS[refund.refundReason!]}`}
                        >
                          <span className="tabular-nums">−{formatCurrency(refund.amount)}</span>
                        </Row>
                      ))}
                    </dl>
                  )}
                </Block>
              )}
            </div>

            <SheetFooter className="flex-row flex-wrap gap-2 border-t">
              {expense.editable && expense.kind === ExpenseKind.EXPENSE && (
                <>
                  <Button asChild>
                    <Link to={`/expenses/${expense.id}/edit`}>
                      <Pencil data-icon="inline-start" />
                      Edit
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to={`/expenses/new?from=${expense.id}`}>
                      <Copy data-icon="inline-start" />
                      Duplicate
                    </Link>
                  </Button>
                </>
              )}
              {sourceHref(expense) && (
                <Button asChild>
                  <Link to={sourceHref(expense)!}>
                    <Pencil data-icon="inline-start" />
                    Edit in Fuel
                  </Link>
                </Button>
              )}
              {expense.editable && (
                <Button
                  variant="outline"
                  className="text-destructive"
                  onClick={() => setDeleting(true)}
                >
                  <Trash2 data-icon="inline-start" />
                  Delete
                </Button>
              )}
            </SheetFooter>

            <ConfirmDialog
              open={deleting}
              onOpenChange={setDeleting}
              title={
                expense.kind === ExpenseKind.REFUND ? "Delete this refund?" : "Delete this expense?"
              }
              description={deleteText(expense)}
              confirmLabel="Delete"
              destructive
              onConfirm={async () => {
                await remove.mutateAsync(expense.id);
                close();
              }}
            />
            {refunding && (
              <RefundDialog
                expense={expense}
                remaining={remainingRefund(expense)}
                open
                onOpenChange={setRefunding}
              />
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Block({
  title,
  note,
  action,
  children,
}: {
  title: string;
  note?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1 rounded-lg border bg-muted/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {action}
      </div>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      {children}
    </section>
  );
}

/** Category details (service, parts, labour, warranty, policy), only the ones recorded. */
function Details({ expense }: { expense: Expense }) {
  const { details } = expense;
  const rows: [string, ReactNode][] = [
    ["Service type", details.serviceType],
    ["Parts replaced", details.partsReplaced],
    ["Parts", details.partsAmount && formatCurrency(details.partsAmount)],
    ["Labour", details.labourAmount && formatCurrency(details.labourAmount)],
    ["Warranty until", details.warrantyUntil && formatDate(details.warrantyUntil)],
    ["Provider", details.provider],
    ["Policy number", details.policyNumber],
    [
      "Policy period",
      details.policyStart &&
        details.policyEnd &&
        `${formatDate(details.policyStart)} – ${formatDate(details.policyEnd)}`,
    ],
  ];
  const shown = rows.filter(([, value]) => value);
  if (!shown.length) return null;
  return (
    <Block title="Details">
      <dl className="divide-y">
        {shown.map(([label, value]) => (
          <Row key={label} label={label}>
            {value}
          </Row>
        ))}
      </dl>
    </Block>
  );
}
