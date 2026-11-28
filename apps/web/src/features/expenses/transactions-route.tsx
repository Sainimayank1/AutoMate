import { CostClass, type Expense, type Vehicle } from "@automate/shared";
import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "cn";
import { format } from "date-fns";
import { Download, ReceiptIndianRupee, Tags, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Outlet } from "react-router";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DataTable } from "@/components/common/data-table";
import { Pager } from "@/components/common/pager";
import { SearchInput } from "@/components/common/search-input";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { CategorySelect } from "@/features/expenses/components/category-select";
import { ExpenseActions } from "@/features/expenses/components/expense-actions";
import { ExpenseAmount } from "@/features/expenses/components/expense-amount";
import { ExpenseFilters, SortSelect } from "@/features/expenses/components/expense-filters";
import { ExpenseTitle } from "@/features/expenses/components/expense-title";
import { ExpensesLayout } from "@/features/expenses/components/expenses-layout";
import { ImportDialog } from "@/features/expenses/components/import-dialog";
import { RefundDialog } from "@/features/expenses/components/refund-dialog";
import { SOURCE_LABELS } from "@/features/expenses/constants";
import { useExpenseFilters } from "@/features/expenses/hooks/use-expense-filters";
import {
  useBulkDeleteExpenses,
  useBulkRecategoriseExpenses,
  useDeleteExpense,
  useExpenseCategories,
  useExpenses,
  useExportExpenses,
} from "@/features/expenses/hooks/use-expenses";
import { expensesToCsv } from "@/features/expenses/utils/csv";
import {
  categoryPair,
  deleteText,
  remainingRefund,
  sourceHref,
} from "@/features/expenses/utils/expense-helpers";
import { PAYMENT_METHOD_LABELS } from "@/features/fuel/constants";
import { vehicleName } from "@/features/garage/constants";
import { useVehicles } from "@/features/garage/hooks/use-vehicles";
import { downloadCsv } from "@/utils/csv";
import { formatDate, formatNumber } from "@/utils/format";

const SEARCH_DELAY_MS = 300;

/**
 * Stitch "Expenses — Transactions": filters, a selectable table (list on phones), bulk actions,
 * server paging and the CSV export. The details sheet renders in the <Outlet/>.
 */
export function Component() {
  const filters = useExpenseFilters();
  const inUse = useVehicles();
  const archived = useVehicles({ archived: true });
  const categories = useExpenseCategories();
  const list = useExpenses(filters.query, { enabled: filters.ready });
  const exporter = useExportExpenses();
  const [importing, setImporting] = useState(false);

  const vehicles = inUse.data ?? [];
  const byId = new Map<string, Vehicle>(
    [...vehicles, ...(archived.data ?? [])].map((v) => [v.id, v]),
  );
  const vehicleLabel = (id: string) => {
    const vehicle = byId.get(id);
    return vehicle ? vehicleName(vehicle) : "Vehicle";
  };

  // Search once typing pauses; "Clear filters" (q removed) empties the box too.
  const [search, setSearch] = useState(filters.get("q") ?? "");
  const q = filters.get("q");
  const [lastQ, setLastQ] = useState(q);
  if (q !== lastQ) {
    setLastQ(q);
    if (q === undefined) setSearch("");
  }
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.trim() !== (filters.get("q") ?? "")) filters.set("q", search.trim() || undefined);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps -- debounce on the text only

  // Selection belongs to one page of one query: a new query starts empty.
  const queryKey = JSON.stringify(filters.query);
  const [selection, setSelection] = useState({ key: queryKey, ids: new Set<string>() });
  if (selection.key !== queryKey) setSelection({ key: queryKey, ids: new Set() });
  const toggle = (id: string, on: boolean) => {
    const ids = new Set(selected);
    if (on) ids.add(id);
    else ids.delete(id);
    setSelection({ key: queryKey, ids });
  };

  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [refunding, setRefunding] = useState<Expense | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [moving, setMoving] = useState(false);
  const remove = useDeleteExpense();
  const bulkDelete = useBulkDeleteExpenses();

  const page = list.data;
  const rows = page?.items ?? [];
  // Only rows still on the page count (one deleted on its own drops out).
  const selectedRows = rows.filter((row) => selection.ids.has(row.id));
  const selected = new Set(selectedRows.map((row) => row.id));

  // Deleting the last rows of the last page: go back to the new last page.
  const lastPage = Math.max(page?.meta.totalPages ?? 1, 1);
  useEffect(() => {
    if (page && filters.page > lastPage) filters.setPage(lastPage);
  }, [page, lastPage]); // eslint-disable-line react-hooks/exhaustive-deps -- filters is new each render
  const exportCsv = async (expenses: Expense[]) =>
    downloadCsv(
      `automate-expenses-${format(new Date(), "yyyy-MM-dd")}.csv`,
      expensesToCsv(expenses, vehicleLabel),
    );

  const columns: ColumnDef<Expense>[] = [
    {
      id: "select",
      header: () => (
        <Checkbox
          aria-label="Select all on this page"
          checked={rows.length > 0 && rows.every((row) => selected.has(row.id))}
          onCheckedChange={(on) =>
            setSelection({
              key: queryKey,
              ids: on === true ? new Set(rows.map((row) => row.id)) : new Set(),
            })
          }
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label={`Select ${row.original.title}`}
          checked={selected.has(row.original.id)}
          onCheckedChange={(on) => toggle(row.original.id, on === true)}
        />
      ),
    },
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
      cell: ({ row }) => <ExpenseTitle expense={row.original} />,
    },
    { id: "vehicle", header: "Vehicle", cell: ({ row }) => vehicleLabel(row.original.vehicleId) },
    {
      id: "payment",
      header: "Payment",
      cell: ({ row }) =>
        row.original.paymentMethod ? PAYMENT_METHOD_LABELS[row.original.paymentMethod] : "—",
    },
    { id: "source", header: "Source", cell: ({ row }) => <SourceChip expense={row.original} /> },
    {
      id: "amount",
      header: () => <div className="text-right">Amount</div>,
      cell: ({ row }) => <ExpenseAmount expense={row.original} />,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="text-right">
          <ExpenseActions
            expense={row.original}
            onDelete={() => setDeleting(row.original)}
            onRefund={() => setRefunding(row.original)}
          />
        </div>
      ),
    },
  ];

  const total = page?.meta.total ?? 0;
  const empty = !list.isPending && total === 0;

  return (
    <ExpensesLayout
      tab="transactions"
      actions={
        <>
          <Button variant="outline" onClick={() => setImporting(true)} disabled={!vehicles.length}>
            <Upload data-icon="inline-start" />
            Import CSV
          </Button>
          <Button
            variant="outline"
            disabled={exporter.isPending || empty}
            onClick={async () =>
              exportCsv(await exporter.mutateAsync({ ...filters.query, page: undefined }))
            }
          >
            {exporter.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Download data-icon="inline-start" />
            )}
            Export CSV
          </Button>
        </>
      }
    >
      {importing && (
        <ImportDialog
          open
          onOpenChange={setImporting}
          vehicles={vehicles}
          vehicleId={filters.query.vehicleId}
        />
      )}
      <ExpenseFilters filters={filters} vehicles={vehicles} categories={categories.data ?? []} />

      {list.isError && !page ? (
        <ErrorState
          title="Couldn't load expenses"
          error={list.error}
          onRetry={() => void list.refetch()}
        />
      ) : empty && !filters.narrowed ? (
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
        <section
          aria-busy={list.isPlaceholderData}
          className={cn(
            "flex flex-col gap-4 rounded-xl border bg-card p-4 transition-opacity sm:p-5",
            // Another vehicle's or page's rows stay visible until the new ones arrive: dim them.
            list.isPlaceholderData && "opacity-60",
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            {selected.size > 0 ? (
              <div
                className="flex flex-wrap items-center gap-2"
                role="toolbar"
                aria-label="Selected expenses"
              >
                <span className="text-sm font-medium">{formatNumber(selected.size)} selected</span>
                <Button variant="outline" size="sm" onClick={() => setMoving(true)}>
                  <Tags data-icon="inline-start" />
                  Change category
                </Button>
                <Button variant="outline" size="sm" onClick={() => void exportCsv(selectedRows)}>
                  <Download data-icon="inline-start" />
                  Export
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive"
                  onClick={() => setBulkDeleting(true)}
                >
                  <Trash2 data-icon="inline-start" />
                  Delete
                </Button>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground" aria-live="polite">
                {formatNumber(total)} {total === 1 ? "expense" : "expenses"}
              </span>
            )}
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <SearchInput
                value={search}
                onValueChange={setSearch}
                placeholder="Search title, vendor, notes"
                aria-label="Search expenses"
                className="h-9 w-full sm:w-64"
              />
              <SortSelect filters={filters} />
            </div>
          </div>

          {empty ? (
            <EmptyState
              title="No expenses match these filters"
              description="Try a wider date range or another category."
              action={
                <Button variant="outline" onClick={filters.clear}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <>
              <div className="max-md:hidden">
                <DataTable
                  columns={columns}
                  data={rows}
                  loading={list.isPending}
                  paginate={false}
                />
              </div>
              <ul className="flex flex-col divide-y rounded-lg border md:hidden">
                {rows.map((expense) => (
                  <li key={expense.id} className="flex items-center gap-2 p-3">
                    <Checkbox
                      aria-label={`Select ${expense.title}`}
                      checked={selected.has(expense.id)}
                      onCheckedChange={(on) => toggle(expense.id, on === true)}
                    />
                    <div className="min-w-0 flex-1">
                      <ExpenseTitle
                        expense={expense}
                        meta={`${formatDate(expense.date)} · ${vehicleLabel(expense.vehicleId)}`}
                      />
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <ExpenseAmount expense={expense} />
                      <SourceChip expense={expense} />
                    </div>
                    <ExpenseActions
                      expense={expense}
                      onDelete={() => setDeleting(expense)}
                      onRefund={() => setRefunding(expense)}
                    />
                  </li>
                ))}
              </ul>
              {page && (
                <Pager
                  page={page.meta.page}
                  pageCount={page.meta.totalPages}
                  onPageChange={filters.setPage}
                />
              )}
            </>
          )}
        </section>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting?.kind === "REFUND" ? "Delete this refund?" : "Delete this expense?"}
        description={deleting ? deleteText(deleting) : undefined}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (deleting) await remove.mutateAsync(deleting.id);
        }}
      />
      <ConfirmDialog
        open={bulkDeleting}
        onOpenChange={setBulkDeleting}
        title={`Delete ${formatNumber(selected.size)} ${selected.size === 1 ? "expense" : "expenses"}?`}
        description="They're removed with their refunds (shared ones from every vehicle). Expenses from Fuel stay; delete those in Fuel. This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          await bulkDelete.mutateAsync([...selected]);
          setSelection({ key: queryKey, ids: new Set() });
        }}
      />
      {refunding && (
        <RefundDialog
          expense={refunding}
          remaining={remainingRefund(refunding)}
          open
          onOpenChange={(open) => !open && setRefunding(null)}
        />
      )}
      <RecategoriseDialog
        open={moving}
        onOpenChange={setMoving}
        ids={[...selected]}
        onDone={() => setSelection({ key: queryKey, ids: new Set() })}
      />
      <Outlet />
    </ExpensesLayout>
  );
}

function SourceChip({ expense }: { expense: Expense }) {
  const origin = sourceHref(expense);
  const label = SOURCE_LABELS[expense.source];
  return origin ? (
    <Badge variant="outline" asChild>
      <Link to={origin}>{label}</Link>
    </Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      {label}
    </Badge>
  );
}

function RecategoriseDialog({
  open,
  onOpenChange,
  ids,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ids: string[];
  onDone: () => void;
}) {
  const categories = useExpenseCategories();
  const move = useBulkRecategoriseExpenses();
  const [target, setTarget] = useState<string>();
  const all = categories.data ?? [];
  const pair = target ? categoryPair(all, target) : null;
  return (
    <Dialog open={open} onOpenChange={(next) => !move.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change category</DialogTitle>
          <DialogDescription>
            Moves {formatNumber(ids.length)} {ids.length === 1 ? "expense" : "expenses"} (shared
            ones on every vehicle). Loan payments and expenses from Fuel are left as they are.
          </DialogDescription>
        </DialogHeader>
        <CategorySelect
          aria-label="New category"
          className="w-full"
          categories={all}
          value={target}
          onChange={setTarget}
          only={(category) =>
            category.active && category.key !== "FUEL" && category.costClass !== CostClass.FINANCING
          }
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={move.isPending}>
            Cancel
          </Button>
          <Button
            disabled={!pair || move.isPending}
            onClick={async () => {
              if (!pair) return;
              await move.mutateAsync({
                ids,
                categoryId: pair.category.id,
                subcategoryId: pair.subcategory?.id ?? null,
              });
              onDone();
              onOpenChange(false);
            }}
          >
            {move.isPending && <Spinner data-icon="inline-start" />}
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
