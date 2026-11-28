/**
 * Maintenance API through the real HTTP pipeline and database (docker compose up -d).
 * Users are created under a throwaway domain and deleted afterwards (everything cascades).
 */
import { randomUUID } from "node:crypto";

import {
  addDays,
  type ApiErrorResponse,
  type ApiSuccessResponse,
  type Inspection,
  istToday,
  type MaintenanceAnalytics,
  type MaintenanceOverview,
  type MaintenanceProvider,
  type MaintenanceSchedule,
  type PageMeta,
  type ProviderProfile,
  type ServiceRecord,
  type Vehicle,
  type VehicleComponent,
  type VehicleComponentDetail,
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

const DOMAIN = "maintenance.e2e.automate.test";

describe("Maintenance (e2e)", () => {
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
            email: `maintenance-${randomUUID()}@${DOMAIN}`,
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

  async function vehicle(token: string, odometerKm = 8000) {
    const plate = `KA${Math.floor(10 + Math.random() * 89)}MT${Math.floor(1000 + Math.random() * 9000)}`;
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
        odometerKm,
      })
      .expect(201);
    return dataOf<Vehicle>(res);
  }
  const schedules = (vehicleId: string) => `/api/v1/vehicles/${vehicleId}/maintenance-schedules`;
  const oil = (overrides: object = {}) => ({
    name: "Engine oil & filter",
    categoryKey: "ENGINE.ENGINE_OIL",
    intervalKm: "10,000",
    intervalMonths: 12,
    ...overrides,
  });

  it("adds a repeating schedule counted from the current odometer, once per client id", async () => {
    const car = await vehicle(arjun);
    const id = randomUUID();
    const created = dataOf<MaintenanceSchedule>(
      await as(arjun).post(schedules(car.id), oil({ id })).expect(201),
    );
    expect(created).toMatchObject({
      id,
      intervalKm: 10_000,
      addedOdometerKm: 8000,
      remindersEnabled: true,
      priority: "NORMAL",
      due: {
        status: "UP_TO_DATE",
        distance: { fromKm: 8000, basis: "ADDED", nextDueKm: 18_000, kmRemaining: 10_000 },
        date: { from: today, basis: "ADDED" },
      },
    });
    // A retried save returns the same schedule instead of adding another.
    await as(arjun)
      .post(schedules(car.id), oil({ id, name: "Retry" }))
      .expect(201);
    const list = await as(arjun).get(schedules(car.id)).expect(200);
    expect(dataOf<MaintenanceSchedule[]>(list).map((item) => item.name)).toEqual([
      "Engine oil & filter",
    ]);
    expect(metaOf(list)).toEqual({ page: 1, pageSize: 20, total: 1, totalPages: 1 });
  });

  it("refuses a schedule that neither repeats nor has a due, or does both", async () => {
    const car = await vehicle(arjun);
    const neither = await as(arjun)
      .post(schedules(car.id), oil({ intervalKm: "", intervalMonths: null }))
      .expect(400);
    expect(errorOf(neither).details).toContainEqual(
      expect.objectContaining({ field: "intervalKm" }),
    );
    const both = await as(arjun)
      .post(schedules(car.id), oil({ dueDate: addDays(today, 30) }))
      .expect(400);
    expect(errorOf(both).details).toContainEqual(expect.objectContaining({ field: "dueDate" }));
  });

  it("refuses a last done reading above the vehicle's odometer", async () => {
    const car = await vehicle(arjun);
    const res = await as(arjun)
      .post(schedules(car.id), oil({ lastDoneKm: 9000 }))
      .expect(409);
    expect(errorOf(res).details).toEqual([expect.objectContaining({ field: "lastDoneKm" })]);
  });

  it("merges a PATCH onto the stored schedule and re-checks it whole", async () => {
    const car = await vehicle(arjun);
    const { id } = dataOf<MaintenanceSchedule>(
      await as(arjun).post(schedules(car.id), oil()).expect(201),
    );
    // Adding a one-time due to a repeating schedule is refused…
    await as(arjun)
      .patch(`${schedules(car.id)}/${id}`, { dueKm: 12_000 })
      .expect(400);
    // …but turning it into a one-time schedule (clearing the intervals) works.
    const changed = dataOf<MaintenanceSchedule>(
      await as(arjun)
        .patch(`${schedules(car.id)}/${id}`, {
          intervalKm: null,
          intervalMonths: null,
          dueKm: 8300,
        })
        .expect(200),
    );
    expect(changed).toMatchObject({
      name: "Engine oil & filter",
      intervalKm: null,
      due: { status: "DUE", distance: { basis: "FIXED", kmRemaining: 300 } },
    });
  });

  it("pauses and resumes idempotently, keeping the figures", async () => {
    const car = await vehicle(arjun);
    const { id } = dataOf<MaintenanceSchedule>(
      await as(arjun).post(schedules(car.id), oil()).expect(201),
    );
    await as(arjun)
      .post(`${schedules(car.id)}/${id}/pause`)
      .expect(200);
    const paused = dataOf<MaintenanceSchedule>(
      await as(arjun)
        .post(`${schedules(car.id)}/${id}/pause`)
        .expect(200),
    );
    expect(paused.pausedAt).not.toBeNull();
    expect(paused.due).toMatchObject({ status: "PAUSED", distance: { kmRemaining: 10_000 } });
    const resumed = dataOf<MaintenanceSchedule>(
      await as(arjun)
        .post(`${schedules(car.id)}/${id}/resume`)
        .expect(200),
    );
    expect(resumed).toMatchObject({ pausedAt: null, due: { status: "UP_TO_DATE" } });
  });

  it("filters by computed status and searches name and category, most urgent first", async () => {
    const car = await vehicle(arjun);
    await as(arjun).post(schedules(car.id), oil()).expect(201);
    await as(arjun)
      .post(schedules(car.id), {
        name: "Pads check",
        categoryKey: "BRAKES.INSPECTION",
        dueKm: 7900,
      })
      .expect(201);
    await as(arjun)
      .post(schedules(car.id), {
        name: "Rotate",
        categoryKey: "TYRES.ROTATION",
        dueDate: addDays(today, 3),
      })
      .expect(201);
    const all = dataOf<MaintenanceSchedule[]>(await as(arjun).get(schedules(car.id)).expect(200));
    expect(all.map((item) => item.name)).toEqual(["Pads check", "Rotate", "Engine oil & filter"]);
    const overdue = await as(arjun)
      .get(`${schedules(car.id)}?status=OVERDUE`)
      .expect(200);
    expect(dataOf<MaintenanceSchedule[]>(overdue).map((item) => item.name)).toEqual(["Pads check"]);
    const byCategory = await as(arjun)
      .get(`${schedules(car.id)}?search=tyre`)
      .expect(200);
    expect(dataOf<MaintenanceSchedule[]>(byCategory).map((item) => item.name)).toEqual(["Rotate"]);
  });

  it("builds the overview from schedules and from Expenses' maintenance spending", async () => {
    const car = await vehicle(arjun);
    const overviewUrl = `/api/v1/vehicles/${car.id}/maintenance-overview`;
    const empty = dataOf<MaintenanceOverview>(await as(arjun).get(overviewUrl).expect(200));
    expect(empty).toMatchObject({ state: "INCOMPLETE", overdue: [], next: null });
    expect(empty.spend.total).toBe("0.00");
    // 12 rolling months touch 13 calendar months (both ends partial).
    expect(empty.spend.months).toHaveLength(13);

    await as(arjun).post(schedules(car.id), oil()).expect(201);
    await as(arjun)
      .post(schedules(car.id), {
        name: "Pads check",
        categoryKey: "BRAKES.INSPECTION",
        dueKm: 7900,
      })
      .expect(201);
    const expense = (categoryKey: string, amount: string) =>
      as(arjun)
        .post("/api/v1/expenses", {
          allocation: { mode: "single", vehicleId: car.id },
          categoryId: keyed.get(categoryKey),
          title: categoryKey,
          amount,
          date: today,
        })
        .expect(201);
    const service = dataOf<{ id: string }>(await expense("MAINTENANCE", "6850.50"));
    await expense("REPAIRS", "1200");
    await expense("DAILY_USAGE", "640"); // not maintenance
    await as(arjun)
      .post(`/api/v1/expenses/${service.id}/refunds`, {
        amount: "350.50",
        date: today,
        reason: "REFUND",
      })
      .expect(201);

    const overview = dataOf<MaintenanceOverview>(await as(arjun).get(overviewUrl).expect(200));
    expect(overview).toMatchObject({
      odometerKm: 8000,
      state: "OVERDUE",
      counts: { OVERDUE: 1, UP_TO_DATE: 1 },
      upcoming: [],
      next: { name: "Engine oil & filter" },
      spend: {
        total: "7700.00",
        maintenance: "6500.00",
        repairs: "1200.00",
        previousTotal: "0.00",
      },
    });
    expect(overview.overdue.map((item) => item.name)).toEqual(["Pads check"]);
    expect(overview.spend.months.at(-1)).toEqual({
      month: today.slice(0, 7),
      maintenance: "6500.00",
      repairs: "1200.00",
    });
  });

  it("keeps each user's maintenance private and archived vehicles read-only", async () => {
    const car = await vehicle(arjun);
    const { id } = dataOf<MaintenanceSchedule>(
      await as(arjun).post(schedules(car.id), oil()).expect(201),
    );
    await as(priya).get(schedules(car.id)).expect(404);
    await as(priya)
      .get(`${schedules(car.id)}/${id}`)
      .expect(404);
    await as(priya).get(`/api/v1/vehicles/${car.id}/maintenance-overview`).expect(404);
    const hers = await vehicle(priya);
    await as(priya)
      .get(`${schedules(hers.id)}/${id}`)
      .expect(404);
    await as(priya)
      .delete(`${schedules(hers.id)}/${id}`)
      .expect(404);

    await as(arjun).post(`/api/v1/vehicles/${car.id}/archive`).expect(200);
    await as(arjun).post(schedules(car.id), oil()).expect(409);
    await as(arjun)
      .post(`${schedules(car.id)}/${id}/pause`)
      .expect(409);
    await as(arjun).get(schedules(car.id)).expect(200);
  });

  it("deletes a schedule", async () => {
    const car = await vehicle(arjun);
    const { id } = dataOf<MaintenanceSchedule>(
      await as(arjun).post(schedules(car.id), oil()).expect(201),
    );
    await as(arjun)
      .delete(`${schedules(car.id)}/${id}`)
      .expect(204);
    await as(arjun)
      .get(`${schedules(car.id)}/${id}`)
      .expect(404);
  });

  describe("service records", () => {
    const records = (vehicleId: string) => `/api/v1/vehicles/${vehicleId}/service-records`;
    const service = (overrides: object = {}) => ({
      type: "ROUTINE_SERVICE",
      title: "2nd free periodic service",
      categoryKey: "GENERAL.PERIODIC_SERVICE",
      serviceDate: today,
      odometerKm: 8100,
      providerName: "Maruti Arena Service, Gurugram",
      labourAmount: "1200",
      partsAmount: "4800",
      taxAmount: "1350",
      discountAmount: "500",
      paymentMethod: "UPI",
      ...overrides,
    });
    const expenseOf = async (token: string, id: string) =>
      dataOf<{
        amount: string;
        source: string;
        category: { key: string };
        subcategory: { key: string } | null;
      }>(await as(token).get(`/api/v1/expenses/${id}`).expect(200));

    it("logs a service that completes a schedule, keeps its money in Expenses and raises the odometer", async () => {
      const car = await vehicle(arjun, 8000);
      const oilSchedule = dataOf<MaintenanceSchedule>(
        await as(arjun).post(schedules(car.id), oil()).expect(201),
      );
      const id = randomUUID();
      const created = dataOf<ServiceRecord>(
        await as(arjun)
          .post(
            records(car.id),
            service({
              id,
              odometerKm: 8450,
              items: [{ name: "Engine oil 0W-20", scheduleId: oilSchedule.id }],
            }),
          )
          .expect(201),
      );
      expect(created).toMatchObject({
        id,
        totalAmount: "6850.00",
        provider: { name: "Maruti Arena Service, Gurugram" },
        items: [
          {
            name: "Engine oil 0W-20",
            scheduleId: oilSchedule.id,
            scheduleName: "Engine oil & filter",
          },
        ],
      });
      // A retried save returns the same record.
      await as(arjun)
        .post(records(car.id), service({ id, odometerKm: 8450 }))
        .expect(201);
      expect(metaOf(await as(arjun).get(records(car.id)).expect(200))?.total).toBe(1);

      const expense = await expenseOf(arjun, created.expenseId!);
      expect(expense).toMatchObject({
        amount: "6850.00",
        source: "MAINTENANCE",
        category: { key: "MAINTENANCE" },
        subcategory: { key: "MAINTENANCE.GENERAL_SERVICE" },
      });
      // Edited in Maintenance only.
      await as(arjun).patch(`/api/v1/expenses/${created.expenseId}`, { title: "x" }).expect(409);

      const completed = dataOf<MaintenanceSchedule>(
        await as(arjun)
          .get(`${schedules(car.id)}/${oilSchedule.id}`)
          .expect(200),
      );
      expect(completed.due.distance).toMatchObject({
        basis: "COMPLETION",
        fromKm: 8450,
        nextDueKm: 18_450,
      });
      expect(completed.due.date).toMatchObject({ basis: "COMPLETION", from: today });
      const history = await as(arjun)
        .get(`${records(car.id)}?scheduleId=${oilSchedule.id}`)
        .expect(200);
      expect(dataOf<ServiceRecord[]>(history).map((record) => record.id)).toEqual([id]);
      expect(
        dataOf<Vehicle>(await as(arjun).get(`/api/v1/vehicles/${car.id}`).expect(200)).odometerKm,
      ).toBe(8450);

      const overview = dataOf<MaintenanceOverview>(
        await as(arjun).get(`/api/v1/vehicles/${car.id}/maintenance-overview`).expect(200),
      );
      expect(overview).toMatchObject({
        recordCount: 1,
        recent: [{ id }],
        spend: { maintenance: "6850.00" },
      });
    });

    it("builds analytics from Expenses and records, with planned estimates never counted as spend", async () => {
      const car = await vehicle(arjun, 8000);
      await as(arjun)
        .post(records(car.id), service({ serviceDate: addDays(today, -40), odometerKm: 8100 }))
        .expect(201);
      await as(arjun)
        .post(
          records(car.id),
          service({
            type: "REPAIR",
            title: "AC compressor",
            categoryKey: "AC.SERVICE",
            serviceDate: addDays(today, -10),
            odometerKm: 9100,
          }),
        )
        .expect(201);
      const planned = dataOf<MaintenanceSchedule>(
        await as(arjun)
          .post(schedules(car.id), {
            name: "Replace tyres",
            categoryKey: "TYRES.REPLACEMENT",
            dueKm: 45_000,
            estimatedCost: "24000",
          })
          .expect(201),
      );
      expect(planned.estimatedCost).toBe("24000.00");
      await as(arjun)
        .post(schedules(car.id), {
          name: "Wiper blades",
          categoryKey: "OTHER.OTHER",
          dueKm: 20_000,
        })
        .expect(201);
      await as(arjun).post(schedules(car.id), oil()).expect(201);
      expect(
        dataOf<unknown>(
          await as(arjun).get(`/api/v1/vehicles/${car.id}/maintenance-plan`).expect(200),
        ),
      ).toEqual({ open: 2, estimatedTotal: "24000.00", withoutEstimate: 1 });
      const once = await as(arjun)
        .get(`${schedules(car.id)}?once=true`)
        .expect(200);
      expect(
        dataOf<MaintenanceSchedule[]>(once)
          .map((item) => item.name)
          .sort(),
      ).toEqual(["Replace tyres", "Wiper blades"]);

      const analytics = dataOf<MaintenanceAnalytics>(
        await as(arjun).get(`/api/v1/vehicles/${car.id}/maintenance-analytics`).expect(200),
      );
      expect(analytics.totals).toMatchObject({
        spend: "13700.00",
        services: 2,
        repairVisits: 1,
        averagePerService: "6850.00",
      });
      // Today back to the same day a year ago: 13 calendar months, as on the Overview.
      expect(analytics.months).toHaveLength(13);
      expect(analytics.frequency).toEqual({ averageDays: 30, averageKm: 1000, intervals: 1 });
      expect(analytics.categories.map((row) => row.percent).reduce((a, b) => a + b, 0)).toBe(100);
      expect(analytics.insights).toContain(
        "On average, 30 days and 1,000 km passed between services.",
      );
      await as(arjun)
        .get(`/api/v1/vehicles/${car.id}/maintenance-analytics?period=last_month`)
        .expect(400);
      await as(priya).get(`/api/v1/vehicles/${car.id}/maintenance-analytics`).expect(404);
    });

    it("applies a reviewed template in one go, or not at all", async () => {
      const car = await vehicle(arjun, 8000);
      const bulk = `${schedules(car.id)}/bulk`;
      const made = dataOf<MaintenanceSchedule[]>(
        await as(arjun)
          .post(bulk, {
            schedules: [
              {
                name: "Engine oil & filter",
                categoryKey: "ENGINE.ENGINE_OIL",
                intervalKm: 10_000,
                intervalMonths: 12,
              },
              { name: "Cabin filter", categoryKey: "AC.CABIN_FILTER", intervalKm: 15_000 },
            ],
          })
          .expect(201),
      );
      expect(made.map((item) => item.name).sort()).toEqual(["Cabin filter", "Engine oil & filter"]);
      await as(arjun)
        .post(bulk, {
          schedules: [
            { name: "Air filter", categoryKey: "ENGINE.AIR_FILTER", intervalKm: 20_000 },
            { name: "Broken", categoryKey: "ENGINE.AIR_FILTER" },
          ],
        })
        .expect(400);
      expect(metaOf(await as(arjun).get(schedules(car.id)).expect(200))?.total).toBe(2);
    });

    it("checks the cost breakdown, the schedules and the odometer order", async () => {
      const car = await vehicle(arjun, 8000);
      const mismatch = await as(arjun)
        .post(records(car.id), service({ totalAmount: "7000" }))
        .expect(400);
      expect(errorOf(mismatch).details).toContainEqual(
        expect.objectContaining({ field: "totalAmount" }),
      );
      const discount = await as(arjun)
        .post(
          records(car.id),
          service({
            labourAmount: "100",
            partsAmount: null,
            taxAmount: null,
            discountAmount: "500",
          }),
        )
        .expect(400);
      expect(errorOf(discount).details).toContainEqual(
        expect.objectContaining({ field: "discountAmount" }),
      );

      const pads = dataOf<MaintenanceSchedule>(
        await as(arjun)
          .post(schedules(car.id), {
            name: "Brake pads",
            categoryKey: "BRAKES.BRAKE_PADS",
            intervalKm: 20_000,
          })
          .expect(201),
      );
      const noReading = await as(arjun)
        .post(
          records(car.id),
          service({ odometerKm: null, items: [{ name: "Pads", scheduleId: pads.id }] }),
        )
        .expect(400);
      expect(errorOf(noReading).details).toEqual([
        expect.objectContaining({ field: "odometerKm" }),
      ]);
      const others = await vehicle(arjun);
      const otherSchedule = dataOf<MaintenanceSchedule>(
        await as(arjun).post(schedules(others.id), oil()).expect(201),
      );
      await as(arjun)
        .post(records(car.id), service({ items: [{ name: "Oil", scheduleId: otherSchedule.id }] }))
        .expect(400);

      await as(arjun)
        .post(records(car.id), service({ items: [{ name: "Pads", scheduleId: pads.id }] }))
        .expect(201);
      const twice = await as(arjun)
        .post(
          records(car.id),
          service({
            title: "Again",
            odometerKm: 8150,
            items: [{ name: "Pads", scheduleId: pads.id }],
          }),
        )
        .expect(409);
      expect(errorOf(twice).details).toEqual([
        expect.objectContaining({ field: "items.0.scheduleId" }),
      ]);

      // A reading below one from an earlier day is refused; a historical record in order is fine.
      const later = await as(arjun)
        .post("/api/v1/expenses", {
          allocation: { mode: "single", vehicleId: car.id },
          categoryId: keyed.get("DAILY_USAGE"),
          title: "Toll",
          amount: "100",
          date: addDays(today, -10),
          odometerKm: 7900,
        })
        .expect(201);
      expect(later.body).toBeTruthy();
      const backwards = await as(arjun)
        .post(
          records(car.id),
          service({ serviceDate: addDays(today, -5), odometerKm: 7500, title: "Back" }),
        )
        .expect(409);
      expect(errorOf(backwards).details?.[0]).toMatchObject({ field: "odometerKm" });
      await as(arjun)
        .post(
          records(car.id),
          service({ serviceDate: addDays(today, -200), odometerKm: 3000, title: "Historical" }),
        )
        .expect(201);
    });

    it("keeps no expense for a ₹0 record and follows the cost through edits and delete", async () => {
      const car = await vehicle(arjun, 8000);
      const once = dataOf<MaintenanceSchedule>(
        await as(arjun)
          .post(schedules(car.id), {
            name: "Recall check",
            categoryKey: "GENERAL.INSPECTION",
            dueKm: 9000,
          })
          .expect(201),
      );
      const free = dataOf<ServiceRecord>(
        await as(arjun)
          .post(
            records(car.id),
            service({
              type: "WARRANTY_REPAIR",
              title: "Recall fix",
              categoryKey: "ENGINE.DIAGNOSTICS",
              labourAmount: null,
              partsAmount: null,
              taxAmount: null,
              discountAmount: null,
              items: [{ name: "Software update", scheduleId: once.id }],
            }),
          )
          .expect(201),
      );
      expect(free).toMatchObject({ totalAmount: "0.00", expenseId: null });
      expect(
        dataOf<MaintenanceSchedule>(
          await as(arjun)
            .get(`${schedules(car.id)}/${once.id}`)
            .expect(200),
        ).due.status,
      ).toBe("COMPLETED");

      const paid = dataOf<ServiceRecord>(
        await as(arjun)
          .patch(`${records(car.id)}/${free.id}`, { totalAmount: "1500" })
          .expect(200),
      );
      expect(paid.totalAmount).toBe("1500.00");
      expect(await expenseOf(arjun, paid.expenseId!)).toMatchObject({
        amount: "1500.00",
        category: { key: "REPAIRS" },
        subcategory: { key: "REPAIRS.ENGINE" },
      });
      const unpaid = dataOf<ServiceRecord>(
        await as(arjun)
          .patch(`${records(car.id)}/${free.id}`, { totalAmount: null })
          .expect(200),
      );
      expect(unpaid.expenseId).toBeNull();
      await as(arjun).get(`/api/v1/expenses/${paid.expenseId}`).expect(404);

      const again = dataOf<ServiceRecord>(
        await as(arjun)
          .patch(`${records(car.id)}/${free.id}`, { totalAmount: "900" })
          .expect(200),
      );
      await as(arjun)
        .delete(`${records(car.id)}/${free.id}`)
        .expect(204);
      await as(arjun).get(`/api/v1/expenses/${again.expenseId}`).expect(404);
      expect(
        dataOf<MaintenanceSchedule>(
          await as(arjun)
            .get(`${schedules(car.id)}/${once.id}`)
            .expect(200),
        ).due.status,
      ).not.toBe("COMPLETED");
    });

    it("filters the history on the server and sums what matches", async () => {
      const car = await vehicle(arjun, 8000);
      const periodic = dataOf<ServiceRecord>(
        await as(arjun).post(records(car.id), service()).expect(201),
      );
      const brakes = dataOf<ServiceRecord>(
        await as(arjun)
          .post(
            records(car.id),
            service({
              type: "REPAIR",
              title: "Front brakes",
              categoryKey: "BRAKES.BRAKE_PADS",
              serviceDate: addDays(today, -30),
              odometerKm: 7600,
              providerName: "Speedy Brakes",
              labourAmount: null,
              partsAmount: null,
              taxAmount: null,
              discountAmount: null,
              totalAmount: "3200",
              notes: "Squeal fixed",
              items: [{ name: "Ceramic pads", partNumber: "BP-1182" }],
            }),
          )
          .expect(201),
      );
      const historical = dataOf<ServiceRecord>(
        await as(arjun)
          .post(
            records(car.id),
            service({
              type: "INSPECTION",
              title: "PDI and first inspection",
              categoryKey: "GENERAL.INSPECTION",
              serviceDate: "2024-03-02",
              odometerKm: 1040,
              labourAmount: null,
              partsAmount: null,
              taxAmount: null,
              discountAmount: null,
            }),
          )
          .expect(201),
      );
      const ids = async (query: string) =>
        dataOf<ServiceRecord[]>(
          await as(arjun)
            .get(`${records(car.id)}?${query}`)
            .expect(200),
        ).map((record) => record.id);

      expect(await ids("")).toEqual([periodic.id, brakes.id, historical.id]);
      expect(await ids("search=bp-1182")).toEqual([brakes.id]); // part number
      expect(await ids("search=speedy")).toEqual([brakes.id]); // workshop
      expect(await ids("search=squeal")).toEqual([brakes.id]); // notes
      expect(await ids("search=periodic")).toEqual([periodic.id]); // category name / title
      expect(await ids("group=BRAKES")).toEqual([brakes.id]);
      expect(await ids("type=INSPECTION")).toEqual([historical.id]);
      expect(await ids(`providerId=${brakes.provider!.id}`)).toEqual([brakes.id]);
      expect(await ids("minAmount=1000&maxAmount=5000")).toEqual([brakes.id]);
      expect(await ids("maxKm=2000")).toEqual([historical.id]);
      expect(await ids(`from=2025-01-01&to=${addDays(today, -1)}`)).toEqual([brakes.id]);

      const summary = await as(arjun)
        .get(`${records(car.id)}/summary?minAmount=1`)
        .expect(200);
      expect(dataOf(summary)).toEqual({ count: 2, totalAmount: "10050.00" });
      const backwards = await as(arjun)
        .get(`${records(car.id)}?minKm=5000&maxKm=100`)
        .expect(400);
      expect(errorOf(backwards).details).toContainEqual(
        expect.objectContaining({ field: "maxKm" }),
      );
    });

    it("reuses a workshop by name and keeps records private", async () => {
      const car = await vehicle(arjun, 8000);
      const first = dataOf<ServiceRecord>(
        await as(arjun).post(records(car.id), service()).expect(201),
      );
      const second = dataOf<ServiceRecord>(
        await as(arjun)
          .post(
            records(car.id),
            service({
              title: "Wash",
              odometerKm: 8200,
              providerName: "maruti arena service, gurugram",
            }),
          )
          .expect(201),
      );
      expect(second.provider?.id).toBe(first.provider?.id);
      const providers = dataOf<MaintenanceProvider[]>(
        await as(arjun).get("/api/v1/maintenance-providers?search=arena").expect(200),
      );
      expect(providers.map((provider) => provider.id)).toContain(first.provider!.id);
      expect(
        dataOf<MaintenanceProvider[]>(
          await as(priya).get("/api/v1/maintenance-providers").expect(200),
        ),
      ).toEqual([]);
      await as(priya)
        .get(`${records(car.id)}/${first.id}`)
        .expect(404);
      await as(priya)
        .delete(`${records(car.id)}/${first.id}`)
        .expect(404);
    });
  });

  describe("components", () => {
    const components = (vehicleId: string) => `/api/v1/vehicles/${vehicleId}/components`;
    const battery = (overrides: object = {}) => ({
      kind: "BATTERY",
      name: "12V battery",
      brand: "Exide",
      installedAt: "2025-02-14",
      installedKm: 1020,
      expectedLifeKm: 40_000,
      expectedLifeMonths: 48,
      warrantyUntil: "2028-02-14",
      condition: "GOOD",
      ...overrides,
    });

    it("tracks a part with its estimated life, links schedules and records inspections", async () => {
      const car = await vehicle(arjun, 9020);
      const id = randomUUID();
      const part = dataOf<VehicleComponentDetail>(
        await as(arjun).post(components(car.id), battery({ id })).expect(201),
      );
      expect(part).toMatchObject({
        id,
        state: "INSTALLED",
        status: "GOOD",
        warrantyActive: true,
        life: { kmUsed: 8000, estimatedKm: 41_020, estimatedDate: "2029-02-14" },
        history: [{ type: "INSTALLED", date: "2025-02-14", odometerKm: 1020 }],
      });
      await as(arjun)
        .post(components(car.id), battery({ id, name: "Retry" }))
        .expect(201);
      expect(metaOf(await as(arjun).get(components(car.id)).expect(200))?.total).toBe(1);

      // A schedule watching it, due now: the part shows "inspection due".
      await as(arjun)
        .post(schedules(car.id), {
          name: "Battery check",
          categoryKey: "ELECTRICAL.BATTERY_INSPECTION",
          dueKm: 9100,
          componentId: id,
        })
        .expect(201);
      expect(
        dataOf<VehicleComponent>(
          await as(arjun)
            .get(`${components(car.id)}/${id}`)
            .expect(200),
        ),
      ).toMatchObject({
        status: "INSPECTION_DUE",
        schedules: [{ name: "Battery check", status: "DUE" }],
      });
      const other = await vehicle(arjun);
      await as(arjun)
        .post(schedules(other.id), {
          name: "X",
          categoryKey: "OTHER.OTHER",
          dueKm: 1,
          componentId: id,
        })
        .expect(400);

      const inspected = dataOf<VehicleComponentDetail>(
        await as(arjun)
          .post(`${components(car.id)}/${id}/inspect`, {
            date: addDays(today, -1),
            odometerKm: 9000,
            condition: "REPLACE_SOON",
            notes: "Slow crank",
          })
          .expect(200),
      );
      expect(inspected).toMatchObject({
        condition: "REPLACE_SOON",
        status: "REPLACEMENT_APPROACHING",
      });
      expect(inspected.history.at(-1)).toMatchObject({
        type: "INSPECTED",
        condition: "REPLACE_SOON",
        notes: "Slow crank",
      });
      const early = await as(arjun)
        .post(`${components(car.id)}/${id}/inspect`, { date: "2024-01-01", condition: "GOOD" })
        .expect(400);
      expect(errorOf(early).details).toEqual([expect.objectContaining({ field: "date" })]);
    });

    it("replaces a part: the old one is kept, the work is a record with its expense, schedules move on", async () => {
      const car = await vehicle(arjun, 9020);
      const old = dataOf<VehicleComponent>(
        await as(arjun).post(components(car.id), battery()).expect(201),
      );
      const check = dataOf<MaintenanceSchedule>(
        await as(arjun)
          .post(schedules(car.id), {
            name: "Battery check",
            categoryKey: "ELECTRICAL.BATTERY_INSPECTION",
            intervalMonths: 6,
            componentId: old.id,
          })
          .expect(201),
      );
      const fresh = dataOf<VehicleComponentDetail>(
        await as(arjun)
          .post(`${components(car.id)}/${old.id}/replace`, {
            date: today,
            odometerKm: 9100,
            brand: "Amaron Pro",
            partNumber: "38B20L",
            warrantyUntil: "2029-11-27",
            providerName: "Battery Point",
            totalAmount: "5400",
            paymentMethod: "UPI",
          })
          .expect(200),
      );
      expect(fresh).toMatchObject({
        name: "12V battery",
        brand: "Amaron Pro",
        state: "INSTALLED",
        condition: "NEW",
        status: "NEW",
        replaces: { id: old.id },
        expectedLifeMonths: 48, // carried over
        schedules: [{ id: check.id }],
        history: [{ type: "INSTALLED", recordTitle: "12V battery replaced" }],
      });

      const record = dataOf<ServiceRecord>(
        await as(arjun)
          .get(`/api/v1/vehicles/${car.id}/service-records/${fresh.installRecordId}`)
          .expect(200),
      );
      expect(record).toMatchObject({
        type: "COMPONENT_REPLACEMENT",
        categoryKey: "ELECTRICAL.BATTERY_REPLACEMENT",
        totalAmount: "5400.00",
        items: [{ name: "Amaron Pro 12V battery", componentId: fresh.id, scheduleId: check.id }],
      });
      const expense = dataOf<{ amount: string; subcategory: { key: string } }>(
        await as(arjun).get(`/api/v1/expenses/${record.expenseId}`).expect(200),
      );
      expect(expense).toMatchObject({
        amount: "5400.00",
        subcategory: { key: "MAINTENANCE.BATTERY" },
      });
      expect(
        dataOf<MaintenanceSchedule>(
          await as(arjun)
            .get(`${schedules(car.id)}/${check.id}`)
            .expect(200),
        ).due.date,
      ).toMatchObject({ basis: "COMPLETION", from: today });

      const kept = dataOf<VehicleComponentDetail>(
        await as(arjun)
          .get(`${components(car.id)}/${old.id}`)
          .expect(200),
      );
      expect(kept).toMatchObject({
        state: "REPLACED",
        status: "REPLACED",
        removedAt: today,
        replacedBy: { id: fresh.id },
        schedules: [],
      });
      expect(kept.history.at(-1)).toMatchObject({ type: "REPLACED", recordId: record.id });
      const history = dataOf<VehicleComponent[]>(
        await as(arjun)
          .get(`${components(car.id)}?state=history`)
          .expect(200),
      );
      expect(history.map((part) => part.id)).toEqual([old.id]);
      await as(arjun)
        .post(`${components(car.id)}/${old.id}/inspect`, { date: today, condition: "GOOD" })
        .expect(409);
    });

    it("marks a part removed, lists records that worked on it, and keeps parts private", async () => {
      const car = await vehicle(arjun, 9020);
      const tyres = dataOf<VehicleComponent>(
        await as(arjun)
          .post(components(car.id), { kind: "TYRES", name: "Front tyres", position: "Front pair" })
          .expect(201),
      );
      expect(tyres).toMatchObject({ status: "UNKNOWN", life: null, warrantyActive: null });
      const rotation = dataOf<ServiceRecord>(
        await as(arjun)
          .post(`/api/v1/vehicles/${car.id}/service-records`, {
            type: "ROUTINE_SERVICE",
            title: "Tyre rotation",
            categoryKey: "TYRES.ROTATION",
            serviceDate: addDays(today, -3),
            odometerKm: 9000,
            items: [{ name: "Rotation", componentId: tyres.id }],
          })
          .expect(201),
      );
      expect(rotation.items[0]).toMatchObject({
        componentId: tyres.id,
        componentName: "Front tyres",
      });

      const removed = dataOf<VehicleComponentDetail>(
        await as(arjun)
          .post(`${components(car.id)}/${tyres.id}/remove`, {
            date: today,
            odometerKm: 9020,
            failed: true,
          })
          .expect(200),
      );
      expect(removed).toMatchObject({ state: "REMOVED", status: "REMOVED", condition: "FAILED" });
      expect(removed.history.map((entry) => entry.type)).toEqual(["SERVICED", "REMOVED"]);

      await as(priya)
        .get(`${components(car.id)}/${tyres.id}`)
        .expect(404);
      const hers = await vehicle(priya);
      await as(priya)
        .get(`${components(hers.id)}/${tyres.id}`)
        .expect(404);
      await as(arjun)
        .delete(`${components(car.id)}/${tyres.id}`)
        .expect(204);
      const kept = dataOf<ServiceRecord>(
        await as(arjun)
          .get(`/api/v1/vehicles/${car.id}/service-records/${rotation.id}`)
          .expect(200),
      );
      expect(kept.items[0]).toMatchObject({ componentId: null });
    });
  });

  describe("inspections", () => {
    const inspections = (vehicleId: string) => `/api/v1/vehicles/${vehicleId}/inspections`;
    const check = (overrides: object = {}) => ({
      kind: "SELF_CHECK",
      templateKey: "MONTHLY",
      title: "Monthly check",
      date: today,
      odometerKm: 8400,
      followUpDate: addDays(today, 14),
      items: [
        { area: "TYRES", label: "Tyre pressure", condition: "GOOD" },
        {
          area: "TYRES",
          label: "Tyre tread",
          condition: "ATTENTION",
          recommendedAction: "Check alignment",
        },
        { area: "BRAKES", label: "Brake feel", condition: "MONITOR" },
        { area: "AC", label: "AC cooling", condition: "NOT_INSPECTED" },
      ],
      ...overrides,
    });

    it("records a checklist with counts, a part's finding in its lifecycle, and validates it", async () => {
      const car = await vehicle(arjun, 8400);
      const tyres = dataOf<{ id: string }>(
        await as(arjun)
          .post(`/api/v1/vehicles/${car.id}/components`, { kind: "TYRES", name: "Front tyres" })
          .expect(201),
      );
      const base = check();
      const id = randomUUID();
      const created = dataOf<Inspection>(
        await as(arjun)
          .post(inspections(car.id), {
            ...base,
            id,
            items: base.items.map((item, index) =>
              index === 1 ? { ...item, componentId: tyres.id } : item,
            ),
          })
          .expect(201),
      );
      expect(created).toMatchObject({
        id,
        kind: "SELF_CHECK",
        counts: { issues: 1, monitor: 1, ok: 1, notInspected: 1 },
        items: [
          { label: "Tyre pressure" },
          { label: "Tyre tread", componentName: "Front tyres" },
          {},
          {},
        ],
      });
      await as(arjun).post(inspections(car.id), check({ id })).expect(201);
      await as(arjun)
        .post(inspections(car.id), check({ kind: "PROFESSIONAL", providerName: "Arena" }))
        .expect(201);
      expect(
        metaOf(
          await as(arjun)
            .get(`${inspections(car.id)}?kind=SELF_CHECK`)
            .expect(200),
        )?.total,
      ).toBe(1);

      const part = dataOf<{ history: { source: string; checklistCondition: string | null }[] }>(
        await as(arjun).get(`/api/v1/vehicles/${car.id}/components/${tyres.id}`).expect(200),
      );
      expect(part.history).toContainEqual(
        expect.objectContaining({ source: "INSPECTION", checklistCondition: "ATTENTION" }),
      );

      const early = await as(arjun)
        .post(inspections(car.id), check({ followUpDate: addDays(today, -1) }))
        .expect(400);
      expect(errorOf(early).details).toContainEqual(
        expect.objectContaining({ field: "followUpDate" }),
      );
      const other = await vehicle(arjun);
      const foreign = dataOf<{ id: string }>(
        await as(arjun)
          .post(`/api/v1/vehicles/${other.id}/components`, { kind: "BATTERY", name: "Battery" })
          .expect(201),
      );
      await as(arjun)
        .post(
          inspections(car.id),
          check({
            items: [
              { area: "BATTERY", label: "Battery", condition: "GOOD", componentId: foreign.id },
            ],
          }),
        )
        .expect(400);
      await as(arjun)
        .post(inspections(car.id), check({ items: [] }))
        .expect(400);
    });

    it("follows a finding up with a schedule, keeps the link through edits, and keeps the schedule on delete", async () => {
      const car = await vehicle(arjun, 8400);
      const inspection = dataOf<Inspection>(
        await as(arjun).post(inspections(car.id), check()).expect(201),
      );
      const finding = inspection.items[1]!;
      const schedule = dataOf<MaintenanceSchedule>(
        await as(arjun)
          .post(schedules(car.id), {
            name: "Tyre tread check",
            categoryKey: "TYRES.PRESSURE",
            dueDate: addDays(today, 14),
            inspectionItemId: finding.id,
          })
          .expect(201),
      );
      const linked = dataOf<Inspection>(
        await as(arjun)
          .get(`${inspections(car.id)}/${inspection.id}`)
          .expect(200),
      );
      expect(linked.items[1]!.followUpSchedule).toMatchObject({
        id: schedule.id,
        name: "Tyre tread check",
        status: "DUE_SOON",
      });

      // Editing with the item's id keeps its follow-up; dropping an item removes it.
      const edited = dataOf<Inspection>(
        await as(arjun)
          .patch(`${inspections(car.id)}/${inspection.id}`, {
            items: [
              {
                ...finding,
                condition: "REPLACE_SOON",
                followUpSchedule: undefined,
                componentName: undefined,
              },
            ],
          })
          .expect(200),
      );
      expect(edited.items).toHaveLength(1);
      expect(edited.items[0]).toMatchObject({
        id: finding.id,
        condition: "REPLACE_SOON",
        followUpSchedule: { id: schedule.id },
      });

      const other = await vehicle(arjun);
      await as(arjun)
        .post(schedules(other.id), {
          name: "X",
          categoryKey: "OTHER.OTHER",
          dueKm: 1,
          inspectionItemId: finding.id,
        })
        .expect(400);

      await as(priya)
        .get(`${inspections(car.id)}/${inspection.id}`)
        .expect(404);
      await as(arjun)
        .delete(`${inspections(car.id)}/${inspection.id}`)
        .expect(204);
      await as(arjun)
        .get(`${schedules(car.id)}/${schedule.id}`)
        .expect(200);
    });
  });
  describe("workshops", () => {
    const providers = "/api/v1/maintenance-providers";

    it("keeps a workshop's profile, visits and spending from Expenses, and archives one with history", async () => {
      const car = await vehicle(arjun, 8000);
      const id = randomUUID();
      const profile = {
        id,
        name: "Sharma Tyres & Wheels",
        type: "TYRES",
        phone: "+91 98111 22334",
        city: "Gurugram",
        preferred: true,
      };
      expect(
        dataOf<ProviderProfile>(await as(arjun).post(providers, profile).expect(201)),
      ).toMatchObject({
        id,
        type: "TYRES",
        preferred: true,
        archivedAt: null,
        stats: { visits: 0, firstVisit: null, lastVisit: null, spent: "0.00" },
      });
      // A retried save returns the same workshop; names are unique ignoring case.
      expect(dataOf<ProviderProfile>(await as(arjun).post(providers, profile).expect(201)).id).toBe(
        id,
      );
      expect(
        errorOf(
          await as(arjun)
            .post(providers, { name: "sharma tyres & wheels", type: "OTHER" })
            .expect(409),
        ).details,
      ).toEqual([{ field: "name", message: "You already have a workshop with this name" }]);
      await as(arjun).post(providers, { name: "X", type: "OTHER", phone: "call me" }).expect(400);

      // Two visits typed by name: a paid one (then partly refunded) and a free one.
      const records = `/api/v1/vehicles/${car.id}/service-records`;
      const paid = dataOf<ServiceRecord>(
        await as(arjun)
          .post(records, {
            type: "REPAIR",
            title: "Puncture repair",
            categoryKey: "TYRES.PUNCTURE",
            serviceDate: today,
            providerName: "sharma tyres & wheels",
            totalAmount: "5400",
          })
          .expect(201),
      );
      expect(paid.provider?.id).toBe(id);
      await as(arjun)
        .post(`/api/v1/expenses/${paid.expenseId}/refunds`, {
          amount: "400",
          date: today,
          reason: "REFUND",
        })
        .expect(201);
      await as(arjun)
        .post(records, {
          type: "WARRANTY_REPAIR",
          title: "Valve replaced",
          categoryKey: "TYRES.PUNCTURE",
          serviceDate: today,
          providerName: "Sharma Tyres & Wheels",
        })
        .expect(201);
      expect(
        dataOf<ProviderProfile>(await as(arjun).get(`${providers}/${id}`).expect(200)).stats,
      ).toEqual({ visits: 2, firstVisit: today, lastVisit: today, spent: "5000.00" });
      const visits = await as(arjun).get(`${providers}/${id}/service-records`).expect(200);
      expect(metaOf(visits)?.total).toBe(2);
      expect(dataOf<ServiceRecord[]>(visits).map((record) => record.id)).toContain(paid.id);

      // Preferred first; a PATCH changes only what it sends.
      const quick = dataOf<ProviderProfile>(
        await as(arjun)
          .post(providers, { name: "Quick Fix Garage", type: "INDEPENDENT" })
          .expect(201),
      );
      expect(dataOf<ProviderProfile[]>(await as(arjun).get(providers).expect(200))[0]?.id).toBe(id);
      expect(
        dataOf<ProviderProfile>(
          await as(arjun).patch(`${providers}/${id}`, { notes: "Ask for Ramesh" }).expect(200),
        ),
      ).toMatchObject({ notes: "Ask for Ramesh", phone: "+91 98111 22334", preferred: true });

      // History blocks deleting; archiving hides it from the list and keeps its visits.
      await as(arjun).delete(`${providers}/${id}`).expect(409);
      await as(arjun).post(`${providers}/${id}/archive`).expect(200);
      await as(arjun).post(`${providers}/${id}/archive`).expect(200);
      expect(
        dataOf<ProviderProfile[]>(await as(arjun).get(providers).expect(200)).map((row) => row.id),
      ).not.toContain(id);
      expect(
        dataOf<ProviderProfile[]>(await as(arjun).get(`${providers}?archived=true`).expect(200)),
      ).toMatchObject([{ id, stats: { visits: 2 } }]);
      await as(arjun).post(`${providers}/${id}/restore`).expect(200);

      // Someone else's workshop can't be seen; an unused one can be deleted.
      await as(priya).get(`${providers}/${quick.id}`).expect(404);
      await as(priya).delete(`${providers}/${quick.id}`).expect(404);
      await as(priya).get(`${providers}/${id}/service-records`).expect(404);
      await as(arjun).delete(`${providers}/${quick.id}`).expect(204);
    });
  });
});
