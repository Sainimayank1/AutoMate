import { randomUUID } from "node:crypto";

import {
  type BulkResult,
  CostClass,
  createExpenseSchema,
  type CreateExpenseValues,
  type CreateRefundValues,
  type DateWindow,
  type Expense,
  type ExpenseDetail,
  type ExpenseIcon,
  ExpenseKind,
  type ExpenseListQuery,
  ExpenseSort,
  ExpenseSource,
  type ExpenseSummary,
  type ExpenseSummaryQuery,
  LINKED_EXPENSE_SOURCES,
  pageMeta,
  splitEqually,
  toPaise,
  type UpdateExpenseValues,
} from "@automate/shared";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ZodValidationException } from "nestjs-zod";

import { pageArgs, Paginated } from "@/common/pagination/paginated";
import { PrismaService } from "@/database/prisma.service";
import { type Expense as ExpenseRow, Prisma } from "@/generated/prisma/client";
import { VehiclesService } from "@/modules/vehicles/vehicles.service";

import { ExpenseCategoriesService } from "./expense-categories.service";
import { ExpenseFiguresService } from "./expense-figures.service";
import { type MonthTotal, overviewPeriods, summarizeExpenses } from "./expense-summary";
import { type ExpenseWithCategories, toDbDate, toExpense, toExpenseInput } from "./expenses.mapper";

const NOT_FOUND = "Expense not found";
const INCLUDE = { category: true, subcategory: true } as const;
const SOURCE_NAMES: Partial<Record<ExpenseSource, string>> = {
  [ExpenseSource.FUEL]: "Fuel",
  [ExpenseSource.MAINTENANCE]: "Maintenance",
  [ExpenseSource.TRIP]: "Trips",
};

const ORDER: Record<ExpenseSort, Prisma.ExpenseOrderByWithRelationInput[]> = {
  [ExpenseSort.DATE_DESC]: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
  [ExpenseSort.DATE_ASC]: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  [ExpenseSort.AMOUNT_DESC]: [{ amount: "desc" }, { date: "desc" }, { id: "desc" }],
  [ExpenseSort.AMOUNT_ASC]: [{ amount: "asc" }, { date: "desc" }, { id: "asc" }],
};

const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
const fieldError = (field: string, message: string) => ({ message, details: [{ field, message }] });

type Share = { vehicleId: string; amount: string };

/**
 * Owns `expenses`. Every query is scoped by `userId`; vehicles come from `VehiclesService`
 * (owned, locked for writes, archived ones read-only) and categories from
 * `ExpenseCategoriesService`. Rows from other modules (Fuel, …) are read-only here.
 * Money rules: docs/architecture/expenses.md.
 */
@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicles: VehiclesService,
    private readonly categories: ExpenseCategoriesService,
    private readonly figures: ExpenseFiguresService,
  ) {}

  async list(userId: string, query: ExpenseListQuery): Promise<Paginated<Expense>> {
    const where = listWhere(userId, query);
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.expense.count({ where }),
      this.prisma.expense.findMany({
        where,
        include: INCLUDE,
        orderBy: ORDER[query.sort],
        ...pageArgs(query),
      }),
    ]);
    return new Paginated(await this.present(rows), pageMeta(query, total));
  }

  /**
   * The Overview figures for the current IST month and year: two grouped queries (totals by month,
   * vehicle and category; odometer readings by vehicle), then `summarizeExpenses`.
   */
  async summary(userId: string, { vehicleId }: ExpenseSummaryQuery): Promise<ExpenseSummary> {
    if (vehicleId) await this.vehicles.findOwned(userId, vehicleId);
    const now = new Date(); // one clock for the queries and the figures (month boundaries)
    const period = overviewPeriods(now);
    const vehicle = vehicleId ? Prisma.sql`AND e.vehicle_id = ${vehicleId}::uuid` : Prisma.empty;
    const [totals, readings, [lastMonthSoFar]] = await Promise.all([
      this.prisma.$queryRaw<
        {
          month: string;
          vehicle_id: string;
          category_id: string;
          cost_class: MonthTotal["costClass"];
          kind: MonthTotal["kind"];
          total: Prisma.Decimal;
        }[]
      >`
        SELECT to_char(e.date, 'YYYY-MM') AS month, e.vehicle_id, e.category_id, c.cost_class, e.kind,
               sum(e.amount) AS total
        FROM expenses e
        JOIN expense_categories c ON c.id = e.category_id
        WHERE e.user_id = ${userId}::uuid AND e.date >= ${period.from}::date AND e.date <= ${period.to}::date
        ${vehicle}
        GROUP BY 1, 2, 3, 4, 5`,
      this.figures.readings(userId, { from: period.yearStart, to: period.to }, vehicleId),
      this.prisma.$queryRaw<{ total: Prisma.Decimal }[]>`
        SELECT coalesce(sum(CASE WHEN e.kind = 'REFUND' THEN -e.amount ELSE e.amount END), 0) AS total
        FROM expenses e
        JOIN expense_categories c ON c.id = e.category_id
        WHERE e.user_id = ${userId}::uuid AND c.cost_class = 'OPERATING'
          AND e.date >= ${period.lastMonthWindow.from}::date
          AND e.date <= ${period.lastMonthWindow.to}::date
        ${vehicle}`,
    ]);
    const summary = summarizeExpenses(
      totals.map((row) => ({
        month: row.month,
        vehicleId: row.vehicle_id,
        categoryId: row.category_id,
        costClass: row.cost_class,
        kind: row.kind,
        total: new Prisma.Decimal(row.total),
      })),
      readings,
      now,
      new Prisma.Decimal(lastMonthSoFar!.total),
    );
    const categories = await this.prisma.expenseCategory.findMany({
      where: { id: { in: summary.categories.map((item) => item.categoryId) } },
    });
    // Shares of the categories shown, so they add up to 100 % even when a refund nets another to zero.
    const total = summary.categories.reduce(
      (sum, item) => sum.plus(item.amount),
      new Prisma.Decimal(0),
    );
    return {
      ...summary,
      categories: summary.categories.flatMap(({ categoryId, amount }) => {
        const row = categories.find((category) => category.id === categoryId);
        return row
          ? [
              {
                category: {
                  id: row.id,
                  key: row.key,
                  name: row.name,
                  icon: row.icon as ExpenseIcon,
                  costClass: row.costClass!,
                },
                amount: amount.toFixed(2),
                percent: amount.div(total).times(100).toDecimalPlaces(1).toNumber(),
              },
            ]
          : [];
      }),
    };
  }

  /**
   * Net spending (refunds subtracted) of one vehicle in system categories, by IST month and
   * top-level category key. For modules that report their own money (Maintenance), so their
   * figures are always the ones Expenses shows. The caller checks the vehicle is the user's.
   */
  async spendByMonth(
    userId: string,
    vehicleId: string,
    window: DateWindow,
    categoryKeys: string[],
  ): Promise<{ month: string; categoryKey: string; total: Prisma.Decimal }[]> {
    const rows = await this.prisma.$queryRaw<
      { month: string; category_key: string; total: Prisma.Decimal }[]
    >`
      SELECT to_char(e.date, 'YYYY-MM') AS month, c.key AS category_key,
             sum(CASE WHEN e.kind = 'REFUND' THEN -e.amount ELSE e.amount END) AS total
      FROM expenses e
      JOIN expense_categories c ON c.id = e.category_id
      WHERE e.user_id = ${userId}::uuid AND e.vehicle_id = ${vehicleId}::uuid
        AND e.date >= ${window.from}::date AND e.date <= ${window.to}::date
        AND c.key IN (${Prisma.join(categoryKeys)})
      GROUP BY 1, 2`;
    return rows.map((row) => ({
      month: row.month,
      categoryKey: row.category_key,
      total: new Prisma.Decimal(row.total),
    }));
  }

  async get(userId: string, id: string): Promise<ExpenseDetail> {
    const row = await this.prisma.expense.findFirst({ where: { id, userId }, include: INCLUDE });
    if (!row) throw new NotFoundException(NOT_FOUND);
    const [refunds, group] = await Promise.all([
      this.prisma.expense.findMany({
        where: { refundOfId: id, userId },
        include: INCLUDE,
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      }),
      row.sharedGroupId
        ? this.prisma.expense.findMany({
            where: { sharedGroupId: row.sharedGroupId, userId },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          })
        : Promise.resolve([]),
    ]);
    const [expense] = await this.present([row]);
    return {
      ...expense!,
      refunds: await this.present(refunds),
      group: group.map((item) => ({
        expenseId: item.id,
        vehicleId: item.vehicleId,
        amount: item.amount.toFixed(2),
      })),
    };
  }

  async create(userId: string, input: CreateExpenseValues): Promise<ExpenseDetail> {
    // A retried save (same client id) gets the expense it already created, not a second one.
    if (input.id && (await this.prisma.expense.count({ where: { id: input.id, userId } }))) {
      return this.get(userId, input.id);
    }
    const id = await this.prisma.$transaction((tx) =>
      this.write(tx, userId, input, [], { newId: input.id, categoryChanged: true }),
    );
    this.logger.log(`Expense ${id} created`);
    return this.get(userId, id);
  }

  /** The edit is merged onto the stored record (and its shared group) and re-checked whole. */
  async update(userId: string, id: string, input: UpdateExpenseValues): Promise<ExpenseDetail> {
    const resultId = await this.prisma.$transaction(async (tx) => {
      const { current, group } = await this.lockedGroup(tx, userId, id);
      assertEditable(current);
      if (current.kind === ExpenseKind.REFUND) {
        throw new ConflictException("A refund can't be edited. Delete it and record it again.");
      }
      const changes = Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined),
      );
      // A reading belongs to its vehicle: moving the expense doesn't carry it to another one.
      const target = (changes as UpdateExpenseValues).allocation;
      if (
        target?.mode === "single" &&
        target.vehicleId !== current.vehicleId &&
        changes.odometerKm === undefined
      ) {
        changes.odometerKm = null;
      }
      const parsed = createExpenseSchema.safeParse({
        ...toExpenseInput(current, group),
        ...changes,
      });
      if (!parsed.success) throw new ZodValidationException(parsed.error);
      const categoryChanged =
        parsed.data.categoryId !== current.categoryId ||
        (parsed.data.subcategoryId ?? null) !== current.subcategoryId;
      return this.write(tx, userId, parsed.data, group, { keepId: id, categoryChanged });
    });
    this.logger.log(`Expense ${id} updated`);
    return this.get(userId, resultId);
  }

  /** A shared expense is deleted with its whole group; refunds go with what they refund. */
  async remove(userId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const { current, group } = await this.lockedGroup(tx, userId, id);
      assertEditable(current);
      await tx.expense.deleteMany({ where: { id: { in: group.map((row) => row.id) }, userId } });
    });
    this.logger.log(`Expense ${id} deleted`);
  }

  /** A refund is its own row: the original stays, net spending drops by the refunded amount. */
  async refund(userId: string, id: string, input: CreateRefundValues): Promise<ExpenseDetail> {
    await this.prisma.$transaction(async (tx) => {
      const { current } = await this.lockedGroup(tx, userId, id);
      const original = { ...current, category: await this.categoryOf(tx, current.categoryId) };
      if (original.kind === ExpenseKind.REFUND) {
        throw new BadRequestException("A refund can't be refunded");
      }
      if (original.category.costClass === CostClass.FINANCING) {
        throw new ConflictException(
          "Loan payments can't be refunded. Correct the payment instead.",
        );
      }
      if (toDbDate(input.date) < original.date) {
        throw new BadRequestException(
          fieldError("date", "A refund can't be dated before the expense"),
        );
      }
      const refunded = (await this.refundedTotals(tx, [id])).get(id)?.amount ?? 0;
      const remaining = original.amount.minus(refunded);
      if (remaining.lessThan(input.amount)) {
        throw new BadRequestException(
          fieldError(
            "amount",
            `Up to ${rupees.format(remaining.toNumber())} can still be refunded`,
          ),
        );
      }
      await tx.expense.create({
        data: {
          userId,
          vehicleId: original.vehicleId,
          kind: ExpenseKind.REFUND,
          refundOfId: original.id,
          refundReason: input.reason,
          title: `Refund · ${original.title}`.slice(0, 120),
          amount: input.amount,
          date: toDbDate(input.date),
          categoryId: original.categoryId,
          subcategoryId: original.subcategoryId,
          paymentMethod: original.paymentMethod,
          notes: input.notes ?? null,
        },
      });
    });
    this.logger.log(`Expense ${id} refunded`);
    return this.get(userId, id);
  }

  /** Deletes what it may (whole shared groups); linked rows and archived vehicles are skipped. */
  async bulkDelete(userId: string, ids: string[]): Promise<BulkResult> {
    const result = await this.prisma.$transaction(async (tx) => {
      const { rows, skipped } = await this.bulkTargets(tx, userId, ids, () => true);
      if (!rows.length) return { affected: 0, skipped };
      const { count } = await tx.expense.deleteMany({
        where: { id: { in: rows.map((row) => row.id) }, userId },
      });
      return { affected: count, skipped };
    });
    this.logger.log(`Bulk delete: ${result.affected} expenses`);
    return result;
  }

  /** Moves expenses (with their shared group and refunds) to another category. */
  async bulkRecategorise(
    userId: string,
    {
      ids,
      categoryId,
      subcategoryId,
    }: { ids: string[]; categoryId: string; subcategoryId?: string | null },
  ): Promise<BulkResult> {
    const result = await this.prisma.$transaction(async (tx) => {
      const target = await this.categories.resolve(userId, categoryId, subcategoryId, {
        requireActive: true,
        db: tx,
      });
      if (target.costClass === CostClass.FINANCING) {
        throw new BadRequestException(
          fieldError("categoryId", "Loan payments need their split: move them one at a time"),
        );
      }
      const { rows, skipped } = await this.bulkTargets(
        tx,
        userId,
        ids,
        (row) => row.kind === ExpenseKind.EXPENSE && row.category.costClass !== CostClass.FINANCING,
      );
      if (!rows.length) return { affected: 0, skipped };
      const data = { categoryId, subcategoryId: subcategoryId ?? null };
      const { count } = await tx.expense.updateMany({
        where: { id: { in: rows.map((row) => row.id) } },
        data,
      });
      await tx.expense.updateMany({
        where: { refundOfId: { in: rows.map((row) => row.id) } },
        data,
      });
      return { affected: count, skipped };
    });
    this.logger.log(`Bulk category change: ${result.affected} expenses`);
    return result;
  }

  // ---------------------------------------------------------------- internals

  /**
   * Writes an expense as one row per vehicle (a shared expense is several rows with one group id).
   * Existing rows are reused where possible, so an edit keeps ids and refunds stay attached.
   */
  private async write(
    tx: Prisma.TransactionClient,
    userId: string,
    values: CreateExpenseValues,
    existing: ExpenseRow[],
    {
      newId,
      keepId,
      categoryChanged,
    }: { newId?: string; keepId?: string; categoryChanged: boolean },
  ): Promise<string> {
    const { costClass } = await this.categories.resolve(
      userId,
      values.categoryId,
      values.subcategoryId,
      {
        requireActive: categoryChanged,
        db: tx,
      },
    );
    const shares = sharesOf(values);
    const shared = shares.length > 1;
    assertWritable(values, costClass, shares);
    await this.lockVehicles(
      userId,
      [...shares.map((share) => share.vehicleId), ...existing.map((row) => row.vehicleId)],
      tx,
    );
    const ownIds = existing.map((row) => row.id);
    if (!shared && values.odometerKm != null) {
      await assertOdometerInOrder(
        tx,
        shares[0]!.vehicleId,
        toDbDate(values.date),
        values.odometerKm,
        ownIds,
      );
    }

    const data = rowData(values, costClass, shared);
    const groupId = shared
      ? (existing.find((row) => row.sharedGroupId)?.sharedGroupId ?? randomUUID())
      : null;
    // Same vehicle first, then any row left over: moving an expense keeps its id.
    const pool = [...existing];
    const takeFor = (vehicleId: string) => {
      const index = pool.findIndex((row) => row.vehicleId === vehicleId);
      return index >= 0 ? pool.splice(index, 1)[0] : undefined;
    };
    const plan = shares.map((share) => ({ share, row: takeFor(share.vehicleId) }));
    for (const item of plan) item.row ??= pool.shift();

    const refunded = await this.refundedTotals(tx, ownIds);
    for (const row of existing) {
      const refunds = refunded.get(row.id);
      if (!refunds) continue;
      if (costClass === CostClass.FINANCING) {
        throw new ConflictException(
          fieldError("categoryId", "It has refunds, and loan payments can't. Delete them first."),
        );
      }
      if (data.date > refunds.firstDate) {
        throw new ConflictException(
          fieldError("date", "It has a refund dated earlier. Change or delete the refund first."),
        );
      }
    }
    const ids: string[] = [];
    for (const { share, row } of plan) {
      const fields = {
        ...data,
        vehicleId: share.vehicleId,
        amount: share.amount,
        sharedGroupId: groupId,
      };
      if (row) {
        const already = refunded.get(row.id)?.amount;
        if (already?.greaterThan(share.amount)) {
          throw new ConflictException(
            fieldError(
              "amount",
              `${rupees.format(already.toNumber())} was refunded; the amount can't go below it`,
            ),
          );
        }
        await tx.expense.update({ where: { id: row.id }, data: fields });
        // Refunds follow their expense to its vehicle and category.
        await tx.expense.updateMany({
          where: { refundOfId: row.id },
          data: {
            vehicleId: share.vehicleId,
            categoryId: data.categoryId,
            subcategoryId: data.subcategoryId,
          },
        });
        ids.push(row.id);
      } else {
        const created = await tx.expense.create({
          data: { ...fields, id: ids.length === 0 ? newId : undefined, userId },
        });
        ids.push(created.id);
      }
    }
    // Vehicles removed from a shared expense.
    for (const row of pool) {
      if (refunded.has(row.id)) {
        throw new ConflictException(
          fieldError(
            "allocation",
            "A vehicle you removed has refunds on its share. Delete them first.",
          ),
        );
      }
      await tx.expense.delete({ where: { id: row.id } });
    }
    if (!shared && values.odometerKm != null) {
      await this.vehicles.raiseOdometer(shares[0]!.vehicleId, values.odometerKm, tx);
    }
    // A lowered, removed or moved reading mustn't leave its vehicle at it (as Fuel does on edit).
    for (const row of existing) {
      const kept =
        !shared &&
        shares[0]!.vehicleId === row.vehicleId &&
        (values.odometerKm ?? 0) >= (row.odometerKm ?? 0);
      if (row.odometerKm == null || kept) continue;
      const { _max } = await tx.expense.aggregate({
        where: { vehicleId: row.vehicleId, odometerKm: { not: null } },
        _max: { odometerKm: true },
      });
      if (_max.odometerKm != null) {
        await this.vehicles.correctOdometer(row.vehicleId, row.odometerKm, _max.odometerKm, tx);
      }
    }
    return keepId && ids.includes(keepId) ? keepId : ids[0]!;
  }

  /** Locks each vehicle in id order (no deadlocks); archived vehicles are read-only. */
  private async lockVehicles(userId: string, ids: string[], tx: Prisma.TransactionClient) {
    for (const id of [...new Set(ids)].sort()) {
      const vehicle = await this.vehicles.lockOwned(userId, id, tx);
      if (vehicle.archivedAt) {
        throw new ConflictException(
          `${vehicle.make} ${vehicle.model} is archived. Restore it to change its expenses.`,
        );
      }
    }
  }

  /**
   * The expense and its shared group, read after locking their vehicles: every writer of expense
   * rows holds the vehicle lock, so what's read can't change before this transaction ends.
   */
  private async lockedGroup(tx: Prisma.TransactionClient, userId: string, id: string) {
    const read = async () => {
      const current = await tx.expense.findFirst({ where: { id, userId } });
      if (!current) throw new NotFoundException(NOT_FOUND);
      const group = current.sharedGroupId
        ? await tx.expense.findMany({
            where: { sharedGroupId: current.sharedGroupId, userId },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          })
        : [current];
      return { current, group };
    };
    const before = await read();
    const vehicles = (rows: ExpenseRow[]) => [...new Set(rows.map((row) => row.vehicleId))].sort();
    await this.lockVehicles(userId, vehicles(before.group), tx);
    const after = await read();
    if (vehicles(after.group).join() !== vehicles(before.group).join()) {
      throw new ConflictException("This expense just changed. Reload it and try again.");
    }
    return after;
  }

  private async categoryOf(tx: Prisma.TransactionClient, id: string) {
    return tx.expenseCategory.findUniqueOrThrow({ where: { id } });
  }

  /**
   * What a bulk action acts on: the allowed rows with their whole shared groups (a shared expense
   * acts as one), skipping rows from other modules and any group with an archived vehicle; every
   * vehicle involved is locked.
   */
  private async bulkTargets(
    tx: Prisma.TransactionClient,
    userId: string,
    ids: string[],
    allowed: (row: ExpenseWithCategories) => boolean,
  ) {
    const picked = (
      await tx.expense.findMany({ where: { id: { in: ids }, userId }, include: INCLUDE })
    ).filter((row) => !LINKED_EXPENSE_SOURCES.includes(row.source) && allowed(row));
    const groups = picked.flatMap((row) => (row.sharedGroupId ? [row.sharedGroupId] : []));
    const expanded = await tx.expense.findMany({
      where: {
        userId,
        OR: [{ id: { in: picked.map((row) => row.id) } }, { sharedGroupId: { in: groups } }],
      },
      include: { vehicle: { select: { archivedAt: true } } },
    });
    const unit = (row: ExpenseRow) => row.sharedGroupId ?? row.id;
    const blocked = new Set(expanded.filter((row) => row.vehicle.archivedAt).map(unit));
    const rows = expanded.filter((row) => !blocked.has(unit(row)));
    await this.lockVehicles(
      userId,
      rows.map((row) => row.vehicleId),
      tx,
    );
    const done = new Set(rows.map((row) => row.id));
    return { rows, skipped: ids.filter((id) => !done.has(id)).length };
  }

  /** Refunded so far per expense, and the earliest refund's date. */
  private async refundedTotals(db: Prisma.TransactionClient | PrismaService, ids: string[]) {
    if (!ids.length) return new Map<string, { amount: Prisma.Decimal; firstDate: Date }>();
    const sums = await db.expense.groupBy({
      by: ["refundOfId"],
      where: { refundOfId: { in: ids } },
      _sum: { amount: true },
      _min: { date: true },
    });
    return new Map(
      sums.map((sum) => [sum.refundOfId!, { amount: sum._sum.amount!, firstDate: sum._min.date! }]),
    );
  }

  /** Rows with what the list shows next to them: refunded so far and shared totals (no N+1). */
  private async present(rows: ExpenseWithCategories[]): Promise<Expense[]> {
    const groupIds = [
      ...new Set(rows.flatMap((row) => (row.sharedGroupId ? [row.sharedGroupId] : []))),
    ];
    const [refunded, groups] = await Promise.all([
      this.refundedTotals(
        this.prisma,
        rows.map((row) => row.id),
      ),
      groupIds.length
        ? this.prisma.expense.groupBy({
            by: ["sharedGroupId"],
            where: { sharedGroupId: { in: groupIds } },
            _sum: { amount: true },
            _count: true,
          })
        : Promise.resolve([]),
    ]);
    const shared = new Map(
      groups.map((group) => [
        group.sharedGroupId!,
        { total: group._sum.amount!, count: group._count },
      ]),
    );
    return rows.map((row) =>
      toExpense(row, {
        refunded: refunded.get(row.id)?.amount,
        shared: row.sharedGroupId ? shared.get(row.sharedGroupId) : undefined,
      }),
    );
  }
}

// ---------------------------------------------------------------- rules

const km = new Intl.NumberFormat("en-IN");
const day = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "UTC" });

/**
 * One odometer history per vehicle (fill-ups included, through their expenses): a reading can't be
 * below one from an earlier day or above one from a later day. Same-day readings aren't ordered.
 */
async function assertOdometerInOrder(
  tx: Prisma.TransactionClient,
  vehicleId: string,
  date: Date,
  odometerKm: number,
  exceptIds: string[],
) {
  const others = { vehicleId, odometerKm: { not: null }, id: { notIn: exceptIds } };
  const [before, after] = await Promise.all([
    tx.expense.findFirst({
      where: { ...others, date: { lt: date } },
      orderBy: [{ odometerKm: "desc" }],
    }),
    tx.expense.findFirst({
      where: { ...others, date: { gt: date } },
      orderBy: [{ odometerKm: "asc" }],
    }),
  ]);
  const clash =
    before && odometerKm < before.odometerKm!
      ? `Lower than ${km.format(before.odometerKm!)} km, recorded on ${day.format(before.date)}. Check the reading or the date.`
      : after && odometerKm > after.odometerKm!
        ? `Higher than ${km.format(after.odometerKm!)} km, recorded later on ${day.format(after.date)}. Check the reading or the date.`
        : null;
  if (clash) {
    throw new ConflictException({
      message: "This odometer reading is out of order with your other records.",
      details: [{ field: "odometerKm", message: clash }],
    });
  }
}

function assertEditable(row: ExpenseRow) {
  if (LINKED_EXPENSE_SOURCES.includes(row.source)) {
    throw new ConflictException(
      `This expense comes from ${SOURCE_NAMES[row.source] ?? "another module"}. Edit it there.`,
    );
  }
}

/** Each vehicle's share: the whole amount, an equal split (exact to the paisa) or custom shares. */
function sharesOf({ allocation, amount }: CreateExpenseValues): Share[] {
  if (allocation.mode === "single") return [{ vehicleId: allocation.vehicleId, amount }];
  const equal = splitEqually(amount, allocation.vehicles.length);
  return allocation.vehicles.map((item, index) => ({
    vehicleId: item.vehicleId,
    amount: allocation.split === "equal" ? equal[index]! : item.amount!,
  }));
}

function assertWritable(values: CreateExpenseValues, costClass: CostClass, shares: Share[]) {
  const shared = shares.length > 1;
  if (shared && shares.some((share) => toPaise(share.amount) === 0)) {
    throw new BadRequestException(
      fieldError("amount", "Too small to share between these vehicles"),
    );
  }
  if (shared && costClass === CostClass.FINANCING) {
    throw new BadRequestException(
      fieldError("allocation", "A loan payment belongs to one vehicle"),
    );
  }
  if (shared && values.odometerKm != null) {
    throw new BadRequestException(
      fieldError(
        "odometerKm",
        "An odometer reading belongs to one vehicle; leave it out when sharing",
      ),
    );
  }
  if (shared && (values.partsAmount || values.labourAmount)) {
    throw new BadRequestException(
      fieldError("labourAmount", "Parts and labour costs apply to a single-vehicle expense"),
    );
  }
  const parts = [values.principalAmount, values.interestAmount, values.chargesAmount];
  if (costClass === CostClass.FINANCING && !parts.some(Boolean)) {
    throw new BadRequestException(
      fieldError("principalAmount", "Split the payment into principal, interest and charges"),
    );
  }
  if (costClass !== CostClass.FINANCING && parts.some(Boolean)) {
    throw new BadRequestException(
      fieldError("principalAmount", "Only loan payments have a principal and interest split"),
    );
  }
}

/** The columns every row of the expense shares. Loan fields exist only for Finance. */
function rowData(values: CreateExpenseValues, costClass: CostClass, shared: boolean) {
  const finance = costClass === CostClass.FINANCING;
  const day = (value: string | null | undefined) => (value ? toDbDate(value) : null);
  return {
    title: values.title,
    date: toDbDate(values.date),
    categoryId: values.categoryId,
    subcategoryId: values.subcategoryId ?? null,
    paymentMethod: values.paymentMethod ?? null,
    vendor: values.vendor ?? null,
    odometerKm: shared ? null : (values.odometerKm ?? null),
    description: values.description ?? null,
    notes: values.notes ?? null,
    principalAmount: finance ? (values.principalAmount ?? null) : null,
    interestAmount: finance ? (values.interestAmount ?? null) : null,
    chargesAmount: finance ? (values.chargesAmount ?? null) : null,
    loanReference: finance ? (values.loanReference ?? null) : null,
    loanOutstanding: finance ? (values.loanOutstanding ?? null) : null,
    serviceType: values.serviceType ?? null,
    partsReplaced: values.partsReplaced ?? null,
    partsAmount: values.partsAmount ?? null,
    labourAmount: values.labourAmount ?? null,
    warrantyUntil: day(values.warrantyUntil),
    provider: values.provider ?? null,
    policyNumber: values.policyNumber ?? null,
    policyStart: day(values.policyStart),
    policyEnd: day(values.policyEnd),
  };
}

function listWhere(userId: string, query: ExpenseListQuery): Prisma.ExpenseWhereInput {
  const and: Prisma.ExpenseWhereInput[] = [];
  if (query.categoryId) {
    and.push({ OR: [{ categoryId: query.categoryId }, { subcategoryId: query.categoryId }] });
  }
  if (query.search) {
    // `%` and `_` are searched for literally, not as LIKE wildcards.
    const text = query.search.replace(/[\\%_]/g, "\\$&");
    const contains = { contains: text, mode: "insensitive" as const };
    and.push({
      OR: [
        { title: contains },
        { vendor: contains },
        { notes: contains },
        { description: contains },
      ],
    });
  }
  return {
    userId,
    vehicleId: query.vehicleId,
    paymentMethod: query.paymentMethod,
    source: query.source,
    kind: query.kind,
    ...((query.from || query.to) && {
      date: {
        ...(query.from && { gte: toDbDate(query.from) }),
        ...(query.to && { lte: toDbDate(query.to) }),
      },
    }),
    ...((query.minAmount || query.maxAmount) && {
      amount: {
        ...(query.minAmount && { gte: query.minAmount }),
        ...(query.maxAmount && { lte: query.maxAmount }),
      },
    }),
    AND: and,
  };
}
