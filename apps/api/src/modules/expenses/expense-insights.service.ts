import {
  addDays,
  addMonths,
  EXPENSE_INSIGHT_LIMIT,
  type ExpenseInsights,
  type ExpenseInsightsQuery,
  istToday,
} from "@automate/shared";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "@/database/prisma.service";
import { Prisma } from "@/generated/prisma/client";
import { VehiclesService } from "@/modules/vehicles/vehicles.service";

import { ExpenseBudgetsService } from "./expense-budgets.service";
import { ExpenseFiguresService } from "./expense-figures.service";
import {
  aboveUsual,
  budgetInsights,
  duplicateInsights,
  type DuplicatePair,
  INSIGHT_RULES,
  type LargeCandidate,
  largeInsights,
} from "./expense-insights";

/** How far back entered expenses are checked for duplicates. */
const DUPLICATE_DAYS = 90;

/**
 * Expense insights (Expenses phase 7, docs/architecture/expenses.md §9): the rules in
 * `expense-insights.ts` over one vehicle's budgets, monthly spending by category and its entered
 * expenses. Never AI; every figure comes from the records.
 */
@Injectable()
export class ExpenseInsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicles: VehiclesService,
    private readonly figures: ExpenseFiguresService,
    private readonly budgets: ExpenseBudgetsService,
  ) {}

  async insights(userId: string, { vehicleId }: ExpenseInsightsQuery): Promise<ExpenseInsights> {
    await this.vehicles.findOwned(userId, vehicleId);
    const today = istToday(new Date());
    const monthStart = `${today.slice(0, 7)}-01`;
    const [budgets, monthly, pairs, large] = await Promise.all([
      this.budgets.list(userId, { vehicleId, page: 1, pageSize: 100 }),
      this.figures.byCategory(
        userId,
        vehicleId,
        { from: addMonths(monthStart, -INSIGHT_RULES.usualMonths), to: today },
        true,
      ),
      this.duplicates(userId, vehicleId, addDays(today, -DUPLICATE_DAYS)),
      this.large(userId, vehicleId, monthStart, today),
    ]);
    const above = aboveUsual(monthly, today, vehicleId);
    return {
      items: [
        ...budgetInsights(budgets.items, vehicleId),
        ...above.items,
        ...duplicateInsights(pairs),
        ...largeInsights(large.candidates, large.typical),
      ].slice(0, EXPENSE_INSIGHT_LIMIT),
      monthsOfHistory: above.monthsOfHistory,
    };
  }

  /** Entered (manual or imported) expenses alike in category, amount and day. */
  private async duplicates(userId: string, vehicleId: string, since: string) {
    const rows = await this.prisma.$queryRaw<
      {
        id: string;
        other_id: string;
        title: string;
        category: string;
        amount: Prisma.Decimal;
        date: string;
      }[]
    >`
      SELECT a.id, b.id AS other_id, a.title, c.name AS category, a.amount, a.date::text AS date
      FROM expenses a
      JOIN expenses b
        ON b.user_id = a.user_id AND b.vehicle_id = a.vehicle_id AND b.category_id = a.category_id
       AND b.amount = a.amount AND b.date = a.date AND b.id > a.id
       AND b.kind = 'EXPENSE' AND b.source IN ('MANUAL', 'IMPORT')
      JOIN expense_categories c ON c.id = a.category_id
      WHERE a.user_id = ${userId}::uuid AND a.vehicle_id = ${vehicleId}::uuid
        AND a.kind = 'EXPENSE' AND a.source IN ('MANUAL', 'IMPORT')
        AND a.date >= ${since}::date
      ORDER BY a.date DESC, a.id
      LIMIT 5`;
    return rows.map((row): DuplicatePair => ({
      id: row.id,
      otherId: row.other_id,
      title: row.title,
      category: row.category,
      amount: new Prisma.Decimal(row.amount),
      date: row.date,
    }));
  }

  /**
   * This month's biggest expenses (loan payments aside) and the typical one: the median of the six
   * months before, when there are enough to tell.
   */
  private async large(userId: string, vehicleId: string, monthStart: string, today: string) {
    const [[typical], candidates] = await Promise.all([
      this.prisma.$queryRaw<{ median: Prisma.Decimal | null; count: number }[]>`
        SELECT percentile_disc(0.5) WITHIN GROUP (ORDER BY e.amount) AS median,
               count(*)::int AS count
        FROM expenses e
        JOIN expense_categories c ON c.id = e.category_id
        WHERE e.user_id = ${userId}::uuid AND e.vehicle_id = ${vehicleId}::uuid
          AND e.kind = 'EXPENSE' AND c.cost_class <> 'FINANCING'
          AND e.date >= ${addMonths(monthStart, -6)}::date AND e.date < ${monthStart}::date`,
      this.prisma.$queryRaw<{ id: string; title: string; amount: Prisma.Decimal; date: string }[]>`
        SELECT e.id, e.title, e.amount, e.date::text AS date
        FROM expenses e
        JOIN expense_categories c ON c.id = e.category_id
        WHERE e.user_id = ${userId}::uuid AND e.vehicle_id = ${vehicleId}::uuid
          AND e.kind = 'EXPENSE' AND c.cost_class <> 'FINANCING'
          AND e.amount >= ${INSIGHT_RULES.largeRupees}
          AND e.date >= ${monthStart}::date AND e.date <= ${today}::date
        ORDER BY e.amount DESC
        LIMIT 5`,
    ]);
    return {
      typical:
        typical?.median && typical.count >= INSIGHT_RULES.largeSample
          ? new Prisma.Decimal(typical.median)
          : null,
      candidates: candidates.map((row): LargeCandidate => ({
        ...row,
        amount: new Prisma.Decimal(row.amount),
      })),
    };
  }
}
