import {
  type Budget,
  type BudgetListQuery,
  BudgetPeriod,
  type CreateBudgetValues,
  istToday,
  pageMeta,
  type UpdateBudgetValues,
} from "@automate/shared";
import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";

import { pageArgs, Paginated } from "@/common/pagination/paginated";
import { PrismaService } from "@/database/prisma.service";
import { Prisma } from "@/generated/prisma/client";
import { VehiclesService } from "@/modules/vehicles/vehicles.service";

import { budgetProgress, budgetWindow } from "./budget-progress";
import { ExpenseCategoriesService } from "./expense-categories.service";
import { toRef } from "./expenses.mapper";

type Db = Prisma.TransactionClient | PrismaService;
const WITH = { category: true } as const;
type BudgetRow = Prisma.ExpenseBudgetGetPayload<{ include: typeof WITH }>;

const NOT_FOUND = "Budget not found";

/**
 * Budgets (Expenses phase 5, docs/architecture/expenses.md §7): a limit per vehicle for the IST
 * month or year, overall or for one main category. Spending is read fresh each time, on the same
 * basis as "Spent" (net of refunds, loan principal left out), so it never drifts from the records.
 */
@Injectable()
export class ExpenseBudgetsService {
  private readonly logger = new Logger(ExpenseBudgetsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicles: VehiclesService,
    private readonly categories: ExpenseCategoriesService,
  ) {}

  async list(userId: string, query: BudgetListQuery): Promise<Paginated<Budget>> {
    if (query.vehicleId) await this.vehicles.findOwned(userId, query.vehicleId);
    const where: Prisma.ExpenseBudgetWhereInput = {
      userId,
      ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.expenseBudget.findMany({
        where,
        include: WITH,
        orderBy: [{ vehicleId: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        ...pageArgs(query),
      }),
      this.prisma.expenseBudget.count({ where }),
    ]);
    return new Paginated(await this.present(userId, rows), pageMeta(query, total));
  }

  async get(userId: string, id: string): Promise<Budget> {
    const [budget] = await this.present(userId, [await this.owned(userId, id)]);
    return budget!;
  }

  async create(userId: string, values: CreateBudgetValues): Promise<Budget> {
    const id = await this.prisma.$transaction(async (tx) => {
      const vehicle = await this.vehicles.lockOwned(userId, values.vehicleId, tx);
      if (vehicle.archivedAt) {
        throw new ConflictException(
          `${vehicle.make} ${vehicle.model} is archived. Restore it to set a budget.`,
        );
      }
      if (values.categoryId) {
        await this.categories.resolve(userId, values.categoryId, null, {
          requireActive: true,
          allowFuel: true,
          db: tx,
        });
      }
      // Under the vehicle lock: the unique index lets NULL categories (overall) repeat.
      const taken = await tx.expenseBudget.findFirst({
        where: { vehicleId: values.vehicleId, categoryId: values.categoryId },
        select: { id: true },
      });
      if (taken) {
        throw new ConflictException(
          values.categoryId
            ? "This category already has a budget for this vehicle. Edit that one."
            : "This vehicle already has an overall budget. Edit that one.",
        );
      }
      const created = await tx.expenseBudget.create({
        data: {
          userId,
          vehicleId: values.vehicleId,
          categoryId: values.categoryId,
          period: values.period,
          amount: values.amount,
          alertPercent: values.alertPercent,
        },
      });
      return created.id;
    });
    this.logger.log(`Budget ${id} created`);
    return this.get(userId, id);
  }

  async update(userId: string, id: string, values: UpdateBudgetValues): Promise<Budget> {
    await this.owned(userId, id);
    await this.prisma.expenseBudget.update({
      where: { id },
      data: {
        period: values.period,
        amount: values.amount,
        alertPercent: values.alertPercent,
      },
    });
    this.logger.log(`Budget ${id} updated`);
    return this.get(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.owned(userId, id);
    await this.prisma.expenseBudget.delete({ where: { id } });
    this.logger.log(`Budget ${id} deleted`);
  }

  private async owned(userId: string, id: string, db: Db = this.prisma): Promise<BudgetRow> {
    const row = await db.expenseBudget.findFirst({ where: { id, userId }, include: WITH });
    if (!row) throw new NotFoundException(NOT_FOUND);
    return row;
  }

  /** Each budget with what's been spent in its current period (one query for the page). */
  private async present(userId: string, rows: BudgetRow[]): Promise<Budget[]> {
    if (!rows.length) return [];
    const today = istToday(new Date());
    const month = budgetWindow(BudgetPeriod.MONTH, today);
    const year = budgetWindow(BudgetPeriod.YEAR, today);
    const ids = Prisma.join(rows.map((row) => Prisma.sql`${row.id}::uuid`));
    const sums = await this.prisma.$queryRaw<{ id: string; spent: Prisma.Decimal }[]>`
      SELECT b.id,
             coalesce(sum(CASE WHEN e.kind = 'REFUND' THEN -e.amount
                               ELSE e.amount - coalesce(e.principal_amount, 0) END), 0) AS spent
      FROM expense_budgets b
      LEFT JOIN expenses e
        ON e.user_id = b.user_id AND e.vehicle_id = b.vehicle_id
       AND (b.category_id IS NULL OR e.category_id = b.category_id)
       AND e.date >= CASE WHEN b.period = 'YEAR' THEN ${year.from}::date ELSE ${month.from}::date END
       AND e.date <= CASE WHEN b.period = 'YEAR' THEN ${year.to}::date ELSE ${month.to}::date END
      WHERE b.user_id = ${userId}::uuid AND b.id IN (${ids})
      GROUP BY b.id`;
    const spentOf = new Map(sums.map((row) => [row.id, new Prisma.Decimal(row.spent)]));
    return rows.map((row) => {
      const spent = spentOf.get(row.id) ?? new Prisma.Decimal(0);
      const { remaining, percent, state } = budgetProgress(row.amount, spent, row.alertPercent);
      return {
        id: row.id,
        vehicleId: row.vehicleId,
        category: row.category && toRef(row.category, row.category.costClass!),
        period: row.period,
        amount: row.amount.toFixed(2),
        alertPercent: row.alertPercent,
        window: row.period === BudgetPeriod.YEAR ? year : month,
        spent: spent.toFixed(2),
        remaining: remaining.toFixed(2),
        percent,
        state,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  }
}
