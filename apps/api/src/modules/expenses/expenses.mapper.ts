import {
  type CostClass,
  type CreateExpenseValues,
  type Expense,
  type ExpenseCategoryRef,
  type ExpenseIcon,
  LINKED_EXPENSE_SOURCES,
} from "@automate/shared";

import type {
  Expense as ExpenseRow,
  ExpenseCategory as CategoryRow,
  Prisma,
} from "@/generated/prisma/client";

export type ExpenseWithCategories = ExpenseRow & {
  category: CategoryRow;
  subcategory: CategoryRow | null;
};

const money = (value: Prisma.Decimal | null) => value?.toFixed(2) ?? null;
const day = (value: Date | null) => value?.toISOString().slice(0, 10) ?? null;

/** YYYY-MM-DD → the UTC-midnight Date a `@db.Date` column stores. */
export const toDbDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

export const toRef = (row: CategoryRow, costClass: CostClass): ExpenseCategoryRef => ({
  id: row.id,
  key: row.key,
  name: row.name,
  icon: row.icon as ExpenseIcon,
  costClass,
});

/** The only public shape of an expense row. Linked rows (Fuel, …) come back read-only. */
export function toExpense(
  row: ExpenseWithCategories,
  extra: { refunded?: Prisma.Decimal | null; shared?: { total: Prisma.Decimal; count: number } },
): Expense {
  const costClass = row.category.costClass!;
  const isFinance = [row.principalAmount, row.interestAmount, row.chargesAmount].some(
    (part) => part !== null,
  );
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    kind: row.kind,
    title: row.title,
    amount: row.amount.toFixed(2),
    date: day(row.date)!,
    category: toRef(row.category, costClass),
    subcategory: row.subcategory ? toRef(row.subcategory, costClass) : null,
    paymentMethod: row.paymentMethod,
    vendor: row.vendor,
    odometerKm: row.odometerKm,
    description: row.description,
    notes: row.notes,
    source: row.source,
    sourceId: row.sourceId,
    editable: !LINKED_EXPENSE_SOURCES.includes(row.source),
    refundOfId: row.refundOfId,
    refundReason: row.refundReason,
    refundedAmount: (extra.refunded ?? null)?.toFixed(2) ?? "0.00",
    shared:
      row.sharedGroupId && extra.shared
        ? {
            groupId: row.sharedGroupId,
            totalAmount: extra.shared.total.toFixed(2),
            vehicleCount: extra.shared.count,
          }
        : null,
    finance: isFinance
      ? {
          principal: money(row.principalAmount),
          interest: money(row.interestAmount),
          charges: money(row.chargesAmount),
          loanReference: row.loanReference,
          loanOutstanding: money(row.loanOutstanding),
          loanId: row.loanId,
        }
      : null,
    details: {
      serviceType: row.serviceType,
      partsReplaced: row.partsReplaced,
      partsAmount: money(row.partsAmount),
      labourAmount: money(row.labourAmount),
      warrantyUntil: day(row.warrantyUntil),
      provider: row.provider,
      policyNumber: row.policyNumber,
      policyStart: day(row.policyStart),
      policyEnd: day(row.policyEnd),
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * A stored expense (and its shared group) back in input form, so an edit can be merged onto it
 * and checked by the same rules as a new one.
 */
export function toExpenseInput(
  row: ExpenseRow,
  group: ExpenseRow[],
): Omit<CreateExpenseValues, "id"> {
  const total = group.reduce((sum, item) => sum.plus(item.amount), row.amount.minus(row.amount));
  return {
    allocation:
      group.length > 1
        ? {
            mode: "shared",
            split: "custom",
            vehicles: group.map((item) => ({
              vehicleId: item.vehicleId,
              amount: item.amount.toFixed(2),
            })),
          }
        : { mode: "single", vehicleId: row.vehicleId },
    categoryId: row.categoryId,
    subcategoryId: row.subcategoryId,
    title: row.title,
    amount: total.toFixed(2),
    date: day(row.date)!,
    paymentMethod: row.paymentMethod,
    vendor: row.vendor,
    odometerKm: row.odometerKm,
    description: row.description,
    notes: row.notes,
    principalAmount: money(row.principalAmount),
    interestAmount: money(row.interestAmount),
    chargesAmount: money(row.chargesAmount),
    loanReference: row.loanReference,
    loanOutstanding: money(row.loanOutstanding),
    loanId: row.loanId,
    serviceType: row.serviceType,
    partsReplaced: row.partsReplaced,
    partsAmount: money(row.partsAmount),
    labourAmount: money(row.labourAmount),
    warrantyUntil: day(row.warrantyUntil),
    provider: row.provider,
    policyNumber: row.policyNumber,
    policyStart: day(row.policyStart),
    policyEnd: day(row.policyEnd),
  };
}
