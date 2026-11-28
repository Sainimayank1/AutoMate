import {
  CostClass,
  createExpenseSchema,
  type CreateExpenseValues,
  type ExpenseImportPreview,
  type ExpenseImportResult,
  type ExpenseImportRow,
  type ExpenseImportValues,
  FUEL_CATEGORY_KEY,
  IMPORT_MAX_ROWS,
  IMPORT_PREVIEW_ROWS,
  type ImportRowStatus,
  istToday,
  parseCsv,
} from "@automate/shared";
import { BadRequestException, Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "@/database/prisma.service";
import { VehiclesService } from "@/modules/vehicles/vehicles.service";

import {
  isLinkedSource,
  parseAmount,
  parseDate,
  parsePayment,
  type RawRow,
  readRows,
} from "./expense-import";
import { ExpensesService } from "./expenses.service";

type Evaluated = { row: ExpenseImportRow; input?: CreateExpenseValues };
const csvError = (message: string) =>
  new BadRequestException({ message, details: [{ field: "csv", message }] });

/**
 * CSV import (Expenses phase 8, docs/architecture/expenses.md §10). Every row is checked like a
 * manual expense; rows from other modules, refunds, fuel and loan payments aren't imported, and
 * rows like ones already recorded wait for the user's say-so. The commit is one transaction.
 */
@Injectable()
export class ExpenseImportService {
  private readonly logger = new Logger(ExpenseImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicles: VehiclesService,
    private readonly expenses: ExpensesService,
  ) {}

  async preview(userId: string, values: ExpenseImportValues): Promise<ExpenseImportPreview> {
    const evaluated = await this.evaluate(userId, values);
    const counts: Record<ImportRowStatus, number> = {
      ready: 0,
      duplicate: 0,
      skipped: 0,
      error: 0,
    };
    for (const { row } of evaluated) counts[row.status]++;
    const problems = evaluated.filter(({ row }) => row.status !== "ready");
    const ready = evaluated.filter(({ row }) => row.status === "ready");
    return {
      counts,
      rows: [...problems.slice(0, IMPORT_PREVIEW_ROWS), ...ready.slice(0, 5)].map(({ row }) => row),
    };
  }

  async commit(userId: string, values: ExpenseImportValues): Promise<ExpenseImportResult> {
    const evaluated = await this.evaluate(userId, values);
    const chosen = evaluated.filter(
      ({ row }) =>
        row.status === "ready" || (values.includeDuplicates && row.status === "duplicate"),
    );
    await this.prisma.$transaction(
      async (tx) => {
        for (const { input } of chosen) await this.expenses.createImported(tx, userId, input!);
      },
      // Up to IMPORT_MAX_ROWS checked writes.
      { timeout: 60_000 },
    );
    this.logger.log(`Imported ${chosen.length} expenses into vehicle ${values.vehicleId}`);
    return { imported: chosen.length, notImported: evaluated.length - chosen.length };
  }

  private async evaluate(userId: string, { vehicleId, csv }: ExpenseImportValues) {
    await this.vehicles.findOwned(userId, vehicleId);
    const table = parseCsv(csv);
    const read = readRows(table);
    if (!Array.isArray(read)) {
      throw csvError(`The file needs these columns: ${read.missing.join(", ")}.`);
    }
    if (!read.length) throw csvError("The file has no expenses under its header.");
    if (read.length > IMPORT_MAX_ROWS) {
      throw csvError(
        `Import up to ${IMPORT_MAX_ROWS} rows at a time; this file has ${read.length}.`,
      );
    }

    const categories = await this.prisma.expenseCategory.findMany({
      where: { OR: [{ userId: null }, { userId }] },
    });
    const tops = categories.filter((category) => !category.parentId);
    const findTop = (name: string) =>
      tops.find(
        (category) =>
          category.name.toLowerCase() === name.toLowerCase() ||
          category.key?.toLowerCase() === name.toLowerCase(),
      );
    const findSub = (parentId: string, name: string) =>
      categories.find(
        (category) =>
          category.parentId === parentId && category.name.toLowerCase() === name.toLowerCase(),
      );

    const today = istToday(new Date());
    const evaluated = read.map((raw) => this.check(raw, vehicleId, today, findTop, findSub));

    // Alike in date, amount and category: one already recorded, or earlier in the file.
    const candidates = evaluated.filter(({ row }) => row.status === "ready");
    const dates = candidates.map(({ input }) => input!.date).sort();
    const existing = dates.length
      ? await this.prisma.expense.findMany({
          where: {
            userId,
            vehicleId,
            kind: "EXPENSE",
            date: { gte: new Date(dates[0]!), lte: new Date(dates.at(-1)!) },
          },
          select: { date: true, amount: true, categoryId: true },
        })
      : [];
    const key = (date: string, amount: string, categoryId: string) =>
      `${date}|${Number(amount).toFixed(2)}|${categoryId}`;
    const seen = new Set(
      existing.map((row) =>
        key(row.date.toISOString().slice(0, 10), row.amount.toFixed(2), row.categoryId),
      ),
    );
    for (const item of candidates) {
      const { date, amount, categoryId } = item.input!;
      const id = key(date, amount, categoryId);
      if (seen.has(id)) {
        item.row.status = "duplicate";
        item.row.message =
          "Looks like an expense already recorded (same day, amount and category).";
      }
      seen.add(id);
    }
    return evaluated;
  }

  private check(
    raw: RawRow,
    vehicleId: string,
    today: string,
    findTop: (
      name: string,
    ) =>
      { id: string; key: string | null; costClass: CostClass | null; active: boolean } | undefined,
    findSub: (parentId: string, name: string) => { id: string; active: boolean } | undefined,
  ): Evaluated {
    const row: ExpenseImportRow = {
      line: raw.line,
      date: parseDate(raw.date),
      title: raw.title,
      amount: null,
      category: raw.category || null,
      status: "error",
      message: null,
    };
    const fail = (message: string, status: ImportRowStatus = "error"): Evaluated => ({
      row: { ...row, status, message },
    });
    if (isLinkedSource(raw.source)) {
      return fail(`From ${raw.source}: it's linked there, so it isn't imported again.`, "skipped");
    }
    const amount = parseAmount(raw.amount);
    if (amount === "refund") {
      return fail("Refunds aren't imported: record them on their expense.", "skipped");
    }
    if (!amount) return fail("Enter the amount, e.g. 850.");
    row.amount = amount.amount;
    if (!row.date) return fail("Enter the date as DD/MM/YYYY or YYYY-MM-DD.");
    if (row.date > today) return fail("This date is in the future.");
    const category = findTop(raw.category);
    if (!category) return fail(`No category called "${raw.category}".`);
    if (!category.active) return fail(`The category "${raw.category}" is disabled.`);
    if (category.key === FUEL_CATEGORY_KEY) {
      return fail("Fuel comes from fill-ups: log them in Fuel.", "skipped");
    }
    if (category.costClass === CostClass.FINANCING) {
      return fail("Loan payments need their principal and interest: add them by hand.", "skipped");
    }
    let subcategoryId: string | null = null;
    if (raw.subcategory) {
      const sub = findSub(category.id, raw.subcategory);
      if (!sub || !sub.active) return fail(`No subcategory "${raw.subcategory}" under it.`);
      subcategoryId = sub.id;
    }
    const payment = parsePayment(raw.payment);
    if (payment === "unknown") return fail(`Unknown payment method "${raw.payment}".`);

    const parsed = createExpenseSchema.safeParse({
      allocation: { mode: "single", vehicleId },
      date: row.date,
      title: raw.title,
      amount: amount.amount,
      categoryId: category.id,
      subcategoryId,
      paymentMethod: payment,
      vendor: raw.vendor,
      notes: raw.notes,
    });
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "This row isn't valid.");
    return { row: { ...row, status: "ready" }, input: parsed.data };
  }
}
