/**
 * Maintenance API through the real HTTP pipeline and database (docker compose up -d).
 * Users are created under a throwaway domain and deleted afterwards (everything cascades).
 */
import { randomUUID } from "node:crypto";

import {
  addDays,
  type ApiErrorResponse,
  type ApiSuccessResponse,
  istToday,
  type MaintenanceOverview,
  type MaintenanceProvider,
  type MaintenanceSchedule,
  type PageMeta,
  type ServiceRecord,
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
});
