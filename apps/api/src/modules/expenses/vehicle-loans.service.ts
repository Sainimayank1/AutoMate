import {
  createVehicleLoanSchema,
  type CreateVehicleLoanValues,
  ExpenseKind,
  istToday,
  LoanMethod,
  type LoanRateChangeValues,
  type LoanScheduleRow,
  pageMeta,
  type PaginationQuery,
  PaymentState,
  RecurrenceUnit,
  type UpdateVehicleLoanValues,
  type VehicleLoan,
  type VehicleLoanListQuery,
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
import { Prisma } from "@/generated/prisma/client";
import { VehiclesService } from "@/modules/vehicles/vehicles.service";

import { toDbDate } from "./expenses.mapper";
import { amortise, type ScheduleEntry } from "./loan-schedule";
import { type Acted, stateOf } from "./recurrence";

type Db = Prisma.TransactionClient | PrismaService;
type LoanRow = Prisma.VehicleLoanGetPayload<{
  include: { rateChanges: true; recurring: { include: { occurrences: true } } };
}>;

const NOT_FOUND = "Loan not found";
const EMI_KEYS = { category: "FINANCE", subcategory: "FINANCE.EMI" } as const;
const PREPAYMENT_KEY = "FINANCE.PART_PREPAYMENT";
const day = (value: Date) => value.toISOString().slice(0, 10);
const money = (value: Prisma.Decimal) => value.toFixed(2);
const fieldError = (field: string, message: string) => ({ message, details: [{ field, message }] });

/** A loan's schedule as worked out today, with what's been recorded against it. */
export type LoanPlan = {
  loan: LoanRow;
  rows: ScheduleEntry[];
  acted: Map<string, Acted>;
};

/**
 * Vehicle loans (Expenses phase 4, docs/architecture/expenses.md §6): the terms, from which the
 * amortisation schedule is worked out each time (so a prepayment or a rate change shows at once).
 * EMIs are paid through the loan's recurring schedule; prepayments are Finance expenses tagged
 * with the loan. Nothing here is a payment until it's recorded as an expense.
 */
@Injectable()
export class VehicleLoansService {
  private readonly logger = new Logger(VehicleLoansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicles: VehiclesService,
  ) {}

  async list(userId: string, query: VehicleLoanListQuery): Promise<Paginated<VehicleLoan>> {
    if (query.vehicleId) await this.vehicles.findOwned(userId, query.vehicleId);
    const where = { userId, ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.vehicleLoan.findMany({
        where,
        orderBy: [{ firstEmiDate: "desc" }, { id: "asc" }],
        select: { id: true },
        ...pageArgs(query),
      }),
      this.prisma.vehicleLoan.count({ where }),
    ]);
    const plans = await this.plans(
      userId,
      rows.map((row) => row.id),
    );
    const items = await Promise.all(rows.map((row) => this.present(plans.get(row.id)!)));
    return new Paginated(items, pageMeta(query, total));
  }

  async get(userId: string, id: string): Promise<VehicleLoan> {
    const plan = (await this.plans(userId, [id])).get(id);
    if (!plan) throw new NotFoundException(NOT_FOUND);
    return this.present(plan);
  }

  /** The loan and its EMI schedule (a monthly recurring payment in Finance · Vehicle EMI). */
  async create(userId: string, values: CreateVehicleLoanValues): Promise<VehicleLoan> {
    const id = await this.prisma.$transaction(async (tx) => {
      await this.activeVehicle(userId, values.vehicleId, tx);
      const loan = await tx.vehicleLoan.create({ data: { userId, ...loanData(values) } });
      const category = await this.emiCategory(tx);
      await tx.recurringExpense.create({
        data: {
          userId,
          vehicleId: values.vehicleId,
          loanId: loan.id,
          ...category,
          ...scheduleData(values),
          every: 1,
          unit: RecurrenceUnit.MONTH,
          activeFrom: toDbDate(values.firstEmiDate),
        },
      });
      return loan.id;
    });
    this.logger.log(`Loan ${id} created`);
    return this.get(userId, id);
  }

  /** Merged onto the stored loan and checked whole; paid EMIs keep their expenses. */
  async update(userId: string, id: string, input: UpdateVehicleLoanValues): Promise<VehicleLoan> {
    await this.prisma.$transaction(async (tx) => {
      const current = await this.owned(userId, id, tx);
      await this.activeVehicle(userId, current.vehicleId, tx);
      const parsed = createVehicleLoanSchema.safeParse({
        ...toInput(current, current.recurring),
        ...Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)),
      });
      if (!parsed.success) throw new ZodValidationException(parsed.error);
      if (parsed.data.method === LoanMethod.FLAT && current.rateChanges.length) {
        throw new ConflictException(
          fieldError("method", "A flat-rate loan has no rate changes. Delete them first."),
        );
      }
      await tx.vehicleLoan.update({ where: { id }, data: loanData(parsed.data) });
      await tx.recurringExpense.updateMany({
        where: { loanId: id },
        data: scheduleData(parsed.data),
      });
    });
    this.logger.log(`Loan ${id} updated`);
    return this.get(userId, id);
  }

  /** The loan and its EMI schedule go; EMIs and prepayments already paid stay as expenses. */
  async remove(userId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const current = await this.owned(userId, id, tx);
      await this.activeVehicle(userId, current.vehicleId, tx);
      await tx.vehicleLoan.delete({ where: { id } });
    });
    this.logger.log(`Loan ${id} deleted`);
  }

  /** The amortisation schedule, a page at a time, with each EMI's payment state. */
  async schedule(
    userId: string,
    id: string,
    query: PaginationQuery,
  ): Promise<Paginated<LoanScheduleRow>> {
    const plan = (await this.plans(userId, [id])).get(id);
    if (!plan) throw new NotFoundException(NOT_FOUND);
    const today = istToday(new Date());
    const reminderDays = plan.loan.recurring?.reminderDays ?? 0;
    const all = plan.rows.map((row) => {
      const acted = plan.acted.get(row.date);
      return {
        number: row.number,
        date: row.date,
        annualRate: money(row.annualRate),
        openingBalance: money(row.openingBalance),
        emi: money(row.emi),
        interest: money(row.interest),
        principal: money(row.principal),
        prepayment: money(row.prepayment),
        closingBalance: money(row.closingBalance),
        state: stateOf(row.date, acted, today, reminderDays),
        expenseId: acted?.expenseId ?? null,
      };
    });
    return Paginated.of(all, query);
  }

  async addRateChange(
    userId: string,
    id: string,
    values: LoanRateChangeValues,
  ): Promise<VehicleLoan> {
    await this.prisma.$transaction(async (tx) => {
      const loan = await this.owned(userId, id, tx);
      await this.activeVehicle(userId, loan.vehicleId, tx);
      if (loan.method === LoanMethod.FLAT) {
        throw new ConflictException(
          fieldError("annualRate", "A flat-rate loan's rate is fixed for its whole tenure."),
        );
      }
      if (values.effectiveFrom <= day(loan.firstEmiDate)) {
        throw new BadRequestException(
          fieldError("effectiveFrom", "Choose a date after the first EMI, or edit the loan's rate"),
        );
      }
      if (loan.rateChanges.some((change) => day(change.effectiveFrom) === values.effectiveFrom)) {
        throw new ConflictException(
          fieldError("effectiveFrom", "There's already a rate change on this date"),
        );
      }
      await tx.loanRateChange.create({
        data: {
          loanId: id,
          effectiveFrom: toDbDate(values.effectiveFrom),
          annualRate: values.annualRate,
          keepEmi: values.keepEmi,
        },
      });
    });
    return this.get(userId, id);
  }

  async removeRateChange(userId: string, id: string, changeId: string): Promise<VehicleLoan> {
    await this.prisma.$transaction(async (tx) => {
      const loan = await this.owned(userId, id, tx);
      await this.activeVehicle(userId, loan.vehicleId, tx);
      const { count } = await tx.loanRateChange.deleteMany({ where: { id: changeId, loanId: id } });
      if (!count) throw new NotFoundException("Rate change not found");
    });
    return this.get(userId, id);
  }

  /** The loans' schedules as of now, with what's been recorded against each EMI. */
  async plans(userId: string, ids: string[], db: Db = this.prisma): Promise<Map<string, LoanPlan>> {
    if (!ids.length) return new Map();
    const [loans, prepayments] = await Promise.all([
      db.vehicleLoan.findMany({
        where: { id: { in: ids }, userId },
        include: { rateChanges: true, recurring: { include: { occurrences: true } } },
      }),
      db.expense.findMany({
        where: {
          userId,
          loanId: { in: ids },
          kind: ExpenseKind.EXPENSE,
          subcategory: { key: PREPAYMENT_KEY },
        },
        select: { loanId: true, date: true, principalAmount: true, amount: true },
      }),
    ]);
    return new Map(
      loans.map((loan) => {
        const rows = amortise({
          principal: loan.principal,
          annualRate: loan.annualRate,
          tenureMonths: loan.tenureMonths,
          firstEmiDate: day(loan.firstEmiDate),
          method: loan.method,
          rateChanges: loan.rateChanges.map((change) => ({
            effectiveFrom: day(change.effectiveFrom),
            annualRate: change.annualRate,
            keepEmi: change.keepEmi,
          })),
          prepayments: prepayments
            .filter((row) => row.loanId === loan.id)
            .map((row) => ({ date: day(row.date), amount: row.principalAmount ?? row.amount })),
        });
        const acted = new Map(
          (loan.recurring?.occurrences ?? []).map((occurrence) => [
            day(occurrence.dueDate),
            {
              dueDate: day(occurrence.dueDate),
              postponedTo: occurrence.postponedTo && day(occurrence.postponedTo),
              skipped: occurrence.skipped,
              expenseId: occurrence.expenseId,
            },
          ]),
        );
        return [loan.id, { loan, rows, acted }];
      }),
    );
  }

  private async present({ loan, rows, acted }: LoanPlan): Promise<VehicleLoan> {
    const today = istToday(new Date());
    const paid = await this.prisma.expense.aggregate({
      where: { loanId: loan.id, kind: ExpenseKind.EXPENSE },
      _sum: { principalAmount: true, interestAmount: true, chargesAmount: true },
    });
    const done = (row: ScheduleEntry) => {
      const state = stateOf(row.date, acted.get(row.date), today, 0);
      return state === PaymentState.PAID || state === PaymentState.SKIPPED;
    };
    const past = rows.filter((row) => row.date <= today);
    const next = rows.find((row) => !done(row)) ?? null;
    const current = next ?? rows.at(-1);
    const zero = new Prisma.Decimal(0);
    return {
      id: loan.id,
      vehicleId: loan.vehicleId,
      lender: loan.lender,
      accountNumber: loan.accountNumber,
      principal: money(loan.principal),
      annualRate: money(current?.annualRate ?? loan.annualRate),
      tenureMonths: loan.tenureMonths,
      firstEmiDate: day(loan.firstEmiDate),
      method: loan.method,
      processingFee: loan.processingFee ? money(loan.processingFee) : null,
      emi: money(next?.emi ?? rows[0]?.emi ?? zero),
      outstanding: money(past.at(-1)?.closingBalance ?? rows[0]?.openingBalance ?? loan.principal),
      paid: {
        principal: money(paid._sum.principalAmount ?? zero),
        interest: money(paid._sum.interestAmount ?? zero),
        charges: money(paid._sum.chargesAmount ?? zero),
        emis: [...acted.values()].filter((item) => item.expenseId).length,
      },
      emisTotal: rows.length,
      endDate: rows.at(-1)?.date ?? day(loan.firstEmiDate),
      totalInterest: money(rows.reduce((sum, row) => sum.plus(row.interest), zero)),
      next: next && {
        date: next.date,
        amount: money(next.emi),
        principal: money(next.principal),
        interest: money(next.interest),
      },
      recurringId: loan.recurring?.id ?? null,
      rateChanges: [...loan.rateChanges]
        .sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime())
        .map((change) => ({
          id: change.id,
          effectiveFrom: day(change.effectiveFrom),
          annualRate: money(change.annualRate),
          keepEmi: change.keepEmi,
        })),
      createdAt: loan.createdAt.toISOString(),
      updatedAt: loan.updatedAt.toISOString(),
    };
  }

  private async owned(userId: string, id: string, db: Db) {
    const loan = await db.vehicleLoan.findFirst({
      where: { id, userId },
      include: { rateChanges: true, recurring: true },
    });
    if (!loan) throw new NotFoundException(NOT_FOUND);
    return loan;
  }

  /** Locks the vehicle; an archived one is read-only. */
  private async activeVehicle(userId: string, vehicleId: string, tx: Prisma.TransactionClient) {
    const vehicle = await this.vehicles.lockOwned(userId, vehicleId, tx);
    if (vehicle.archivedAt) {
      throw new ConflictException(
        `${vehicle.make} ${vehicle.model} is archived. Restore it to change its expenses.`,
      );
    }
  }

  private async emiCategory(db: Db) {
    const rows = await db.expenseCategory.findMany({
      where: { userId: null, key: { in: [EMI_KEYS.category, EMI_KEYS.subcategory] } },
      select: { id: true, key: true },
    });
    const idOf = (key: string) => rows.find((row) => row.key === key)?.id;
    const categoryId = idOf(EMI_KEYS.category);
    if (!categoryId) throw new Error("The Finance categories are missing: run the seed");
    return { categoryId, subcategoryId: idOf(EMI_KEYS.subcategory) ?? null };
  }
}

function loanData(values: CreateVehicleLoanValues) {
  return {
    vehicleId: values.vehicleId,
    lender: values.lender,
    accountNumber: values.accountNumber ?? null,
    principal: values.principal,
    annualRate: values.annualRate,
    tenureMonths: values.tenureMonths,
    firstEmiDate: toDbDate(values.firstEmiDate),
    method: values.method,
    processingFee: values.processingFee ?? null,
  };
}

/**
 * The EMI schedule follows the loan: each due date and its amount come from the amortisation;
 * the schedule's own amount is the first EMI, for display.
 */
function scheduleData(values: CreateVehicleLoanValues) {
  const [first] = amortise({
    principal: new Prisma.Decimal(values.principal),
    annualRate: new Prisma.Decimal(values.annualRate),
    tenureMonths: values.tenureMonths,
    firstEmiDate: values.firstEmiDate,
    method: values.method,
    rateChanges: [],
    prepayments: [],
  });
  return {
    title: `${values.lender} EMI`,
    amount: first!.emi,
    startDate: toDbDate(values.firstEmiDate),
    paymentMethod: values.paymentMethod ?? null,
    reminderDays: values.reminderDays,
  };
}

function toInput(
  loan: Prisma.VehicleLoanGetPayload<object>,
  schedule: { paymentMethod: string | null; reminderDays: number } | null,
) {
  return {
    paymentMethod: schedule?.paymentMethod ?? null,
    reminderDays: schedule?.reminderDays ?? 3,
    vehicleId: loan.vehicleId,
    lender: loan.lender,
    accountNumber: loan.accountNumber,
    principal: loan.principal.toFixed(2),
    annualRate: loan.annualRate.toFixed(2),
    tenureMonths: loan.tenureMonths,
    firstEmiDate: day(loan.firstEmiDate),
    method: loan.method,
    processingFee: loan.processingFee?.toFixed(2) ?? null,
  };
}
