import { ExpenseKind, type ExpenseSource, type PaymentMethod } from "@automate/shared";
import { ConflictException, Injectable, Logger } from "@nestjs/common";

import type { Prisma } from "@/generated/prisma/client";

/** A record in another module, as the money it represents. */
export type LinkedExpense = {
  userId: string;
  vehicleId: string;
  /** FUEL today; MAINTENANCE and TRIP when those modules arrive. */
  source: Exclude<ExpenseSource, "MANUAL" | "IMPORT" | "RECURRING">;
  /** The source record's id: one expense per record, ever. */
  sourceId: string;
  /** System category keys (SYSTEM_EXPENSE_CATEGORIES), e.g. "FUEL" / "FUEL.PETROL". */
  categoryKey: string;
  subcategoryKey: string | null;
  title: string;
  amount: string;
  /** YYYY-MM-DD, in IST. */
  date: string;
  paymentMethod: PaymentMethod | null;
  vendor: string | null;
  odometerKm: number | null;
  description: string | null;
  notes: string | null;
  /** Service details (Maintenance); left empty by other sources. */
  service?: {
    serviceType: string;
    partsReplaced: string | null;
    /** Only when they fit in the amount (the database checks parts + labour ≤ amount). */
    partsAmount: string | null;
    labourAmount: string | null;
    warrantyUntil: string | null;
    provider: string | null;
  };
};

const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

/**
 * How other modules keep their money in Expenses (docs/architecture/expenses.md): the owning
 * module calls `sync` / `remove` inside its own write transaction, while it holds the vehicle's
 * lock. The expense is keyed by (source, sourceId), so a record can never be counted twice, and
 * it stays read-only in Expenses: the source module is its source of truth.
 */
@Injectable()
export class LinkedExpensesService {
  private readonly logger = new Logger(LinkedExpensesService.name);

  /** Creates or updates the record's expense. */
  async sync(tx: Prisma.TransactionClient, linked: LinkedExpense): Promise<void> {
    const keys = [linked.categoryKey, ...(linked.subcategoryKey ? [linked.subcategoryKey] : [])];
    const categories = await tx.expenseCategory.findMany({
      where: { key: { in: keys }, userId: null },
      select: { id: true, key: true },
    });
    const idOf = (key: string) => categories.find((category) => category.key === key)?.id;
    const categoryId = idOf(linked.categoryKey);
    // System categories are seeded on every deploy; missing ones are a deployment fault.
    if (!categoryId) throw new Error(`System expense category ${linked.categoryKey} is missing`);

    const data = {
      vehicleId: linked.vehicleId,
      title: linked.title.slice(0, 120),
      amount: linked.amount,
      date: new Date(`${linked.date}T00:00:00.000Z`),
      categoryId,
      subcategoryId: linked.subcategoryKey ? (idOf(linked.subcategoryKey) ?? null) : null,
      paymentMethod: linked.paymentMethod,
      vendor: linked.vendor,
      odometerKm: linked.odometerKm,
      description: linked.description,
      notes: linked.notes,
      serviceType: linked.service?.serviceType ?? null,
      partsReplaced: linked.service?.partsReplaced?.slice(0, 300) ?? null,
      partsAmount: linked.service?.partsAmount ?? null,
      labourAmount: linked.service?.labourAmount ?? null,
      warrantyUntil: linked.service?.warrantyUntil
        ? new Date(`${linked.service.warrantyUntil}T00:00:00.000Z`)
        : null,
      provider: linked.service?.provider?.slice(0, 80) ?? null,
    };
    const where = { source_sourceId: { source: linked.source, sourceId: linked.sourceId } };
    const existing = await tx.expense.findUnique({ where, select: { id: true } });
    if (!existing) {
      const created = await tx.expense.create({
        data: { ...data, userId: linked.userId, source: linked.source, sourceId: linked.sourceId },
      });
      this.logger.log(`Expense ${created.id} created from ${linked.source} ${linked.sourceId}`);
      return;
    }
    // Money already refunded against it can't exceed what was paid, or predate it.
    const { _sum, _min } = await tx.expense.aggregate({
      where: { refundOfId: existing.id, kind: ExpenseKind.REFUND },
      _sum: { amount: true },
      _min: { date: true },
    });
    if (_sum.amount?.greaterThan(linked.amount)) {
      throw new ConflictException(
        `${rupees.format(_sum.amount.toNumber())} of its expense was refunded; the amount can't go below it.`,
      );
    }
    if (_min.date && data.date > _min.date) {
      throw new ConflictException(
        "Its expense has a refund dated earlier. Change or delete that refund in Expenses first.",
      );
    }
    await tx.expense.update({ where: { id: existing.id }, data });
    // Refunds follow their expense to its vehicle and category.
    await tx.expense.updateMany({
      where: { refundOfId: existing.id },
      data: { vehicleId: data.vehicleId, categoryId, subcategoryId: data.subcategoryId },
    });
    this.logger.log(`Expense ${existing.id} updated from ${linked.source} ${linked.sourceId}`);
  }

  /** The expense of each record that has one, by record id (for links back from the record). */
  async expenseIdsFor(
    db: Prisma.TransactionClient,
    source: LinkedExpense["source"],
    sourceIds: string[],
  ): Promise<Map<string, string>> {
    const rows = await db.expense.findMany({
      where: { source, sourceId: { in: sourceIds } },
      select: { id: true, sourceId: true },
    });
    return new Map(rows.map((row) => [row.sourceId!, row.id]));
  }

  /** What was paid for each record that has an expense, its refunds subtracted, by record id. */
  async netBySource(
    db: Prisma.TransactionClient,
    source: LinkedExpense["source"],
    sourceIds: string[],
  ): Promise<Map<string, Prisma.Decimal>> {
    if (!sourceIds.length) return new Map();
    const rows = await db.expense.findMany({
      where: { source, sourceId: { in: sourceIds }, kind: ExpenseKind.EXPENSE },
      select: { sourceId: true, amount: true, refunds: { select: { amount: true } } },
    });
    return new Map(
      rows.map((row) => [
        row.sourceId!,
        row.refunds.reduce((net, refund) => net.minus(refund.amount), row.amount),
      ]),
    );
  }

  /** Removes the record's expense (and its refunds). Nothing to remove is fine. */
  async remove(
    tx: Prisma.TransactionClient,
    source: LinkedExpense["source"],
    sourceId: string,
  ): Promise<void> {
    const { count } = await tx.expense.deleteMany({ where: { source, sourceId } });
    if (count === 0) this.logger.warn(`No ${source} expense to remove for ${sourceId}`);
    else this.logger.log(`Expense from ${source} ${sourceId} deleted`);
  }
}
