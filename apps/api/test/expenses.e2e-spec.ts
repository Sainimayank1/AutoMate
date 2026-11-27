/**
 * Expenses API through the real HTTP pipeline and database (docker compose up -d).
 * System categories are upserted first (the same seed production runs); users are created under
 * a throwaway domain and deleted afterwards (their vehicles, expenses and categories cascade).
 */
import { randomUUID } from "node:crypto";

import type {
  ApiErrorResponse,
  ApiSuccessResponse,
  BulkResult,
  Expense,
  ExpenseCategory,
  ExpenseDetail,
  ExpenseSummary,
  ExpenseTrend,
  PageMeta,
  Vehicle,
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
import { overviewPeriods } from "@/modules/expenses/expense-summary";

const DOMAIN = "expenses.e2e.automate.test";
const EXPENSES = "/api/v1/expenses";
const CATEGORIES = "/api/v1/expense-categories";

describe("Expenses (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let arjun: string;
  let priya: string;
  /** System category ids by key. */
  const keyed = new Map<string, string>();

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
            email: `expenses-${randomUUID()}@${DOMAIN}`,
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

  async function vehicle(token: string, overrides: object = {}) {
    const plate = `KA${Math.floor(10 + Math.random() * 89)}EX${Math.floor(1000 + Math.random() * 9000)}`;
    const res = await as(token)
      .post("/api/v1/vehicles", {
        make: "Maruti Suzuki",
        model: "Victoris",
        manufacturingYear: 2025,
        category: "SUV",
        registrationNumber: plate,
        fuelType: "PETROL",
        transmission: "MANUAL",
        ownershipType: "OWNED",
        odometerKm: 8000,
        ...overrides,
      })
      .expect(201);
    return (res.body as ApiSuccessResponse<Vehicle>).data;
  }
  const toll = (vehicleId: string, overrides: object = {}) => ({
    allocation: { mode: "single", vehicleId },
    categoryId: id("DAILY_USAGE"),
    subcategoryId: id("DAILY_USAGE.TOLL"),
    title: "Delhi–Jaipur Expressway",
    amount: "640",
    date: "2026-11-21",
    paymentMethod: "UPI",
    ...overrides,
  });

  it("adds an expense and lists it with filters, sorting and page meta", async () => {
    const car = await vehicle(arjun);
    const created = dataOf<ExpenseDetail>(
      await as(arjun)
        .post(EXPENSES, toll(car.id, { odometerKm: "8,450" }))
        .expect(201),
    );
    expect(created).toMatchObject({
      amount: "640.00",
      date: "2026-11-21",
      category: { key: "DAILY_USAGE", costClass: "OPERATING" },
      subcategory: { key: "DAILY_USAGE.TOLL" },
      source: "MANUAL",
      editable: true,
      shared: null,
      finance: null,
      refundedAmount: "0.00",
      refunds: [],
    });
    await as(arjun)
      .post(
        EXPENSES,
        toll(car.id, {
          title: "Parking",
          amount: "200",
          date: "2026-11-02",
          subcategoryId: id("DAILY_USAGE.PARKING"),
        }),
      )
      .expect(201);

    const parking = await as(arjun)
      .get(`${EXPENSES}?vehicleId=${car.id}&categoryId=${id("DAILY_USAGE.PARKING")}`)
      .expect(200);
    expect(dataOf<Expense[]>(parking).map((e) => e.title)).toEqual(["Parking"]);

    const byAmount = await as(arjun)
      .get(`${EXPENSES}?vehicleId=${car.id}&sort=amount_asc&pageSize=1`)
      .expect(200);
    expect(dataOf<Expense[]>(byAmount).map((e) => e.amount)).toEqual(["200.00"]);
    expect(metaOf(byAmount)).toEqual({ page: 1, pageSize: 1, total: 2, totalPages: 2 });

    const search = await as(arjun).get(`${EXPENSES}?vehicleId=${car.id}&search=jaipur`).expect(200);
    expect(dataOf<Expense[]>(search)).toHaveLength(1);
    const ranged = await as(arjun)
      .get(`${EXPENSES}?vehicleId=${car.id}&from=2026-11-10&to=2026-11-30&minAmount=500`)
      .expect(200);
    expect(dataOf<Expense[]>(ranged).map((e) => e.title)).toEqual(["Delhi–Jaipur Expressway"]);
    await as(arjun).get(`${EXPENSES}?from=2026-11-30&to=2026-11-01`).expect(400);

    // An expense's odometer reading raises the vehicle's.
    const updated = dataOf<Vehicle>(await as(arjun).get(`/api/v1/vehicles/${car.id}`).expect(200));
    expect(updated.odometerKm).toBe(8450);
  });

  it("splits loan payments into principal, interest and charges, and nothing else", async () => {
    const car = await vehicle(arjun);
    const emi = {
      ...toll(car.id),
      categoryId: id("FINANCE"),
      subcategoryId: id("FINANCE.EMI"),
      title: "HDFC Auto Loan",
      amount: "16684",
    };
    const missing = await as(arjun).post(EXPENSES, emi).expect(400);
    expect(errorOf(missing).details).toEqual([
      { field: "principalAmount", message: expect.stringContaining("Split the payment") as string },
    ]);
    await as(arjun)
      .post(EXPENSES, { ...emi, principalAmount: "10950", interestAmount: "5000" })
      .expect(400);
    const paid = dataOf<ExpenseDetail>(
      await as(arjun)
        .post(EXPENSES, {
          ...emi,
          principalAmount: "10950",
          interestAmount: "5734",
          loanOutstanding: "713295",
        })
        .expect(201),
    );
    expect(paid.finance).toEqual({
      principal: "10950.00",
      interest: "5734.00",
      charges: null,
      loanReference: null,
      loanOutstanding: "713295.00",
      loanId: null,
    });
    // Only loan payments have a split.
    await as(arjun)
      .post(EXPENSES, toll(car.id, { interestAmount: "640" }))
      .expect(400);
    // A loan payment can't be refunded or shared.
    await as(arjun)
      .post(`${EXPENSES}/${paid.id}/refunds`, {
        amount: "100",
        date: "2026-11-22",
        reason: "REFUND",
      })
      .expect(409);
  });

  it("keeps fuel to fill-ups: no manual fuel expenses", async () => {
    const car = await vehicle(arjun);
    const res = await as(arjun)
      .post(EXPENSES, toll(car.id, { categoryId: id("FUEL"), subcategoryId: id("FUEL.PETROL") }))
      .expect(400);
    expect(errorOf(res).details[0]).toMatchObject({ field: "categoryId" });
  });

  it("shares an expense across vehicles to the paisa, edits and deletes it as one", async () => {
    const [a, b, c] = [await vehicle(arjun), await vehicle(arjun), await vehicle(arjun)];
    const shared = dataOf<ExpenseDetail>(
      await as(arjun)
        .post(EXPENSES, {
          ...toll(a.id),
          title: "FASTag annual",
          amount: "1000",
          allocation: {
            mode: "shared",
            split: "equal",
            vehicles: [{ vehicleId: a.id }, { vehicleId: b.id }, { vehicleId: c.id }],
          },
        })
        .expect(201),
    );
    expect(shared.group.map((share) => share.amount)).toEqual(["333.34", "333.33", "333.33"]);
    expect(shared.shared).toMatchObject({ totalAmount: "1000.00", vehicleCount: 3 });

    // Custom shares must add up; dropping a vehicle removes its row.
    await as(arjun)
      .patch(`${EXPENSES}/${shared.id}`, {
        amount: "1200",
        allocation: {
          mode: "shared",
          split: "custom",
          vehicles: [
            { vehicleId: a.id, amount: "700" },
            { vehicleId: b.id, amount: "400" },
          ],
        },
      })
      .expect(400);
    const edited = dataOf<ExpenseDetail>(
      await as(arjun)
        .patch(`${EXPENSES}/${shared.id}`, {
          amount: "1200",
          allocation: {
            mode: "shared",
            split: "custom",
            vehicles: [
              { vehicleId: a.id, amount: "700" },
              { vehicleId: b.id, amount: "500" },
            ],
          },
        })
        .expect(200),
    );
    expect(edited.id).toBe(shared.id);
    expect(edited.group.map((share) => [share.vehicleId, share.amount])).toEqual([
      [a.id, "700.00"],
      [b.id, "500.00"],
    ]);
    // Changing a shared amount without saying how to split it is refused.
    await as(arjun).patch(`${EXPENSES}/${shared.id}`, { amount: "1500" }).expect(400);

    await as(arjun).delete(`${EXPENSES}/${edited.group[1]!.expenseId}`).expect(204);
    await as(arjun).get(`${EXPENSES}/${shared.id}`).expect(404);
  });

  it("records refunds against the original without changing it", async () => {
    const car = await vehicle(arjun);
    const wash = dataOf<ExpenseDetail>(
      await as(arjun)
        .post(
          EXPENSES,
          toll(car.id, {
            title: "3M Car Care",
            amount: "850",
            date: "2026-11-16",
            subcategoryId: id("DAILY_USAGE.WASHING"),
          }),
        )
        .expect(201),
    );
    const refund = (amount: string, date = "2026-11-18") =>
      as(arjun).post(`${EXPENSES}/${wash.id}/refunds`, { amount, date, reason: "REFUND" });

    await refund("100", "2026-11-10").expect(400); // before the expense
    const after = dataOf<ExpenseDetail>(await refund("300").expect(201));
    expect(after).toMatchObject({ amount: "850.00", refundedAmount: "300.00" });
    expect(after.refunds[0]).toMatchObject({
      kind: "REFUND",
      amount: "300.00",
      refundOfId: wash.id,
    });
    const over = await refund("600").expect(400);
    expect(errorOf(over).details[0]).toMatchObject({ field: "amount" });
    // The amount can't drop below what was refunded.
    await as(arjun).patch(`${EXPENSES}/${wash.id}`, { amount: "200" }).expect(409);

    const refunds = await as(arjun).get(`${EXPENSES}?vehicleId=${car.id}&kind=REFUND`).expect(200);
    expect(dataOf<Expense[]>(refunds)).toHaveLength(1);
    await as(arjun).delete(`${EXPENSES}/${wash.id}`).expect(204);
    const gone = await as(arjun).get(`${EXPENSES}?vehicleId=${car.id}`).expect(200);
    expect(dataOf<Expense[]>(gone)).toEqual([]);
  });

  it("keeps expenses from other modules read-only, also in bulk", async () => {
    const car = await vehicle(arjun);
    const user = await prisma.vehicle.findUniqueOrThrow({ where: { id: car.id } });
    const linked = await prisma.expense.create({
      data: {
        userId: user.userId,
        vehicleId: car.id,
        title: "IndianOil XP95",
        amount: "3070.55",
        date: new Date("2026-11-24T00:00:00.000Z"),
        categoryId: id("FUEL"),
        subcategoryId: id("FUEL.PETROL"),
        source: "FUEL",
        sourceId: randomUUID(),
      },
    });
    const manual = dataOf<ExpenseDetail>(await as(arjun).post(EXPENSES, toll(car.id)).expect(201));

    const listed = dataOf<Expense[]>(
      await as(arjun).get(`${EXPENSES}?vehicleId=${car.id}&source=FUEL`).expect(200),
    );
    expect(listed).toEqual([expect.objectContaining({ id: linked.id, editable: false })]);
    const edit = await as(arjun).patch(`${EXPENSES}/${linked.id}`, { title: "x" }).expect(409);
    expect((edit.body as ApiErrorResponse).message).toContain("Edit it there");
    await as(arjun).delete(`${EXPENSES}/${linked.id}`).expect(409);

    const moved = dataOf<BulkResult>(
      await as(arjun)
        .post(`${EXPENSES}/bulk/category`, {
          ids: [linked.id, manual.id],
          categoryId: id("OTHER"),
          subcategoryId: id("OTHER.MISC"),
        })
        .expect(200),
    );
    expect(moved).toEqual({ affected: 1, skipped: 1 });
    const removed = dataOf<BulkResult>(
      await as(arjun)
        .post(`${EXPENSES}/bulk/delete`, { ids: [linked.id, manual.id] })
        .expect(200),
    );
    expect(removed).toEqual({ affected: 1, skipped: 1 });
    await as(arjun).get(`${EXPENSES}/${linked.id}`).expect(200);
  });

  it("manages custom categories without touching system ones", async () => {
    const mine = dataOf<ExpenseCategory>(
      await as(arjun)
        .post(CATEGORIES, {
          name: "Driver salary",
          icon: "badge-indian-rupee",
          costClass: "OPERATING",
        })
        .expect(201),
    );
    expect(mine).toMatchObject({ custom: true, active: true, costClass: "OPERATING", usage: 0 });
    await as(arjun).post(CATEGORIES, { name: "Something", icon: "car" }).expect(400); // no cost class
    const dupe = await as(arjun)
      .post(CATEGORIES, { name: "toll", icon: "route", parentId: id("DAILY_USAGE") })
      .expect(409);
    expect(errorOf(dupe).details[0]).toMatchObject({ field: "name" });
    await as(arjun)
      .post(CATEGORIES, { name: "Petrol premium", icon: "fuel", parentId: id("FUEL") })
      .expect(400);
    const sub = dataOf<ExpenseCategory>(
      await as(arjun)
        .post(CATEGORIES, { name: "Overtime", icon: "car", parentId: mine.id })
        .expect(201),
    );
    expect(sub).toMatchObject({ parentId: mine.id, costClass: "OPERATING" });
    await as(arjun)
      .patch(`${CATEGORIES}/${id("DAILY_USAGE")}`, { name: "x" })
      .expect(409);

    const car = await vehicle(arjun);
    await as(arjun)
      .post(
        EXPENSES,
        toll(car.id, { categoryId: mine.id, subcategoryId: sub.id, title: "November" }),
      )
      .expect(201);
    await as(arjun).delete(`${CATEGORIES}/${mine.id}`).expect(409);
    await as(arjun).patch(`${CATEGORIES}/${mine.id}`, { active: false }).expect(200);
    await as(arjun)
      .post(EXPENSES, toll(car.id, { categoryId: mine.id, subcategoryId: null, title: "December" }))
      .expect(400);

    const list = await as(arjun).get(`${CATEGORIES}?includeInactive=true&pageSize=100`).expect(200);
    const found = dataOf<ExpenseCategory[]>(list).find((item) => item.id === mine.id);
    expect(found).toMatchObject({ active: false, usage: 1 });
    expect(dataOf<ExpenseCategory[]>(list)[0]).toMatchObject({ key: "FUEL", custom: false });

    // Another user sees only the system categories.
    const theirs = dataOf<ExpenseCategory[]>(
      await as(priya).get(`${CATEGORIES}?pageSize=100`).expect(200),
    );
    expect(theirs.some((item) => item.custom)).toBe(false);
    await as(priya).patch(`${CATEGORIES}/${mine.id}`, { name: "Mine now" }).expect(404);

    const unused = dataOf<ExpenseCategory>(
      await as(arjun)
        .post(CATEGORIES, { name: "Spare", icon: "package", costClass: "CAPITAL" })
        .expect(201),
    );
    await as(arjun).delete(`${CATEGORIES}/${unused.id}`).expect(204);
  });

  it("sums the overview: operating cost net of refunds, loan cash apart, cost per km", async () => {
    const car = await vehicle(arjun);
    const { today, lastMonth, month } = overviewPeriods(new Date());
    const sameYear = lastMonth.startsWith(month.slice(0, 4));
    await as(arjun)
      .post(EXPENSES, toll(car.id, { amount: "800", date: `${lastMonth}-01`, odometerKm: 8100 }))
      .expect(201);
    await as(arjun)
      .post(EXPENSES, toll(car.id, { amount: "640", date: today, odometerKm: 8600 }))
      .expect(201);
    const parking = dataOf<ExpenseDetail>(
      await as(arjun)
        .post(
          EXPENSES,
          toll(car.id, {
            title: "Phoenix Mall",
            amount: "360",
            date: today,
            subcategoryId: id("DAILY_USAGE.PARKING"),
          }),
        )
        .expect(201),
    );
    await as(arjun)
      .post(`${EXPENSES}/${parking.id}/refunds`, { amount: "60", date: today, reason: "REFUND" })
      .expect(201);
    await as(arjun)
      .post(
        EXPENSES,
        toll(car.id, {
          categoryId: id("FINANCE"),
          subcategoryId: id("FINANCE.EMI"),
          title: "HDFC Auto Loan",
          amount: "16684",
          date: today,
          principalAmount: "10950",
          interestAmount: "5734",
        }),
      )
      .expect(201);

    const summary = dataOf<ExpenseSummary>(
      await as(arjun).get(`${EXPENSES}/summary?vehicleId=${car.id}`).expect(200),
    );
    expect(summary).toMatchObject({
      month,
      operating: {
        thisMonth: "940.00", // 640 + 360 − 60
        lastMonth: "800.00",
        changePercent: 18,
        thisYear: sameYear ? "1740.00" : "940.00",
        monthsCovered: sameYear ? 2 : 1,
      },
      distanceKm: 500,
      costPerKm: "1.88", // 940 / 500: October's toll is at the first reading, not after it
      loanOutflowThisMonth: "16684.00",
      cashOutflowThisMonth: "17624.00",
    });
    expect(summary.categories).toEqual([
      {
        category: expect.objectContaining({ key: "DAILY_USAGE" }) as object,
        amount: "940.00",
        percent: 100,
      },
    ]);

    await as(priya).get(`${EXPENSES}/summary?vehicleId=${car.id}`).expect(404);
    const empty = dataOf<ExpenseSummary>(await as(priya).get(`${EXPENSES}/summary`).expect(200));
    expect(empty).toMatchObject({
      operating: { thisMonth: "0.00" },
      costPerKm: null,
      categories: [],
    });
  });

  it("keeps records consistent: retried saves, wildcards, refunds, shares and odometer order", async () => {
    const car = await vehicle(arjun);
    const other = await vehicle(arjun);
    const odometer = async (vehicleId: string) =>
      dataOf<Vehicle>(await as(arjun).get(`/api/v1/vehicles/${vehicleId}`).expect(200)).odometerKm;

    // A retried save (same client id) returns the expense it created, never a second one.
    const clientId = randomUUID();
    const body = toll(car.id, { id: clientId, title: "100%_off toll", date: "2026-11-10" });
    const first = dataOf<ExpenseDetail>(await as(arjun).post(EXPENSES, body).expect(201));
    expect(dataOf<ExpenseDetail>(await as(arjun).post(EXPENSES, body)).id).toBe(first.id);
    await as(arjun)
      .post(EXPENSES, toll(car.id, { title: "Plain toll", date: "2026-11-12" }))
      .expect(201);
    const listed = (search: string) =>
      as(arjun).get(`${EXPENSES}?vehicleId=${car.id}&search=${encodeURIComponent(search)}`);
    expect(metaOf(await listed(""))!.total).toBe(2);
    expect(metaOf(await listed("%"))!.total).toBe(1); // a literal %, not "anything"

    // Later edits can't break the refund rules.
    await as(arjun)
      .post(`${EXPENSES}/${first.id}/refunds`, {
        amount: "100",
        date: "2026-11-11",
        reason: "REFUND",
      })
      .expect(201);
    const later = await as(arjun)
      .patch(`${EXPENSES}/${first.id}`, { date: "2026-11-15" })
      .expect(409);
    expect(errorOf(later).details).toEqual([
      { field: "date", message: expect.stringContaining("refund dated earlier") as string },
    ]);
    await as(arjun)
      .patch(`${EXPENSES}/${first.id}`, {
        categoryId: id("FINANCE"),
        subcategoryId: id("FINANCE.INTEREST"),
        interestAmount: "640",
      })
      .expect(409);

    // A share of ₹0 is a validation error, not a database failure.
    await as(arjun)
      .post(
        EXPENSES,
        toll(car.id, {
          allocation: {
            mode: "shared",
            split: "custom",
            vehicles: [
              { vehicleId: car.id, amount: "0" },
              { vehicleId: other.id, amount: "640" },
            ],
          },
        }),
      )
      .expect(400);

    // One odometer history: out-of-order readings are refused; a corrected or moved one is undone.
    await as(arjun)
      .post(EXPENSES, toll(car.id, { date: "2026-11-20", odometerKm: 9000 }))
      .expect(201);
    const back = await as(arjun)
      .post(EXPENSES, toll(car.id, { date: "2026-11-25", odometerKm: 8800 }))
      .expect(409);
    expect(errorOf(back).details[0]).toMatchObject({ field: "odometerKm" });
    const typo = dataOf<ExpenseDetail>(
      await as(arjun)
        .post(EXPENSES, toll(car.id, { date: "2026-11-26", odometerKm: 92000 }))
        .expect(201),
    );
    expect(await odometer(car.id)).toBe(92000);
    await as(arjun).patch(`${EXPENSES}/${typo.id}`, { odometerKm: 9200 }).expect(200);
    expect(await odometer(car.id)).toBe(9200);
    await as(arjun)
      .patch(`${EXPENSES}/${typo.id}`, { allocation: { mode: "single", vehicleId: other.id } })
      .expect(200);
    expect(await odometer(car.id)).toBe(9000);
    expect(await odometer(other.id)).toBe(8000); // the reading stayed with its vehicle

    // Bulk actions treat a shared expense as one: an archived vehicle in it keeps it whole.
    const shared = dataOf<ExpenseDetail>(
      await as(arjun)
        .post(
          EXPENSES,
          toll(car.id, {
            title: "Shared wash",
            allocation: {
              mode: "shared",
              split: "equal",
              vehicles: [{ vehicleId: car.id }, { vehicleId: other.id }],
            },
          }),
        )
        .expect(201),
    );
    await as(arjun).post(`/api/v1/vehicles/${other.id}/archive`).expect(200);
    expect(
      dataOf<BulkResult>(
        await as(arjun)
          .post(`${EXPENSES}/bulk/delete`, { ids: [shared.id] })
          .expect(200),
      ),
    ).toEqual({ affected: 0, skipped: 1 });
    expect(
      dataOf<ExpenseDetail>(await as(arjun).get(`${EXPENSES}/${shared.id}`)).group,
    ).toHaveLength(2);
  });

  it("refuses a fill-up date that would put its expense after its refund", async () => {
    const car = await vehicle(arjun);
    const entries = `/api/v1/vehicles/${car.id}/fuel-entries`;
    const fill = (
      await as(arjun)
        .post(entries, {
          filledAt: "2026-11-05T08:00:00.000Z",
          odometerKm: 8400,
          fuelType: "PETROL",
          quantity: "32.4",
          pricePerUnit: "104.32",
          totalAmount: "3380",
          isFullTank: true,
        })
        .expect(201)
    ).body as ApiSuccessResponse<{ id: string }>;
    const [expense] = dataOf<Expense[]>(
      await as(arjun).get(`${EXPENSES}?vehicleId=${car.id}&source=FUEL`).expect(200),
    );
    await as(arjun)
      .post(`${EXPENSES}/${expense!.id}/refunds`, {
        amount: "50",
        date: "2026-11-06",
        reason: "REFUND",
      })
      .expect(201);
    await as(arjun)
      .patch(`${entries}/${fill.data.id}`, { filledAt: "2026-11-08T08:00:00.000Z" })
      .expect(409);
  });

  it("hides one user's expenses from another and keeps archived vehicles read-only", async () => {
    const car = await vehicle(arjun);
    const expense = dataOf<ExpenseDetail>(await as(arjun).post(EXPENSES, toll(car.id)).expect(201));

    await as(priya).get(`${EXPENSES}/${expense.id}`).expect(404);
    await as(priya).patch(`${EXPENSES}/${expense.id}`, { title: "x" }).expect(404);
    await as(priya).delete(`${EXPENSES}/${expense.id}`).expect(404);
    await as(priya).post(EXPENSES, toll(car.id)).expect(404);
    expect(dataOf<Expense[]>(await as(priya).get(EXPENSES).expect(200))).toEqual([]);

    await as(arjun).post(`/api/v1/vehicles/${car.id}/archive`).expect(200);
    await as(arjun).post(EXPENSES, toll(car.id)).expect(409);
    await as(arjun).patch(`${EXPENSES}/${expense.id}`, { title: "x" }).expect(409);
    await as(arjun).get(`${EXPENSES}/${expense.id}`).expect(200);
  });

  it("shows the monthly trend by chart group, net and without loan principal", async () => {
    const car = await vehicle(arjun);
    const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
    await as(arjun)
      .post(EXPENSES, {
        allocation: { mode: "single", vehicleId: car.id },
        categoryId: id("DAILY_USAGE"),
        subcategoryId: id("DAILY_USAGE.TOLL"),
        title: "Toll",
        amount: "640",
        date: today,
      })
      .expect(201);
    await as(arjun)
      .post(EXPENSES, {
        allocation: { mode: "single", vehicleId: car.id },
        categoryId: id("FINANCE"),
        subcategoryId: id("FINANCE.EMI"),
        title: "EMI",
        amount: "16607",
        principalAmount: "10607",
        interestAmount: "6000",
        date: today,
      })
      .expect(201);
    const trend = dataOf<ExpenseTrend>(
      await as(arjun).get(`${EXPENSES}/trend?vehicleId=${car.id}`).expect(200),
    );
    expect(trend.months).toHaveLength(12);
    expect(trend.months.at(-1)).toMatchObject({
      month: today.slice(0, 7),
      total: "6640.00",
      groups: { other: "640.00", loan: "6000.00" },
      lastYear: null,
    });
    expect(trend.previousTotal).toBeNull();
    await as(priya).get(`${EXPENSES}/trend?vehicleId=${car.id}`).expect(404);
  });
});
