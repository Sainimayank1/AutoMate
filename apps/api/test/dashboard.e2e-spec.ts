/**
 * Dashboard API through the real HTTP pipeline and database (docker compose up -d). Users are
 * created under a throwaway domain and deleted afterwards (their vehicles cascade).
 */
import { randomUUID } from "node:crypto";

import {
  type ActivityItem,
  addDays,
  addMonths,
  type ApiErrorResponse,
  type ApiSuccessResponse,
  type DashboardLayout,
  type DashboardMetrics,
  type DashboardOverview,
  DEFAULT_DASHBOARD_LAYOUT,
  type FuelOverview,
  istToday,
  type PageMeta,
  ReportingPeriod,
  resolvePeriod,
  type SpendingOverview,
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

const DOMAIN = "dashboard.e2e.automate.test";
const OVERVIEW = "/api/v1/dashboard/overview";
const LAYOUT = "/api/v1/dashboard/layout";

describe("Dashboard (e2e)", () => {
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
            email: `dashboard-${randomUUID()}@${DOMAIN}`,
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

  const get = (token: string, url: string) =>
    request(app.getHttpServer()).get(url).auth(token, { type: "bearer" });
  const dataOf = <T>(res: request.Response) => (res.body as ApiSuccessResponse<T>).data;
  const errorOf = (res: request.Response) => (res.body as ApiErrorResponse).error;

  const post = (token: string, url: string, body: object) =>
    request(app.getHttpServer()).post(url).auth(token, { type: "bearer" }).send(body);

  async function vehicle(token: string, overrides: object = {}) {
    const res = await request(app.getHttpServer())
      .post("/api/v1/vehicles")
      .auth(token, { type: "bearer" })
      .send({
        make: "Maruti Suzuki",
        model: "Victoris",
        manufacturingYear: 2025,
        category: "SUV",
        registrationNumber: `HR26EV${Math.floor(1000 + Math.random() * 9000)}`,
        fuelType: "PETROL",
        transmission: "MANUAL",
        ownershipType: "OWNED",
        odometerKm: 8450,
        ...overrides,
      })
      .expect(201);
    return dataOf<Vehicle>(res);
  }

  it("returns the vehicle and the period with its like-for-like comparison window", async () => {
    const car = await vehicle(arjun);
    const overview = dataOf<DashboardOverview>(
      await get(arjun, `${OVERVIEW}?vehicleId=${car.id}`).expect(200),
    );
    expect(overview.vehicle).toMatchObject({ id: car.id, odometerKm: 8450 });
    expect(overview.period).toEqual(resolvePeriod(ReportingPeriod.THIS_MONTH, new Date()));
    expect(overview.period.endsToday).toBe(true);

    const custom = dataOf<DashboardOverview>(
      await get(
        arjun,
        `${OVERVIEW}?vehicleId=${car.id}&period=custom&from=2026-10-01&to=2026-10-10`,
      ).expect(200),
    );
    expect(custom.period).toMatchObject({
      period: "custom",
      from: "2026-10-01",
      to: "2026-10-10",
      previous: { from: "2026-09-21", to: "2026-09-30" },
    });
  });

  it("adds up the period from Fuel and Expenses and reads the status from real records", async () => {
    const car = await vehicle(arjun, {
      odometerKm: 4800,
      warrantyExpiryDate: "2028-03-14",
      warrantyKmLimit: 100000,
    });
    const { from, to, previous } = resolvePeriod(ReportingPeriod.THIS_MONTH, new Date());
    const fill = (filledAt: string, odometerKm: number, quantity: string) =>
      post(arjun, `/api/v1/vehicles/${car.id}/fuel-entries`, {
        filledAt,
        odometerKm,
        fuelType: "PETROL",
        quantity,
        pricePerUnit: "100",
        totalAmount: String(Number(quantity) * 100),
        isFullTank: true,
      }).expect(201);
    const ist = (date: string) => `${date}T00:01:00.000+05:30`;
    await fill(ist(previous.from), 5000, "30"); // last month: opens a full-tank cycle
    await fill(ist(from), 5400, "25"); // closes 400 km on 25 L
    await fill(new Date(Date.now() - 60_000).toISOString(), 5800, "20"); // closes 400 km on 20 L
    await post(arjun, "/api/v1/expenses", {
      allocation: { mode: "single", vehicleId: car.id },
      categoryId: keyed.get("DAILY_USAGE"),
      subcategoryId: keyed.get("DAILY_USAGE.TOLL"),
      title: "Delhi–Jaipur Expressway",
      amount: "640",
      date: to,
    }).expect(201);
    const policy = await post(arjun, "/api/v1/expenses", {
      allocation: { mode: "single", vehicleId: car.id },
      categoryId: keyed.get("INSURANCE_LEGAL"),
      subcategoryId: keyed.get("INSURANCE_LEGAL.COMPREHENSIVE"),
      title: "ICICI Lombard renewal",
      amount: "15000",
      date: previous.from,
      policyEnd: addDays(istToday(new Date()), 24),
    }).expect(201);

    const overview = dataOf<DashboardOverview>(
      await get(arjun, `${OVERVIEW}?vehicleId=${car.id}`).expect(200),
    );
    expect(overview.status).toEqual({
      state: "ok",
      data: {
        level: "attention",
        items: [
          {
            id: "insurance",
            severity: "warning",
            title: "Insurance expires in 24 days",
            detail: expect.stringMatching(/^From your insurance payment of /) as string,
            href: `/expenses/transactions/${dataOf<{ id: string }>(policy).id}`,
            source: "insurance",
            state: "due_soon",
            action: { label: "Add renewal", href: "/expenses/new" },
          },
          expect.objectContaining({
            id: "warranty",
            severity: "info",
            title: "Warranty valid until 14 Mar 2028 or 1,00,000 km",
          }) as object,
        ],
        untracked: ["maintenance", "documents"],
      },
    });
    expect(overview.metrics.state).toBe("ok");
    const metrics = (overview.metrics as { data: DashboardMetrics }).data;
    // This month: fuel 2,500 + 2,000 and a 640 toll. The same days of last month: fuel 3,000 and
    // a 15,000 insurance payment (a cost, but not running cost).
    expect(metrics.spent).toMatchObject({
      value: "5140.00",
      previous: "18000.00",
      changePercent: -71,
    });
    expect(metrics.fuelSpend).toMatchObject({
      value: "4500.00",
      previous: "3000.00",
      changePercent: 50,
      quantity: "45.00",
      unit: "L",
    });
    // 800 km on 45 L over two full-tank cycles; nothing closed last month.
    expect(metrics.mileage).toMatchObject({
      value: "17.78",
      previous: null,
      cycles: 2,
      unit: "km/L",
    });
    // Odometer 5,000 (before) → 5,800: 800 km; running cost 5,140 ÷ 800.
    expect(metrics.distance).toMatchObject({ value: "800", previous: null });
    expect(metrics.runningCostPerKm).toMatchObject({ value: "6.43", previous: null });

    // Spending: the period by category, and the months around it in the five chart series.
    const spending = (overview.spending as { data: SpendingOverview }).data;
    expect(spending.total).toBe("5140.00");
    expect(
      spending.categories.map((item) => [item.category.key, item.amount, item.percent]),
    ).toEqual([
      ["FUEL", "4500.00", 87.5],
      ["DAILY_USAGE", "640.00", 12.5],
    ]);
    expect(spending.months).toHaveLength(6);
    expect(spending.months.at(-1)).toMatchObject({
      month: from.slice(0, 7),
      groups: { fuel: "4500.00", other: "640.00", insurance: "0.00" },
    });
    expect(spending.months.at(-2)).toMatchObject({
      month: previous.from.slice(0, 7),
      groups: { fuel: "3000.00", insurance: "15000.00" },
    });

    // Fuel: the engine's cycles in the period, priced over its fill-ups.
    expect(overview.fuel).toMatchObject({
      state: "ok",
      data: {
        averageMileage: "17.78",
        cycles: 2,
        quantity: "45.00",
        spend: "4500.00",
        averagePrice: "100.00",
        costPerKm: "5.63", // 4,500 ÷ 800 km over the two cycles
        latestMileage: { mileage: "20.00" },
      },
    });
    expect(
      (overview.fuel as { data: FuelOverview }).data.trend.map((point) => point.mileage),
    ).toEqual(["16.00", "20.00"]);

    // Expiry dates: the insurance policy from its payment, the warranty from the vehicle.
    expect(overview.expiries).toMatchObject({
      state: "ok",
      data: [
        { id: "insurance", state: "expiring", summary: "Expires in 24 days" },
        { id: "warranty", state: "valid", summary: "Valid until 14 Mar 2028 or 1,00,000 km" },
      ],
    });
    // Driving from odometer readings: 5,000 before the period, 5,800 today.
    expect(overview.driving).toMatchObject({
      state: "ok",
      data: { distanceKm: 800, readings: 2, lastReading: { km: 5800 } },
    });
    // No schedule and no service record yet.
    expect(overview.maintenance).toEqual({ state: "empty" });
    // Insights: spending fell (last month had the insurance payment); fuel and distance have
    // nothing to compare with yet, and say so.
    expect(overview.insights).toEqual({
      state: "ok",
      data: {
        items: [
          expect.objectContaining({
            id: "spending_change",
            tone: "positive",
            title: "Spending is down 71%",
            explanation: expect.stringMatching(
              /^₹5,140\.00 so far against ₹18,000\.00\. .+ fell the most: −₹15,000\.00\.$/,
            ) as string,
            comparedWith: previous,
          }) as object,
        ],
        needs: ["fuel_cycles", "odometer"],
      },
    });
  });

  it("shows maintenance from the Maintenance module, and counts it as tracked", async () => {
    const car = await vehicle(arjun, { odometerKm: 8450 });
    const schedule = dataOf<{ id: string }>(
      await post(arjun, `/api/v1/vehicles/${car.id}/maintenance-schedules`, {
        name: "Engine oil & filter",
        categoryKey: "ENGINE.ENGINE_OIL",
        intervalKm: "1,000",
        intervalMonths: 12,
        lastDoneDate: addDays(istToday(new Date()), -30),
        lastDoneKm: 7000,
      }).expect(201),
    );
    const overview = dataOf<DashboardOverview>(
      await get(arjun, `${OVERVIEW}?vehicleId=${car.id}`).expect(200),
    );
    // Due at 8,000 km; the odometer reads 8,450.
    expect(overview.maintenance).toMatchObject({
      state: "ok",
      data: { overdue: 1, dueSoon: 0, schedules: [{ id: schedule.id }], lastService: null },
    });
    expect(overview.status).toMatchObject({
      state: "ok",
      data: {
        level: "attention",
        items: [{ id: `maintenance:${schedule.id}`, severity: "critical" }],
        untracked: ["documents"],
      },
    });
  });

  it("lists what happened, newest first, a page at a time, never a service twice", async () => {
    const car = await vehicle(arjun, { odometerKm: 8000 });
    const today = istToday(new Date());
    await post(arjun, `/api/v1/vehicles/${car.id}/fuel-entries`, {
      filledAt: `${addDays(today, -3)}T00:01:00.000+05:30`,
      odometerKm: 8100,
      fuelType: "PETROL",
      quantity: "30",
      pricePerUnit: "100",
      totalAmount: "3000",
      isFullTank: true,
    }).expect(201);
    const toll = dataOf<{ id: string }>(
      await post(arjun, "/api/v1/expenses", {
        allocation: { mode: "single", vehicleId: car.id },
        categoryId: keyed.get("DAILY_USAGE"),
        subcategoryId: keyed.get("DAILY_USAGE.TOLL"),
        title: "Kherki Daula FASTag",
        amount: "640",
        date: addDays(today, -2),
      }).expect(201),
    );
    await post(arjun, `/api/v1/expenses/${toll.id}/refunds`, {
      amount: "140",
      date: today,
      reason: "REFUND",
    }).expect(201);
    const service = dataOf<{ id: string }>(
      await post(arjun, `/api/v1/vehicles/${car.id}/service-records`, {
        type: "ROUTINE_SERVICE",
        title: "Periodic service",
        categoryKey: "GENERAL.PERIODIC_SERVICE",
        serviceDate: today,
        odometerKm: 8300,
        labourAmount: "1200",
        partsAmount: "1450",
        paymentMethod: "UPI",
      }).expect(201),
    );

    const page = (n: number) =>
      get(arjun, `/api/v1/dashboard/activity?vehicleId=${car.id}&page=${n}&pageSize=3`).expect(200);
    const first = await page(1);
    // The service's own expense isn't listed: 3 money events + 1 service.
    expect((first.body as ApiSuccessResponse<ActivityItem[], PageMeta>).meta).toMatchObject({
      total: 4,
      totalPages: 2,
    });
    expect(dataOf<ActivityItem[]>(first).map((item) => [item.kind, item.href])).toEqual([
      ["service", `/maintenance/records/${car.id}/${service.id}`],
      ["refund", `/expenses/transactions/${toll.id}`],
      ["expense", `/expenses/transactions/${toll.id}`],
    ]);
    expect(dataOf<ActivityItem[]>(await page(2))).toMatchObject([
      { kind: "fuel", detail: "30 L at ₹100/L", odometerKm: 8100, amount: "3000.00" },
    ]);
    await get(priya, `/api/v1/dashboard/activity?vehicleId=${car.id}`).expect(404);
  });

  it("puts overdue recurring payments in the action centre, with the action to record them", async () => {
    const car = await vehicle(arjun);
    const due = addMonths(istToday(new Date()), -1);
    const schedule = await post(arjun, "/api/v1/recurring-expenses", {
      vehicleId: car.id,
      title: "Society parking pass",
      amount: "1500",
      categoryId: keyed.get("DAILY_USAGE"),
      subcategoryId: keyed.get("DAILY_USAGE.PARKING"),
      every: 1,
      unit: "YEAR",
      startDate: due,
    }).expect(201);
    const id = dataOf<{ id: string }>(schedule).id;
    // As if it had been added before that due date (earlier ones aren't owed).
    await app.get(PrismaService).recurringExpense.update({
      where: { id },
      data: { activeFrom: new Date(`${due}T00:00:00.000Z`) },
    });
    const overview = dataOf<DashboardOverview>(
      await get(arjun, `${OVERVIEW}?vehicleId=${car.id}`).expect(200),
    );
    expect(overview.status).toMatchObject({
      state: "ok",
      data: {
        level: "attention",
        items: [
          {
            id: `payment:${id}:${due}`,
            source: "payment",
            state: "overdue",
            title: "Society parking pass is overdue",
            action: { label: "Record payment", href: `/expenses/recurring?pay=${id}&due=${due}` },
          },
        ],
      },
    });

    // A loan's next EMI is a key figure, whatever the period (once there are figures).
    const first = addMonths(istToday(new Date()), 1);
    const loan = dataOf<{ id: string }>(
      await post(arjun, "/api/v1/vehicle-loans", {
        vehicleId: car.id,
        lender: "HDFC Bank",
        principal: "120000",
        annualRate: "9",
        tenureMonths: 12,
        firstEmiDate: first,
      }).expect(201),
    );
    await post(arjun, "/api/v1/expenses", {
      allocation: { mode: "single", vehicleId: car.id },
      categoryId: keyed.get("DAILY_USAGE"),
      subcategoryId: keyed.get("DAILY_USAGE.TOLL"),
      title: "Toll",
      amount: "100",
      date: istToday(new Date()),
    }).expect(201);
    const after = dataOf<DashboardOverview>(
      await get(arjun, `${OVERVIEW}?vehicleId=${car.id}`).expect(200),
    );
    expect(after.metrics).toMatchObject({
      state: "ok",
      data: {
        nextEmi: {
          loanId: loan.id,
          date: first,
          amount: "10494.00",
          state: "SCHEDULED",
          number: 1,
          of: 12,
        },
      },
    });
  });

  it("has no figures for a vehicle with nothing recorded, but still a status", async () => {
    const car = await vehicle(arjun);
    const overview = dataOf<DashboardOverview>(
      await get(arjun, `${OVERVIEW}?vehicleId=${car.id}`).expect(200),
    );
    expect(overview.metrics).toEqual({ state: "empty" });
    expect(overview.spending).toEqual({ state: "empty" });
    expect(overview.fuel).toEqual({ state: "empty" });
    expect(overview.insights).toEqual({
      state: "ok",
      data: { items: [], needs: ["expenses", "fuel_cycles", "odometer"] },
    });
    expect(overview.status).toMatchObject({
      state: "ok",
      data: { level: "incomplete", items: [] },
    });
  });

  it("validates the period and keeps vehicles private", async () => {
    const car = await vehicle(arjun);
    const missing = await get(arjun, `${OVERVIEW}?vehicleId=${car.id}&period=custom`).expect(400);
    expect(errorOf(missing).details).toMatchObject([{ field: "from" }, { field: "to" }]);
    const backwards = await get(
      arjun,
      `${OVERVIEW}?vehicleId=${car.id}&period=custom&from=2026-10-10&to=2026-10-01`,
    ).expect(400);
    expect(errorOf(backwards).details).toEqual([{ field: "to", message: "Ends before it starts" }]);
    const tomorrow = addDays(istToday(new Date()), 1);
    const future = await get(
      arjun,
      `${OVERVIEW}?vehicleId=${car.id}&period=custom&from=2026-10-01&to=${tomorrow}`,
    ).expect(400);
    expect(errorOf(future).details).toEqual([
      { field: "to", message: "This date is in the future" },
    ]);
    await get(arjun, `${OVERVIEW}?vehicleId=${car.id}&period=fortnight`).expect(400);
    await get(arjun, OVERVIEW).expect(400);
    await get(priya, `${OVERVIEW}?vehicleId=${car.id}`).expect(404);
  });

  it("saves each user's own layout, validates it and resets to the default", async () => {
    const put = (token: string, body: object) =>
      request(app.getHttpServer()).put(LAYOUT).auth(token, { type: "bearer" }).send(body);
    const layoutOf = (res: request.Response) => dataOf<DashboardLayout>(res);
    const fresh = arjun; // no other test saves a layout
    expect(layoutOf(await get(fresh, LAYOUT).expect(200))).toEqual(DEFAULT_DASHBOARD_LAYOUT);

    const mine: DashboardLayout = {
      widgets: [...DEFAULT_DASHBOARD_LAYOUT.widgets]
        .reverse()
        .map((widget) => ({ ...widget, visible: widget.id !== "spending" })),
      metrics: ["fuelSpend", "spent"],
    };
    const saved = layoutOf(await put(fresh, mine).expect(200));
    // Stored in canonical form: the key figures in their fixed order.
    expect(saved).toEqual({ ...mine, metrics: ["spent", "fuelSpend"] });
    expect(layoutOf(await get(fresh, LAYOUT).expect(200))).toEqual(saved);
    // Someone else's layout is untouched.
    expect(layoutOf(await get(priya, LAYOUT).expect(200))).toEqual(DEFAULT_DASHBOARD_LAYOUT);

    const invalid = await put(fresh, { ...mine, metrics: [] }).expect(400);
    expect(errorOf(invalid).details).toEqual([
      { field: "metrics", message: "Choose at least one key figure" },
    ]);
    await put(fresh, { ...mine, widgets: mine.widgets.slice(1) }).expect(400);
    await put(fresh, { ...mine, widgets: [{ id: "weather", visible: true }] }).expect(400);
    expect(layoutOf(await get(fresh, LAYOUT).expect(200))).toEqual(saved);

    await put(fresh, DEFAULT_DASHBOARD_LAYOUT).expect(200);
    expect(layoutOf(await get(fresh, LAYOUT).expect(200))).toEqual(DEFAULT_DASHBOARD_LAYOUT);
    await request(app.getHttpServer()).get(LAYOUT).expect(401);
  });
});
