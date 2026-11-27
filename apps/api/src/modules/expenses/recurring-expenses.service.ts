import {
  addDays,
  CostClass,
  createExpenseSchema,
  createRecurringExpenseSchema,
  type CreateRecurringExpenseValues,
  istToday,
  pageMeta,
  PaymentState,
  type PayRecurringValues,
  type PostponeRecurringValues,
  type RecurringExpense,
  type RecurringListQuery,
  type RecurringPayment,
  type RecurringPaymentsQuery,
  RecurringStatus,
  UPCOMING_DAYS,
  type UpdateRecurringExpenseValues,
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

import { ExpenseCategoriesService } from "./expense-categories.service";
import { toDbDate, toRef } from "./expenses.mapper";
import { ExpensesService } from "./expenses.service";
import type { ScheduleEntry } from "./loan-schedule";
import { type Acted, dueDates, type Recurrence, stateOf } from "./recurrence";
import { trackedFrom } from "./tracking";
import { type LoanPlan, VehicleLoansService } from "./vehicle-loans.service";

type Db = Prisma.TransactionClient | PrismaService;
const WITH = {
  category: true,
  subcategory: true,
  occurrences: { include: { expense: { select: { amount: true } } } },
} as const;
type ScheduleRow = Prisma.RecurringExpenseGetPayload<{ include: typeof WITH }>;

const NOT_FOUND = "Recurring payment not found";
/** How far back unpaid dates still count as overdue. */
const OVERDUE_LOOKBACK_DAYS = 366;
const day = (value: Date) => value.toISOString().slice(0, 10);
const money = (value: Prisma.Decimal) => value.toFixed(2);
const fieldError = (field: string, message: string) => ({ message, details: [{ field, message }] });
const OPEN: PaymentState[] = [PaymentState.OVERDUE, PaymentState.DUE, PaymentState.SCHEDULED];

/**
 * Recurring payments (Expenses phase 4, docs/architecture/expenses.md §6). A schedule is never a
 * payment: each due date is scheduled, due or overdue until it's marked paid, which records its
 * expense (once: keyed by the due date). Skipped and postponed dates are kept; untouched ones
 * are worked out from the schedule. A loan's EMI schedule takes its dates and amounts from the
 * loan's amortisation.
 */
@Injectable()
export class RecurringExpensesService {
  private readonly logger = new Logger(RecurringExpensesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicles: VehiclesService,
    private readonly categories: ExpenseCategoriesService,
    private readonly expenses: ExpensesService,
    private readonly loans: VehicleLoansService,
  ) {}

  async list(userId: string, query: RecurringListQuery): Promise<Paginated<RecurringExpense>> {
    if (query.vehicleId) await this.vehicles.findOwned(userId, query.vehicleId);
    const where: Prisma.RecurringExpenseWhereInput = {
      userId,
      ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.recurringExpense.findMany({
        where,
        include: WITH,
        orderBy: [{ status: "asc" }, { title: "asc" }, { id: "asc" }],
        ...pageArgs(query),
      }),
      this.prisma.recurringExpense.count({ where }),
    ]);
    const plans = await this.plansFor(userId, rows);
    return new Paginated(
      rows.map((row) => this.present(row, plans)),
      pageMeta(query, total),
    );
  }

  async get(userId: string, id: string): Promise<RecurringExpense> {
    const row = await this.owned(userId, id);
    return this.present(row, await this.plansFor(userId, [row]));
  }

  async create(userId: string, values: CreateRecurringExpenseValues): Promise<RecurringExpense> {
    const id = await this.prisma.$transaction(async (tx) => {
      await this.activeVehicle(userId, values.vehicleId, tx);
      await this.checkCategory(userId, values, true, tx);
      const created = await tx.recurringExpense.create({
        data: {
          userId,
          ...scheduleData(values),
          activeFrom: toDbDate(trackedFrom(values.startDate)),
        },
      });
      return created.id;
    });
    this.logger.log(`Recurring payment ${id} created`);
    return this.get(userId, id);
  }

  /** Merged onto the stored schedule and checked whole. A loan's schedule follows the loan. */
  async update(
    userId: string,
    id: string,
    input: UpdateRecurringExpenseValues,
  ): Promise<RecurringExpense> {
    await this.prisma.$transaction(async (tx) => {
      const current = await this.owned(userId, id, tx);
      notALoan(current, "Edit the loan: its EMIs follow the loan's terms.");
      await this.activeVehicle(userId, current.vehicleId, tx);
      const parsed = createRecurringExpenseSchema.safeParse({
        ...toInput(current),
        ...Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)),
      });
      if (!parsed.success) throw new ZodValidationException(parsed.error);
      const changed =
        parsed.data.categoryId !== current.categoryId ||
        (parsed.data.subcategoryId ?? null) !== current.subcategoryId;
      await this.checkCategory(userId, parsed.data, changed, tx);
      await tx.recurringExpense.update({ where: { id }, data: scheduleData(parsed.data) });
    });
    this.logger.log(`Recurring payment ${id} updated`);
    return this.get(userId, id);
  }

  /**
   * Paused: nothing falls due. Resumed: due dates count again from today (those in between
   * aren't owed). Cancelled: no more due dates, for good; what was paid stays.
   */
  async setStatus(userId: string, id: string, status: RecurringStatus): Promise<RecurringExpense> {
    await this.prisma.$transaction(async (tx) => {
      const current = await this.owned(userId, id, tx);
      await this.activeVehicle(userId, current.vehicleId, tx);
      if (current.status === RecurringStatus.CANCELLED) {
        throw new ConflictException("This recurring payment was cancelled. Add it again instead.");
      }
      const resumed =
        status === RecurringStatus.ACTIVE && current.status !== RecurringStatus.ACTIVE;
      await tx.recurringExpense.update({
        where: { id },
        data: { status, ...(resumed ? { activeFrom: toDbDate(istToday(new Date())) } : {}) },
      });
    });
    this.logger.log(`Recurring payment ${id} → ${status}`);
    return this.get(userId, id);
  }

  /** The schedule goes; payments already recorded stay as expenses. */
  async remove(userId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const current = await this.owned(userId, id, tx);
      notALoan(current, "Delete the loan to remove its EMI schedule.");
      await this.activeVehicle(userId, current.vehicleId, tx);
      await tx.recurringExpense.delete({ where: { id } });
    });
    this.logger.log(`Recurring payment ${id} deleted`);
  }

  /**
   * Upcoming: unpaid due dates, overdue first, then the next UPCOMING_DAYS days, soonest first.
   * History: paid and skipped ones, newest first.
   */
  async payments(
    userId: string,
    query: RecurringPaymentsQuery,
  ): Promise<Paginated<RecurringPayment>> {
    if (query.vehicleId) await this.vehicles.findOwned(userId, query.vehicleId);
    const where: Prisma.RecurringExpenseWhereInput = {
      userId,
      ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
      ...(query.recurringId ? { id: query.recurringId } : {}),
    };
    if (query.view === "history") return this.history(userId, where, query);
    // shortcut: every active schedule's dates for the window are worked out in memory, then
    // paged; fine for a person's handful of schedules, move to stored occurrences if that grows.
    const rows = await this.prisma.recurringExpense.findMany({
      where: { ...where, status: RecurringStatus.ACTIVE },
      include: WITH,
    });
    const plans = await this.plansFor(userId, rows);
    const today = istToday(new Date());
    const all = rows
      .flatMap((row) => this.openPayments(row, plans.get(row.loanId ?? ""), today))
      .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
    return Paginated.of(all, query);
  }

  /** Records the payment's expense (once) and marks the due date paid. */
  async pay(
    userId: string,
    id: string,
    dueDate: string,
    values: PayRecurringValues,
  ): Promise<RecurringPayment> {
    await this.prisma.$transaction(async (tx) => {
      const { schedule, plan, row } = await this.dueDateOf(userId, id, dueDate, tx);
      const existing = schedule.occurrences.find((item) => day(item.dueDate) === dueDate);
      if (existing?.expenseId) throw new ConflictException("This payment is already recorded.");
      const occurrence = existing
        ? await tx.recurringOccurrence.update({
            where: { id: existing.id },
            data: { skipped: false },
          })
        : await tx.recurringOccurrence.create({
            data: { recurringId: id, dueDate: toDbDate(dueDate) },
          });
      const parsed = createExpenseSchema.safeParse(
        expenseFor(schedule, dueDate, values, plan, row),
      );
      if (!parsed.success) throw new ZodValidationException(parsed.error);
      const expenseId = await this.expenses.createRecorded(tx, userId, parsed.data, occurrence.id);
      await tx.recurringOccurrence.update({ where: { id: occurrence.id }, data: { expenseId } });
    });
    this.logger.log(`Recurring payment ${id} paid for ${dueDate}`);
    return this.payment(userId, id, dueDate);
  }

  async skip(userId: string, id: string, dueDate: string): Promise<RecurringPayment> {
    await this.act(userId, id, dueDate, { skipped: true, postponedTo: null });
    return this.payment(userId, id, dueDate);
  }

  async postpone(
    userId: string,
    id: string,
    dueDate: string,
    { to }: PostponeRecurringValues,
  ): Promise<RecurringPayment> {
    if (to <= dueDate) {
      throw new BadRequestException(fieldError("to", "Choose a date after it was due"));
    }
    await this.act(userId, id, dueDate, { skipped: false, postponedTo: toDbDate(to) });
    return this.payment(userId, id, dueDate);
  }

  /** Undoes a skip or a postponement. A paid date is unpaid by deleting its expense. */
  async reset(userId: string, id: string, dueDate: string): Promise<RecurringPayment> {
    await this.prisma.$transaction(async (tx) => {
      const { schedule } = await this.dueDateOf(userId, id, dueDate, tx);
      const existing = schedule.occurrences.find((item) => day(item.dueDate) === dueDate);
      if (existing?.expenseId) {
        throw new ConflictException("It's paid. Delete its expense to mark it unpaid.");
      }
      if (existing) await tx.recurringOccurrence.delete({ where: { id: existing.id } });
    });
    return this.payment(userId, id, dueDate);
  }

  // ---- internals

  private async act(
    userId: string,
    id: string,
    dueDate: string,
    data: { skipped: boolean; postponedTo: Date | null },
  ) {
    await this.prisma.$transaction(async (tx) => {
      const { schedule } = await this.dueDateOf(userId, id, dueDate, tx);
      const existing = schedule.occurrences.find((item) => day(item.dueDate) === dueDate);
      if (existing?.expenseId) {
        throw new ConflictException("It's paid. Delete its expense to change it.");
      }
      await tx.recurringOccurrence.upsert({
        where: { recurringId_dueDate: { recurringId: id, dueDate: toDbDate(dueDate) } },
        create: { recurringId: id, dueDate: toDbDate(dueDate), ...data },
        update: data,
      });
    });
    this.logger.log(`Recurring payment ${id}: ${dueDate} ${data.skipped ? "skipped" : "moved"}`);
  }

  /** The schedule (locked, its vehicle active) and the due date, which must be one of its own. */
  private async dueDateOf(
    userId: string,
    id: string,
    dueDate: string,
    tx: Prisma.TransactionClient,
  ) {
    const schedule = await this.owned(userId, id, tx);
    await this.activeVehicle(userId, schedule.vehicleId, tx);
    const plan = (await this.plansFor(userId, [schedule], tx)).get(schedule.loanId ?? "");
    const row = plan?.rows.find((entry) => entry.date === dueDate);
    const onSchedule = plan
      ? !!row
      : dueDates(recurrenceOf(schedule), dueDate, dueDate).length === 1;
    if (!onSchedule) throw new NotFoundException("Nothing is due on this date for this payment");
    return { schedule, plan, row };
  }

  /** One due date as it stands now. */
  private async payment(userId: string, id: string, dueDate: string): Promise<RecurringPayment> {
    const schedule = await this.owned(userId, id);
    const plan = (await this.plansFor(userId, [schedule])).get(schedule.loanId ?? "");
    const occurrence = schedule.occurrences.find((item) => day(item.dueDate) === dueDate);
    return toPayment(
      schedule,
      dueDate,
      occurrence && actedOf(occurrence),
      istToday(new Date()),
      plan,
      occurrence?.expense?.amount,
    );
  }

  private async history(
    userId: string,
    where: Prisma.RecurringExpenseWhereInput,
    query: RecurringPaymentsQuery,
  ): Promise<Paginated<RecurringPayment>> {
    const occurrenceWhere: Prisma.RecurringOccurrenceWhereInput = {
      recurring: where,
      OR: [{ expenseId: { not: null } }, { skipped: true }],
    };
    const [rows, total] = await Promise.all([
      this.prisma.recurringOccurrence.findMany({
        where: occurrenceWhere,
        include: { recurring: { include: WITH }, expense: { select: { amount: true } } },
        orderBy: [{ dueDate: "desc" }, { id: "asc" }],
        ...pageArgs(query),
      }),
      this.prisma.recurringOccurrence.count({ where: occurrenceWhere }),
    ]);
    const plans = await this.plansFor(
      userId,
      rows.map((row) => row.recurring),
    );
    const today = istToday(new Date());
    return new Paginated(
      rows.map((row) =>
        toPayment(
          row.recurring,
          day(row.dueDate),
          actedOf(row),
          today,
          plans.get(row.recurring.loanId ?? ""),
          row.expense?.amount,
        ),
      ),
      pageMeta(query, total),
    );
  }

  /** A schedule's unpaid due dates from the overdue lookback to UPCOMING_DAYS ahead. */
  private openPayments(
    row: ScheduleRow,
    plan: LoanPlan | undefined,
    today: string,
  ): RecurringPayment[] {
    if (row.status !== RecurringStatus.ACTIVE) return [];
    const activeFrom = day(row.activeFrom);
    const lookback = addDays(today, -OVERDUE_LOOKBACK_DAYS);
    const from = activeFrom > lookback ? activeFrom : lookback;
    const to = addDays(today, UPCOMING_DAYS);
    const acted = new Map(row.occurrences.map((item) => [day(item.dueDate), actedOf(item)]));
    const scheduled = plan
      ? plan.rows.filter((entry) => entry.date >= from && entry.date <= to).map((e) => e.date)
      : dueDates(recurrenceOf(row), from, to);
    // Postponed into the window from before it.
    const moved = [...acted.values()]
      .filter((item) => item.dueDate < from && item.postponedTo && item.postponedTo >= today)
      .map((item) => item.dueDate);
    return [...new Set([...moved, ...scheduled])]
      .map((date) => toPayment(row, date, acted.get(date), today, plan))
      .filter((payment) => OPEN.includes(payment.state));
  }

  private present(row: ScheduleRow, plans: Map<string, LoanPlan>): RecurringExpense {
    const today = istToday(new Date());
    const open = this.openPayments(row, plans.get(row.loanId ?? ""), today).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    const costClass = row.category.costClass ?? CostClass.OPERATING;
    return {
      id: row.id,
      vehicleId: row.vehicleId,
      title: row.title,
      amount: money(row.amount),
      category: toRef(row.category, costClass),
      subcategory: row.subcategory && toRef(row.subcategory, costClass),
      paymentMethod: row.paymentMethod,
      vendor: row.vendor,
      notes: row.notes,
      every: row.every,
      unit: row.unit,
      startDate: day(row.startDate),
      endDate: row.endDate && day(row.endDate),
      reminderDays: row.reminderDays,
      status: row.status,
      loanId: row.loanId,
      next: open[0] ?? null,
      overdue: open.filter((payment) => payment.state === PaymentState.OVERDUE).length,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private plansFor(userId: string, rows: { loanId: string | null }[], db?: Db) {
    const ids = [...new Set(rows.flatMap((row) => (row.loanId ? [row.loanId] : [])))];
    return this.loans.plans(userId, ids, db);
  }

  private async owned(userId: string, id: string, db: Db = this.prisma): Promise<ScheduleRow> {
    const row = await db.recurringExpense.findFirst({ where: { id, userId }, include: WITH });
    if (!row) throw new NotFoundException(NOT_FOUND);
    return row;
  }

  private async activeVehicle(userId: string, vehicleId: string, tx: Prisma.TransactionClient) {
    const vehicle = await this.vehicles.lockOwned(userId, vehicleId, tx);
    if (vehicle.archivedAt) {
      throw new ConflictException(
        `${vehicle.make} ${vehicle.model} is archived. Restore it to change its expenses.`,
      );
    }
  }

  /** Loan payments need their principal and interest: they come from a loan, not a schedule. */
  private async checkCategory(
    userId: string,
    values: { categoryId: string; subcategoryId?: string | null },
    requireActive: boolean,
    db: Db,
  ) {
    const { costClass } = await this.categories.resolve(
      userId,
      values.categoryId,
      values.subcategoryId,
      { requireActive, db },
    );
    if (costClass === CostClass.FINANCING) {
      throw new BadRequestException(
        fieldError(
          "categoryId",
          "Add the loan instead: its EMIs are scheduled with their principal and interest.",
        ),
      );
    }
  }
}

function notALoan(row: ScheduleRow, message: string) {
  if (row.loanId) throw new ConflictException(message);
}

const recurrenceOf = (row: ScheduleRow): Recurrence => ({
  startDate: day(row.startDate),
  endDate: row.endDate && day(row.endDate),
  every: row.every,
  unit: row.unit,
});

const actedOf = (row: {
  dueDate: Date;
  postponedTo: Date | null;
  skipped: boolean;
  expenseId: string | null;
}): Acted => ({
  dueDate: day(row.dueDate),
  postponedTo: row.postponedTo && day(row.postponedTo),
  skipped: row.skipped,
  expenseId: row.expenseId,
});

function toPayment(
  row: ScheduleRow,
  dueDate: string,
  acted: Acted | undefined,
  today: string,
  plan: LoanPlan | undefined,
  paidAmount?: Prisma.Decimal,
): RecurringPayment {
  const entry: ScheduleEntry | undefined = plan?.rows.find((item) => item.date === dueDate);
  const costClass = row.category.costClass ?? CostClass.OPERATING;
  return {
    recurringId: row.id,
    vehicleId: row.vehicleId,
    title: row.title,
    category: toRef(row.category, costClass),
    dueDate,
    date: acted?.postponedTo ?? dueDate,
    amount: money(paidAmount ?? entry?.emi ?? row.amount),
    state: stateOf(dueDate, acted, today, row.reminderDays),
    postponed: !!acted?.postponedTo,
    expenseId: acted?.expenseId ?? null,
    loan:
      plan && entry
        ? {
            loanId: plan.loan.id,
            number: entry.number,
            of: plan.rows.length,
            principal: money(entry.principal),
            interest: money(entry.interest),
          }
        : null,
  };
}

/** The expense a paid due date records. A loan EMI carries its split from the schedule. */
function expenseFor(
  row: ScheduleRow,
  dueDate: string,
  values: PayRecurringValues,
  plan: LoanPlan | undefined,
  entry: ScheduleEntry | undefined,
) {
  const common = {
    allocation: { mode: "single" as const, vehicleId: row.vehicleId },
    categoryId: row.categoryId,
    subcategoryId: row.subcategoryId,
    date: values.date,
    paymentMethod: values.paymentMethod ?? row.paymentMethod,
    notes: values.notes ?? null,
  };
  if (plan && entry) {
    if (values.amount) {
      throw new BadRequestException(
        fieldError("amount", "An EMI's amount comes from the loan. Add late fees as charges."),
      );
    }
    const charges = new Prisma.Decimal(values.chargesAmount ?? 0);
    return {
      ...common,
      title: `${plan.loan.lender} EMI ${entry.number}/${plan.rows.length}`,
      amount: money(entry.emi.plus(charges)),
      principalAmount: money(entry.principal),
      interestAmount: money(entry.interest),
      chargesAmount: charges.isZero() ? null : money(charges),
      loanId: plan.loan.id,
      loanReference: plan.loan.accountNumber,
      loanOutstanding: money(entry.closingBalance),
      description: `EMI ${entry.number} of ${plan.rows.length}, due ${dueDate}`,
    };
  }
  if (values.chargesAmount) {
    throw new BadRequestException(fieldError("chargesAmount", "Charges apply to loan EMIs only"));
  }
  return {
    ...common,
    title: row.title,
    amount: values.amount ?? money(row.amount),
    vendor: row.vendor,
    description: `Recurring payment due ${dueDate}`,
  };
}

function scheduleData(values: CreateRecurringExpenseValues) {
  return {
    vehicleId: values.vehicleId,
    title: values.title,
    amount: values.amount,
    categoryId: values.categoryId,
    subcategoryId: values.subcategoryId ?? null,
    paymentMethod: values.paymentMethod ?? null,
    vendor: values.vendor ?? null,
    notes: values.notes ?? null,
    every: values.every,
    unit: values.unit,
    startDate: toDbDate(values.startDate),
    endDate: values.endDate ? toDbDate(values.endDate) : null,
    reminderDays: values.reminderDays,
  };
}

function toInput(row: ScheduleRow) {
  return {
    vehicleId: row.vehicleId,
    title: row.title,
    amount: money(row.amount),
    categoryId: row.categoryId,
    subcategoryId: row.subcategoryId,
    paymentMethod: row.paymentMethod,
    vendor: row.vendor,
    notes: row.notes,
    every: row.every,
    unit: row.unit,
    startDate: day(row.startDate),
    endDate: row.endDate && day(row.endDate),
    reminderDays: row.reminderDays,
  };
}
