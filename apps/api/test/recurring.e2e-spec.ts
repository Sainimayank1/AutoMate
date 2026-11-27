/**
 * Recurring payments and vehicle loans (Expenses phase 4) through the real HTTP pipeline and
 * database. Users are created under a throwaway domain and deleted afterwards.
 */
import { randomUUID } from "node:crypto";

import {
  addDays,
  addMonths,
  type ApiErrorResponse,
  type ApiSuccessResponse,
  type ExpenseDetail,
  istToday,
  type LoanScheduleRow,
  type PageMeta,
  type RecurringExpense,
  type RecurringPayment,
  type Vehicle,
  type VehicleLoan,
} from "@automate/shared";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "@/app.module";
import { configureApp } from "@/app.setup";
import { PrismaService } from "@/database/prisma.service";
import { AuthService } from "@/modules/auth/auth.service";
import { seedSystemExpenseCategories } from "@/modules/expenses/expense-categories.seed";

const DOMAIN = "recurring.e2e.automate.test";
const RECURRING = "/api/v1/recurring-expenses";
const LOANS = "/api/v1/vehicle-loans";

describe("Recurring payments and loans (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let arjun: string;
  let priya: string;
  const keyed = new Map<string, string>();
  const today = istToday(new Date());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      bodyParser: false,
      bufferLogs: true,
    });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await seedSystemExpenseCategories(prisma);
    for (const row of await prisma.expenseCategory.findMany({ where: { userId: null } })) {
      keyed.set(row.key!, row.id);
    }
    const signUp = async (name: string) =>
      (
        await app.get(AuthService).register(
          {
            name,
            email: `recurring-${randomUUID()}@${DOMAIN}`,
            password: "Drive2026safe",
            acceptedTerms: true,
          },
          {},
        )
      ).session.accessToken;
    arjun = await signUp("Arjun Mehta");
    priya = await signUp("Priya Nair");
  });

  afterAll(async () => {
    await prisma?.user.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } });
    await app?.close();
  });

  const as = (token: string) => ({
    get: (url: string) => request(app.getHttpServer()).get(url).auth(token, { type: "bearer" }),
    post: (url: string, body?: object) =>
      request(app.getHttpServer()).post(url).auth(token, { type: "bearer" }).send(body),
    patch: (url: string, body: object) =>
      request(app.getHttpServer()).patch(url).auth(token, { type: "bearer" }).send(body),
    delete: (url: string) =>
      request(app.getHttpServer()).delete(url).auth(token, { type: "bearer" }),
  });
  const dataOf = <T>(res: request.Response) => (res.body as ApiSuccessResponse<T>).data;
  const metaOf = (res: request.Response) =>
    (res.body as ApiSuccessResponse<unknown, PageMeta>).meta;
  const errorOf = (res: request.Response) => (res.body as ApiErrorResponse).error;
  const id = (key: string) => keyed.get(key)!;

  async function vehicle(token: string) {
    const plate = `KA${Math.floor(10 + Math.random() * 89)}RC${Math.floor(1000 + Math.random() * 9000)}`;
    const res = await as(token)
      .post("/api/v1/vehicles", {
        make: "Maruti Suzuki",
        model: "Victoris",
        manufacturingYear: 2025,
        category: "SUV",
        registrationNumber: plate,
        fuelType: "PETROL",
        transmission: "MANUAL",
        ownershipType: "FINANCED",
        odometerKm: 8000,
      })
      .expect(201);
    return dataOf<Vehicle>(res);
  }

  it("schedules a payment, keeps each due date's state, and records a payment once", async () => {
    const car = await vehicle(arjun);
    const start = addMonths(today, -2);
    const created = dataOf<RecurringExpense>(
      await as(arjun)
        .post(RECURRING, {
          vehicleId: car.id,
          title: "Society parking pass",
          amount: "1500",
          categoryId: id("DAILY_USAGE"),
          subcategoryId: id("DAILY_USAGE.PARKING"),
          every: 1,
          unit: "MONTH",
          startDate: start,
          reminderDays: 3,
        })
        .expect(201),
    );
    // Dates before it was added were dealt with elsewhere: nothing is overdue yet.
    expect(created).toMatchObject({ status: "ACTIVE", overdue: 0, loanId: null });
    expect(created.next).toMatchObject({ dueDate: addMonths(start, 2), state: "DUE" });
    // As if it had been added two months ago.
    await prisma.recurringExpense.update({
      where: { id: created.id },
      data: { activeFrom: new Date(`${start}T00:00:00.000Z`) },
    });

    const upcoming = await as(arjun).get(`${RECURRING}/payments?vehicleId=${car.id}`).expect(200);
    const due = dataOf<RecurringPayment[]>(upcoming);
    expect(due.slice(0, 3).map((item) => [item.dueDate, item.state])).toEqual([
      [start, "OVERDUE"],
      [addMonths(start, 1), "OVERDUE"],
      [addMonths(start, 2), "DUE"],
    ]);
    expect(metaOf(upcoming)?.total).toBeGreaterThanOrEqual(5);

    // Paid: the expense is recorded once, from the schedule.
    const pay = (dueDate: string, body: object = { date: today }) =>
      as(arjun).post(`${RECURRING}/${created.id}/payments/${dueDate}/pay`, body);
    const paid = dataOf<RecurringPayment>(await pay(start).expect(200));
    expect(paid).toMatchObject({ state: "PAID", amount: "1500.00" });
    const expense = dataOf<ExpenseDetail>(
      await as(arjun).get(`/api/v1/expenses/${paid.expenseId}`).expect(200),
    );
    expect(expense).toMatchObject({
      source: "RECURRING",
      amount: "1500.00",
      title: "Society parking pass",
      date: today,
      editable: true,
    });
    const twice = await pay(start).expect(409);
    expect((twice.body as ApiErrorResponse).message).toMatch(/already recorded/);
    await pay(addDays(start, 1)).expect(404);

    // Skipped and postponed dates are kept; undoing them puts them back.
    const second = addMonths(start, 1);
    await as(arjun).post(`${RECURRING}/${created.id}/payments/${second}/skip`).expect(200);
    const third = addMonths(start, 2);
    const moved = dataOf<RecurringPayment>(
      await as(arjun)
        .post(`${RECURRING}/${created.id}/payments/${third}/postpone`, { to: addDays(today, 20) })
        .expect(200),
    );
    expect(moved).toMatchObject({ state: "SCHEDULED", postponed: true, date: addDays(today, 20) });
    const history = dataOf<RecurringPayment[]>(
      await as(arjun).get(`${RECURRING}/payments?vehicleId=${car.id}&view=history`).expect(200),
    );
    expect(history.map((item) => [item.dueDate, item.state])).toEqual([
      [second, "SKIPPED"],
      [start, "PAID"],
    ]);
    const undone = await as(arjun)
      .delete(`${RECURRING}/${created.id}/payments/${second}`)
      .expect(200);
    expect(dataOf<RecurringPayment>(undone).state).toBe("OVERDUE");
    await as(arjun).delete(`${RECURRING}/${created.id}/payments/${start}`).expect(409);

    // Deleting the expense makes the date unpaid again.
    await as(arjun).delete(`/api/v1/expenses/${paid.expenseId}`).expect(204);
    const after = dataOf<RecurringExpense>(await as(arjun).get(`${RECURRING}/${created.id}`));
    expect(after.overdue).toBe(2);

    // Paused, nothing is due; resumed, it counts again from today.
    await as(arjun).post(`${RECURRING}/${created.id}/pause`).expect(200);
    expect(
      dataOf<RecurringPayment[]>(
        await as(arjun).get(`${RECURRING}/payments?vehicleId=${car.id}`).expect(200),
      ),
    ).toEqual([]);
    const resumed = dataOf<RecurringExpense>(
      await as(arjun).post(`${RECURRING}/${created.id}/resume`).expect(200),
    );
    expect(resumed).toMatchObject({ status: "ACTIVE", overdue: 0 });

    // Someone else's schedule doesn't exist for them.
    await as(priya).get(`${RECURRING}/${created.id}`).expect(404);
    await as(priya)
      .post(`${RECURRING}/${created.id}/payments/${third}/pay`, { date: today })
      .expect(404);
  });

  it("refuses a Finance schedule: loans carry their EMI split", async () => {
    const car = await vehicle(arjun);
    const res = await as(arjun)
      .post(RECURRING, {
        vehicleId: car.id,
        title: "EMI",
        amount: "16607",
        categoryId: id("FINANCE"),
        subcategoryId: id("FINANCE.EMI"),
        every: 1,
        unit: "MONTH",
        startDate: today,
      })
      .expect(400);
    expect(errorOf(res).details).toEqual([
      {
        field: "categoryId",
        message: "Add the loan instead: its EMIs are scheduled with their principal and interest.",
      },
    ]);
  });

  it("amortises a loan, schedules its EMIs and records each with its split", async () => {
    const car = await vehicle(arjun);
    // The first EMI was due a month ago less a day: one EMI has fallen due, the next hasn't.
    const first = addDays(addMonths(today, -1), 1);
    const loan = dataOf<VehicleLoan>(
      await as(arjun)
        .post(LOANS, {
          vehicleId: car.id,
          lender: "HDFC Bank",
          accountNumber: "AL-0042",
          principal: "800000",
          annualRate: "9",
          tenureMonths: 60,
          firstEmiDate: first,
        })
        .expect(201),
    );
    // The first EMI fell due before the loan was added: paid elsewhere, not owed here.
    expect(loan).toMatchObject({
      emi: "16607.00",
      emisTotal: 60,
      outstanding: "789393.00", // after the first EMI
      next: { date: addMonths(first, 1) },
      paid: { emis: 0, principal: "0.00" },
      beforeTracking: { emis: 1, principal: "10607.00", interest: "6000.00" },
    });
    const schedule = await as(arjun).get(`${LOANS}/${loan.id}/schedule?pageSize=100`).expect(200);
    expect(metaOf(schedule)?.total).toBe(60);
    expect(dataOf<LoanScheduleRow[]>(schedule)[0]).toMatchObject({
      number: 1,
      emi: "16607.00",
      state: null,
    });
    // As if it had been added before its first EMI.
    await prisma.recurringExpense.update({
      where: { id: loan.recurringId! },
      data: { activeFrom: new Date(`${first}T00:00:00.000Z`) },
    });

    // Its EMI is a payment like any other, with the split from the schedule.
    const emi = dataOf<RecurringPayment[]>(
      await as(arjun).get(`${RECURRING}/payments?vehicleId=${car.id}`).expect(200),
    )[0]!;
    expect(emi).toMatchObject({
      recurringId: loan.recurringId,
      dueDate: first,
      state: "OVERDUE",
      loan: { loanId: loan.id, number: 1, of: 60, principal: "10607.00" },
    });
    const url = `${RECURRING}/${loan.recurringId}/payments/${first}/pay`;
    await as(arjun).post(url, { date: today, amount: "17000" }).expect(400);
    const paid = dataOf<RecurringPayment>(
      await as(arjun).post(url, { date: today, chargesAmount: "500" }).expect(200),
    );
    const expense = dataOf<ExpenseDetail>(
      await as(arjun).get(`/api/v1/expenses/${paid.expenseId}`),
    );
    expect(expense).toMatchObject({
      title: "HDFC Bank EMI 1/60",
      amount: "17107.00",
      category: { key: "FINANCE" },
      subcategory: { key: "FINANCE.EMI" },
      finance: {
        principal: "10607.00",
        interest: "6000.00",
        charges: "500.00",
        loanId: loan.id,
        loanOutstanding: "789393.00",
      },
    });
    await as(arjun).patch(`${RECURRING}/${loan.recurringId}`, { title: "x" }).expect(409);

    // A prepayment (a Finance expense tagged with the loan) keeps the EMI and shortens the loan.
    await as(arjun)
      .post("/api/v1/expenses", {
        allocation: { mode: "single", vehicleId: car.id },
        categoryId: id("FINANCE"),
        subcategoryId: id("FINANCE.PART_PREPAYMENT"),
        title: "Part-prepayment",
        amount: "100000",
        principalAmount: "100000",
        loanId: loan.id,
        date: today,
      })
      .expect(201);
    const prepaid = dataOf<VehicleLoan>(await as(arjun).get(`${LOANS}/${loan.id}`).expect(200));
    expect(prepaid.emisTotal).toBeLessThan(60);
    expect(prepaid).toMatchObject({
      emi: "16607.00",
      paid: { emis: 1, principal: "110607.00", interest: "6000.00", charges: "500.00" },
    });

    // A rate rise kept on the same EMI lengthens it again.
    const risen = dataOf<VehicleLoan>(
      await as(arjun)
        .post(`${LOANS}/${loan.id}/rate-changes`, {
          effectiveFrom: addMonths(today, 2),
          annualRate: "9.5",
        })
        .expect(201),
    );
    expect(risen.rateChanges).toHaveLength(1);
    expect(risen.emisTotal).toBeGreaterThan(prepaid.emisTotal);
    await as(arjun)
      .post(`${LOANS}/${loan.id}/rate-changes`, { effectiveFrom: first, annualRate: "8" })
      .expect(400);

    // Someone else's loan doesn't exist for them; a payment can't be tagged with it.
    await as(priya).get(`${LOANS}/${loan.id}`).expect(404);
    const other = await vehicle(arjun);
    const wrong = await as(arjun)
      .post("/api/v1/expenses", {
        allocation: { mode: "single", vehicleId: other.id },
        categoryId: id("FINANCE"),
        subcategoryId: id("FINANCE.PART_PREPAYMENT"),
        title: "Part-prepayment",
        amount: "1000",
        principalAmount: "1000",
        loanId: loan.id,
        date: today,
      })
      .expect(400);
    expect(errorOf(wrong).details).toEqual([
      { field: "loanId", message: "Choose a loan of this vehicle" },
    ]);

    // Deleting the loan keeps what was paid, as plain expenses.
    await as(arjun).delete(`${LOANS}/${loan.id}`).expect(204);
    const kept = dataOf<ExpenseDetail>(await as(arjun).get(`/api/v1/expenses/${paid.expenseId}`));
    expect(kept.finance).toMatchObject({ principal: "10607.00", loanId: null });
  });

  it("refuses rate changes on a flat-rate loan", async () => {
    const car = await vehicle(arjun);
    const loan = dataOf<VehicleLoan>(
      await as(arjun)
        .post(LOANS, {
          vehicleId: car.id,
          lender: "Mahindra Finance",
          principal: "500000",
          annualRate: "8",
          tenureMonths: 36,
          firstEmiDate: addMonths(today, 1),
          method: "FLAT",
        })
        .expect(201),
    );
    expect(loan).toMatchObject({ emi: "17222.00", totalInterest: "120000.00", emisTotal: 36 });
    await as(arjun)
      .post(`${LOANS}/${loan.id}/rate-changes`, {
        effectiveFrom: addMonths(today, 3),
        annualRate: "9",
      })
      .expect(409);
  });
});
