/**
 * Analytics (M8) through the real HTTP pipeline and database: every vehicle's ownership figures
 * side by side and the fleet's totals. Users are created under a throwaway domain and deleted
 * afterwards.
 */
import { randomUUID } from "node:crypto";

import {
  addMonths,
  type AnalyticsOverview,
  type ApiSuccessResponse,
  istToday,
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

const DOMAIN = "analytics.e2e.automate.test";
const EXPENSES = "/api/v1/expenses";

describe("Analytics (e2e)", () => {
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
            email: `analytics-${randomUUID()}@${DOMAIN}`,
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
  const id = (key: string) => keyed.get(key)!;

  async function vehicle(token: string, extra: object = {}) {
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
        ...extra,
      })
      .expect(201);
    return dataOf<Vehicle>(res);
  }

  const spend = (car: string, values: Record<string, string>) =>
    as(arjun)
      .post(EXPENSES, { allocation: { mode: "single", vehicleId: car }, date: today, ...values })
      .expect(201);

  it("puts every vehicle side by side and adds the fleet up", async () => {
    const purchased = addMonths(today, -12);
    const victoris = await vehicle(arjun, { purchasePrice: "1145000", purchaseDate: purchased });
    const creta = await vehicle(arjun, { make: "Hyundai", model: "Creta" });
    await spend(victoris.id, {
      categoryId: id("MAINTENANCE"),
      title: "Periodic service",
      amount: "2650",
    });
    await spend(victoris.id, { categoryId: id("DAILY_USAGE"), title: "Toll", amount: "640" });
    await spend(creta.id, { categoryId: id("DAILY_USAGE"), title: "Parking", amount: "360" });
    await spend(creta.id, {
      categoryId: id("FINANCE"),
      subcategoryId: id("FINANCE.EMI"),
      title: "EMI",
      amount: "16607",
      principalAmount: "12129",
      interestAmount: "4478",
    });

    const overview = dataOf<AnalyticsOverview>(
      await as(arjun).get("/api/v1/analytics/overview?period=all_time").expect(200),
    );
    expect(overview.window.from).toBe(purchased);
    const byMake = new Map(overview.vehicles.map((row) => [row.name.split(" ")[0]!, row]));
    expect(byMake.get("Maruti")).toMatchObject({
      serviceSpend: "2650.00",
      mileage: null,
      ownership: { economic: "175040.00", depreciation: { amount: "171750.00" } },
    });
    expect(byMake.get("Hyundai")).toMatchObject({
      serviceSpend: "0.00",
      ownership: { economic: "4838.00", cashOutflow: "16967.00", depreciation: null },
    });
    // 2,650 + 640 + 360 + 4,478 interest spent; principal is cash only.
    expect(overview.totals).toMatchObject({
      spent: "8128.00",
      economic: "179878.00",
      cashOutflow: "20257.00",
      principal: "12129.00",
      depreciation: "171750.00",
      estimatedValue: "973250.00",
      distanceKm: null,
      costPerKm: null,
      mileage: null,
    });
    // Spending merged per category across vehicles.
    const daily = overview.spending.categories.find((row) => row.category.key === "DAILY_USAGE");
    expect(daily).toMatchObject({ amount: "1000.00" });
    expect(overview.spending.total).toBe("8128.00");

    // Someone else's garage is theirs alone.
    const theirs = dataOf<AnalyticsOverview>(
      await as(priya).get("/api/v1/analytics/overview").expect(200),
    );
    expect(theirs.vehicles).toEqual([]);
    await as(arjun).get("/api/v1/analytics/overview?period=custom").expect(400);
  });
});
