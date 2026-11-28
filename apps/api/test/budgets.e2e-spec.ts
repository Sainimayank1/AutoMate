/**
 * Budgets (Expenses phase 5) through the real HTTP pipeline and database: spending counted like
 * "Spent" (net of refunds, loan principal left out), per vehicle, category and period. Users are
 * created under a throwaway domain and deleted afterwards.
 */
import { randomUUID } from "node:crypto";

import {
  type ApiErrorResponse,
  type ApiSuccessResponse,
  type Budget,
  type Expense,
  istToday,
  type PageMeta,
  type Vehicle,
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

const DOMAIN = "budgets.e2e.automate.test";
const BUDGETS = "/api/v1/expense-budgets";
const EXPENSES = "/api/v1/expenses";

describe("Budgets (e2e)", () => {
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
            email: `budgets-${randomUUID()}@${DOMAIN}`,
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

  const spend = async (car: string, values: Record<string, string>) =>
    dataOf<Expense>(
      await as(arjun)
        .post(EXPENSES, {
          allocation: { mode: "single", vehicleId: car },
          date: today,
          ...values,
        })
        .expect(201),
    );

  it("counts each budget's period like Spent: refunds off, loan principal out, one vehicle", async () => {
    const car = await vehicle(arjun);
    const other = await vehicle(arjun);
    const toll = await spend(car.id, {
      categoryId: id("DAILY_USAGE"),
      subcategoryId: id("DAILY_USAGE.TOLL"),
      title: "NH-48 FASTag",
      amount: "640",
    });
    await as(arjun)
      .post(`${EXPENSES}/${toll.id}/refunds`, { amount: "140", date: today, reason: "REFUND" })
      .expect(201);
    await spend(car.id, {
      categoryId: id("INSURANCE_LEGAL"),
      subcategoryId: id("INSURANCE_LEGAL.COMPREHENSIVE"),
      title: "ICICI Lombard",
      amount: "12000",
    });
    await spend(car.id, {
      categoryId: id("FINANCE"),
      subcategoryId: id("FINANCE.EMI"),
      title: "HDFC EMI",
      amount: "16607",
      principalAmount: "12129",
      interestAmount: "4478",
    });
    // Another vehicle's spending stays out.
    await spend(other.id, { categoryId: id("DAILY_USAGE"), title: "Parking", amount: "999" });

    const set = async (values: object) =>
      dataOf<Budget>(
        await as(arjun)
          .post(BUDGETS, { vehicleId: car.id, ...values })
          .expect(201),
      );
    const overall = await set({ amount: "20000" });
    const daily = await set({ categoryId: id("DAILY_USAGE"), amount: "400" });
    const insurance = await set({
      categoryId: id("INSURANCE_LEGAL"),
      period: "YEAR",
      amount: "20000",
      alertPercent: 90,
    });

    // 500 net tolls + 12,000 insurance + 4,478 interest (principal pays the loan down).
    expect(overall).toMatchObject({
      category: null,
      period: "MONTH",
      alertPercent: 80,
      spent: "16978.00",
      remaining: "3022.00",
      percent: 84,
      state: "WARNING",
      window: { from: `${today.slice(0, 7)}-01` },
    });
    expect(daily).toMatchObject({
      category: { key: "DAILY_USAGE" },
      spent: "500.00",
      remaining: "-100.00",
      percent: 125,
      state: "OVER",
    });
    expect(insurance).toMatchObject({
      period: "YEAR",
      spent: "12000.00",
      percent: 60,
      state: "ON_TRACK",
      window: { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` },
    });

    const page = await as(arjun).get(`${BUDGETS}?vehicleId=${car.id}&pageSize=2`).expect(200);
    expect(dataOf<Budget[]>(page).map((budget) => budget.id)).toEqual([overall.id, daily.id]);
    expect(metaOf(page)).toMatchObject({ page: 1, pageSize: 2, total: 3, totalPages: 2 });

    // A higher limit: back under it, but past the alert.
    const raised = await as(arjun).patch(`${BUDGETS}/${daily.id}`, { amount: "600" }).expect(200);
    expect(dataOf<Budget>(raised)).toMatchObject({
      spent: "500.00",
      percent: 83,
      state: "WARNING",
    });

    await as(arjun).delete(`${BUDGETS}/${daily.id}`).expect(204);
    await as(arjun).get(`${BUDGETS}/${daily.id}`).expect(404);
  });

  it("keeps one budget per vehicle and category, main categories only, and stays private", async () => {
    const car = await vehicle(arjun);
    await as(arjun).post(BUDGETS, { vehicleId: car.id, amount: "9000" }).expect(201);
    const twice = await as(arjun).post(BUDGETS, { vehicleId: car.id, amount: "5000" }).expect(409);
    expect((twice.body as ApiErrorResponse).message).toMatch(/already has an overall budget/);
    await as(arjun)
      .post(BUDGETS, { vehicleId: car.id, categoryId: id("FUEL"), amount: "6000" })
      .expect(201);
    await as(arjun)
      .post(BUDGETS, { vehicleId: car.id, categoryId: id("FUEL"), amount: "7000" })
      .expect(409);
    const sub = await as(arjun)
      .post(BUDGETS, { vehicleId: car.id, categoryId: id("DAILY_USAGE.TOLL"), amount: "500" })
      .expect(400);
    expect(errorOf(sub).details).toEqual([
      { field: "categoryId", message: "Choose a main category" },
    ]);
    const invalid = await as(arjun)
      .post(BUDGETS, { vehicleId: car.id, amount: "0", alertPercent: 120 })
      .expect(400);
    const fields = (errorOf(invalid).details as { field: string }[]).map((detail) => detail.field);
    expect(fields.sort()).toEqual(["alertPercent", "amount"]);

    // Someone else's vehicle and budgets are invisible.
    await as(priya).post(BUDGETS, { vehicleId: car.id, amount: "100" }).expect(404);
    await as(priya).get(`${BUDGETS}?vehicleId=${car.id}`).expect(404);
    const mine = dataOf<Budget[]>(
      await as(arjun).get(`${BUDGETS}?vehicleId=${car.id}`).expect(200),
    );
    await as(priya).get(`${BUDGETS}/${mine[0]!.id}`).expect(404);
    await as(priya).patch(`${BUDGETS}/${mine[0]!.id}`, { amount: "1" }).expect(404);
    await as(priya).delete(`${BUDGETS}/${mine[0]!.id}`).expect(404);
  });
});
