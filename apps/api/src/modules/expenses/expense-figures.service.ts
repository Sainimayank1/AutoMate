import {
  CostClass,
  type DateWindow,
  type ExpenseCategoryRef,
  type ExpenseIcon,
  ExpenseKind,
  ExpenseSource,
  INSURANCE_POLICY_KEYS,
} from "@automate/shared";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "@/database/prisma.service";
import { Prisma } from "@/generated/prisma/client";

import { distanceOf, type YearReadings } from "./expense-summary";

/** Net money of one vehicle in a window (refunds subtracted). */
export type PeriodTotals = {
  /** Expense and refund rows in the window. */
  records: number;
  /** Everything paid except loan principal (docs/architecture/dashboard.md §1). */
  spent: Prisma.Decimal;
  /** `OPERATING` class: running cost. */
  operating: Prisma.Decimal;
  /** The Fuel category (fill-ups). */
  fuel: Prisma.Decimal;
};

/** Km driven in a window and running cost per km (`costPerKm` null when km aren't known). */
export type Usage = {
  readings: number;
  distanceKm: number | null;
  costPerKm: Prisma.Decimal | null;
};

/**
 * Figures over any IST window, for the Expenses Overview and the dashboard, so both show the same
 * numbers. Money is net of refunds; distance comes from odometer readings on expenses (fill-ups
 * included). The caller checks the vehicle belongs to the user.
 */
@Injectable()
export class ExpenseFiguresService {
  constructor(private readonly prisma: PrismaService) {}

  async totals(userId: string, vehicleId: string, window: DateWindow): Promise<PeriodTotals> {
    const [row] = await this.prisma.$queryRaw<
      { records: number; spent: Prisma.Decimal; operating: Prisma.Decimal; fuel: Prisma.Decimal }[]
    >`
      SELECT count(*)::int AS records,
             coalesce(sum(CASE WHEN e.kind = 'REFUND' THEN -e.amount
                               ELSE e.amount - coalesce(e.principal_amount, 0) END), 0) AS spent,
             coalesce(sum(CASE WHEN c.cost_class = 'OPERATING'
                               THEN CASE WHEN e.kind = 'REFUND' THEN -e.amount ELSE e.amount END
                               ELSE 0 END), 0) AS operating,
             coalesce(sum(CASE WHEN c.key = 'FUEL'
                               THEN CASE WHEN e.kind = 'REFUND' THEN -e.amount ELSE e.amount END
                               ELSE 0 END), 0) AS fuel
      FROM expenses e
      JOIN expense_categories c ON c.id = e.category_id
      WHERE e.user_id = ${userId}::uuid AND e.vehicle_id = ${vehicleId}::uuid
        AND e.date >= ${window.from}::date AND e.date <= ${window.to}::date`;
    return {
      records: row!.records,
      spent: new Prisma.Decimal(row!.spent),
      operating: new Prisma.Decimal(row!.operating),
      fuel: new Prisma.Decimal(row!.fuel),
    };
  }

  /**
   * Net money by cost class in a window (refunds subtracted; FINANCING is interest and charges
   * only), plus what was paid in cash and the loan principal in it (Ownership cost, phase 6).
   */
  async byCostClass(userId: string, vehicleId: string, window: DateWindow) {
    const rows = await this.prisma.$queryRaw<
      {
        cost_class: CostClass;
        cost: Prisma.Decimal;
        cash: Prisma.Decimal;
        principal: Prisma.Decimal;
      }[]
    >`
      SELECT c.cost_class,
             sum(CASE WHEN e.kind = 'REFUND' THEN -e.amount
                      ELSE e.amount - coalesce(e.principal_amount, 0) END) AS cost,
             sum(CASE WHEN e.kind = 'REFUND' THEN -e.amount ELSE e.amount END) AS cash,
             sum(CASE WHEN e.kind = 'REFUND' THEN 0 ELSE coalesce(e.principal_amount, 0) END)
               AS principal
      FROM expenses e
      JOIN expense_categories c ON c.id = e.category_id
      WHERE e.user_id = ${userId}::uuid AND e.vehicle_id = ${vehicleId}::uuid
        AND e.date >= ${window.from}::date AND e.date <= ${window.to}::date
      GROUP BY c.cost_class`;
    const zero = new Prisma.Decimal(0);
    const cost = Object.fromEntries(
      Object.values(CostClass).map((costClass) => [costClass, zero]),
    ) as Record<CostClass, Prisma.Decimal>;
    let cash = zero;
    let principal = zero;
    for (const row of rows) {
      cost[row.cost_class] = new Prisma.Decimal(row.cost);
      cash = cash.plus(row.cash);
      principal = principal.plus(row.principal);
    }
    return { cost, cash, principal };
  }

  /**
   * Km in the window: the highest reading in it minus the last one before it (or its first one);
   * running cost ÷ km, counting only cost after the first reading when there's none before.
   */
  async usage(
    userId: string,
    vehicleId: string,
    window: DateWindow,
    operating: Prisma.Decimal,
  ): Promise<Usage> {
    const [reading] = await this.readings(userId, window, vehicleId);
    if (!reading) return { readings: 0, distanceKm: null, costPerKm: null };
    const distanceKm = distanceOf(reading);
    const cost = reading.before === null ? reading.costAfterFirst : operating;
    return {
      readings: reading.readings,
      distanceKm,
      costPerKm: distanceKm ? cost.div(distanceKm) : null,
    };
  }

  /** Odometer readings per vehicle in a window, with the highest one before it. */
  async readings(userId: string, window: DateWindow, vehicleId?: string): Promise<YearReadings[]> {
    const vehicle = vehicleId ? Prisma.sql`AND e.vehicle_id = ${vehicleId}::uuid` : Prisma.empty;
    const rows = await this.prisma.$queryRaw<
      {
        vehicle_id: string;
        readings: number;
        min_in_year: number | null;
        max_in_year: number | null;
        before: number | null;
        cost_after_first: Prisma.Decimal;
      }[]
    >`
      WITH r AS (
        SELECT e.vehicle_id,
               count(*) FILTER (WHERE e.date >= ${window.from}::date)::int AS readings,
               min(e.odometer_km) FILTER (WHERE e.date >= ${window.from}::date) AS min_in_year,
               max(e.odometer_km) FILTER (WHERE e.date >= ${window.from}::date) AS max_in_year,
               max(e.odometer_km) FILTER (WHERE e.date < ${window.from}::date) AS before,
               min(e.date) FILTER (WHERE e.date >= ${window.from}::date) AS first_date
        FROM expenses e
        WHERE e.user_id = ${userId}::uuid AND e.odometer_km IS NOT NULL AND e.date <= ${window.to}::date
        ${vehicle}
        GROUP BY e.vehicle_id
      )
      SELECT r.vehicle_id, r.readings, r.min_in_year, r.max_in_year, r.before,
             (SELECT coalesce(sum(CASE WHEN x.kind = 'REFUND' THEN -x.amount ELSE x.amount END), 0)
              FROM expenses x
              JOIN expense_categories c ON c.id = x.category_id
              WHERE x.user_id = ${userId}::uuid AND x.vehicle_id = r.vehicle_id
                AND c.cost_class = 'OPERATING'
                AND x.date > r.first_date AND x.date <= ${window.to}::date) AS cost_after_first
      FROM r`;
    return rows.map((row) => ({
      vehicleId: row.vehicle_id,
      readings: row.readings,
      minInYear: row.min_in_year,
      maxInYear: row.max_in_year,
      before: row.before,
      costAfterFirst: new Prisma.Decimal(row.cost_after_first),
    }));
  }

  /**
   * Spending by top-level category in a window, net of refunds and without loan principal (the
   * same basis as `spent`); `monthly` splits it by IST month too.
   */
  async byCategory(
    userId: string,
    /** One vehicle, or every vehicle of the user's when undefined. */
    vehicleId: string | undefined,
    window: DateWindow,
    monthly: boolean,
  ): Promise<{ month: string | null; category: ExpenseCategoryRef; total: Prisma.Decimal }[]> {
    const month = monthly ? Prisma.sql`to_char(e.date, 'YYYY-MM')` : Prisma.sql`NULL::text`;
    const rows = await this.prisma.$queryRaw<
      {
        month: string | null;
        id: string;
        key: string | null;
        name: string;
        icon: string;
        cost_class: CostClass;
        total: Prisma.Decimal;
      }[]
    >`
      SELECT ${month} AS month, c.id, c.key, c.name, c.icon, c.cost_class,
             sum(CASE WHEN e.kind = 'REFUND' THEN -e.amount
                      ELSE e.amount - coalesce(e.principal_amount, 0) END) AS total
      FROM expenses e
      JOIN expense_categories c ON c.id = e.category_id
      WHERE e.user_id = ${userId}::uuid
        ${vehicleId ? Prisma.sql`AND e.vehicle_id = ${vehicleId}::uuid` : Prisma.empty}
        AND e.date >= ${window.from}::date AND e.date <= ${window.to}::date
      GROUP BY 1, 2, 3, 4, 5, 6`;
    return rows.map((row) => ({
      month: row.month,
      category: {
        id: row.id,
        key: row.key,
        name: row.name,
        icon: row.icon as ExpenseIcon,
        costClass: row.cost_class,
      },
      total: new Prisma.Decimal(row.total),
    }));
  }

  /** The latest odometer reading on record by `upTo` (expenses, fill-ups included). */
  async lastReading(
    userId: string,
    vehicleId: string,
    upTo: string,
  ): Promise<{ km: number; date: string } | null> {
    const row = await this.prisma.expense.findFirst({
      where: {
        userId,
        vehicleId,
        odometerKm: { not: null },
        date: { lte: new Date(`${upTo}T00:00:00.000Z`) },
      },
      orderBy: [{ date: "desc" }, { odometerKm: "desc" }],
      select: { odometerKm: true, date: true },
    });
    return row ? { km: row.odometerKm!, date: row.date.toISOString().slice(0, 10) } : null;
  }

  /**
   * The vehicle's latest money events (fill-ups, expenses, refunds), newest first, and how many
   * there are. A service's own expense is left out: Maintenance lists the service itself.
   */
  async events(userId: string, vehicleId: string, take: number) {
    const where: Prisma.ExpenseWhereInput = {
      userId,
      vehicleId,
      source: { not: ExpenseSource.MAINTENANCE },
    };
    const [rows, count] = await this.prisma.$transaction([
      this.prisma.expense.findMany({
        where,
        include: { category: true, subcategory: true },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        take,
      }),
      this.prisma.expense.count({ where }),
    ]);
    return { rows, count };
  }

  /** The date of the vehicle's earliest expense (fill-ups included): records start there. */
  async firstDate(userId: string, vehicleId: string | undefined): Promise<string | null> {
    const row = await this.prisma.expense.findFirst({
      where: { userId, ...(vehicleId ? { vehicleId } : {}) },
      orderBy: { date: "asc" },
      select: { date: true },
    });
    return row?.date.toISOString().slice(0, 10) ?? null;
  }

  /** The insurance payment with the latest policy expiry (a policy's dates live on its payment). */
  async latestInsurance(userId: string, vehicleId: string) {
    const row = await this.prisma.expense.findFirst({
      where: {
        userId,
        vehicleId,
        kind: ExpenseKind.EXPENSE,
        policyEnd: { not: null },
        subcategory: { key: { in: [...INSURANCE_POLICY_KEYS] } },
      },
      orderBy: [{ policyEnd: "desc" }, { date: "desc" }],
      select: { id: true, date: true, policyEnd: true },
    });
    return row
      ? {
          expenseId: row.id,
          paidOn: row.date.toISOString().slice(0, 10),
          policyEnd: row.policyEnd!.toISOString().slice(0, 10),
        }
      : null;
  }
}
