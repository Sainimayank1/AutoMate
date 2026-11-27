import {
  type ActivityItem,
  ExpenseKind,
  ExpenseSource,
  type ServiceRecord,
} from "@automate/shared";

import type { ExpenseWithCategories } from "@/modules/expenses/expenses.mapper";

/** An activity item with what it sorts by. */
type Dated = ActivityItem & { createdAt: string };

const day = (date: Date) => date.toISOString().slice(0, 10);

/** A fill-up, expense or refund as activity; each opens where it's edited. */
export function expenseActivity(row: ExpenseWithCategories): Dated {
  const base = {
    id: `expense:${row.id}`,
    date: day(row.date),
    amount: row.amount.toFixed(2),
    odometerKm: row.odometerKm,
    createdAt: row.createdAt.toISOString(),
  };
  if (row.source === ExpenseSource.FUEL && row.sourceId) {
    return {
      ...base,
      kind: "fuel",
      title: row.title,
      detail: row.description,
      href: `/fuel/${row.vehicleId}/${row.sourceId}/edit`,
    };
  }
  const category = [row.category.name, row.subcategory?.name].filter(Boolean).join(" · ");
  if (row.kind === ExpenseKind.REFUND) {
    return {
      ...base,
      kind: "refund",
      title: row.title,
      detail: category,
      // A refund is shown on its expense.
      href: `/expenses/transactions/${row.refundOfId ?? row.id}`,
    };
  }
  return {
    ...base,
    kind: "expense",
    title: row.title,
    detail: category,
    href: `/expenses/transactions/${row.id}`,
  };
}

/** A service record as activity (its expense isn't listed separately). */
export function serviceActivity(record: ServiceRecord): Dated {
  return {
    id: `service:${record.id}`,
    kind: "service",
    date: record.serviceDate,
    title: record.title,
    detail: record.provider?.name ?? null,
    amount: record.totalAmount,
    odometerKm: record.odometerKm,
    href: `/maintenance/records/${record.vehicleId}/${record.id}`,
    createdAt: record.createdAt,
  };
}

/**
 * Two feeds, each newest first in its source's own order, merged newest first: by day, then by
 * when it was recorded. A merge, not a sort: each source keeps its order, so the first N items
 * depend only on the first N of each source and pages never repeat or skip one.
 */
export function mergeNewest(a: Dated[], b: Dated[]): ActivityItem[] {
  const merged: Dated[] = [];
  let [i, j] = [0, 0];
  while (i < a.length || j < b.length) {
    const [x, y] = [a[i], b[j]];
    const first = !y || (!!x && (x.date !== y.date ? x.date > y.date : x.createdAt >= y.createdAt));
    merged.push(first ? a[i++]! : b[j++]!);
  }
  return merged.map(({ createdAt: _, ...item }) => item);
}
