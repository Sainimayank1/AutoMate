/**
 * Notifications (M10) through the real HTTP pipeline and database: the inbox raised from the
 * records (documents, maintenance, reminders, the monthly summary), read / snooze / dismiss, the
 * switches in Settings, and the dashboard's action centre.
 */
import { randomUUID } from "node:crypto";

import {
  addDays,
  type ApiSuccessResponse,
  type DashboardOverview,
  istToday,
  type NotificationItem,
  type NotificationSummary,
  type PageMeta,
  type Reminder,
  type Vehicle,
  type VehicleDocument,
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

const DOMAIN = "notifications.e2e.automate.test";

describe("Notifications (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
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
  });

  afterAll(async () => {
    await prisma?.user.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } });
    await app?.close();
  });

  const signUp = async () =>
    (
      await app.get(AuthService).register(
        {
          name: "Arjun Mehta",
          email: `notify-${randomUUID()}@${DOMAIN}`,
          password: "Drive2026safe",
          acceptedTerms: true,
        },
        {},
      )
    ).session.accessToken;
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

  async function car(token: string) {
    const plate = `HR${Math.floor(10 + Math.random() * 89)}EV${Math.floor(1000 + Math.random() * 9000)}`;
    return dataOf<Vehicle>(
      await as(token)
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
          warrantyExpiryDate: addDays(today, 700),
        })
        .expect(201),
    );
  }
  const refresh = async (token: string) =>
    dataOf<NotificationSummary>(await as(token).post("/api/v1/notifications/refresh").expect(200));
  const inbox = async (token: string, query = "") =>
    dataOf<NotificationItem[]>(await as(token).get(`/api/v1/notifications${query}`).expect(200));

  it("raises notifications from the records, and drops them once they no longer apply", async () => {
    const token = await signUp();
    const victoris = await car(token);
    const puc = dataOf<VehicleDocument>(
      await as(token)
        .post("/api/v1/documents", {
          vehicleId: victoris.id,
          type: "PUC",
          name: "PUC certificate",
          number: "HR026-PUC-9921",
          expiryDate: addDays(today, 5),
        })
        .expect(201),
    );
    await as(token)
      .post(`/api/v1/vehicles/${victoris.id}/maintenance-schedules`, {
        name: "Wheel alignment",
        categoryKey: "TYRES.ALIGNMENT",
        dueDate: addDays(today, -3),
      })
      .expect(201);

    const summary = await refresh(token);
    expect(summary.unread).toBe(2);
    const items = await inbox(token);
    expect(items.map((item) => [item.category, item.priority, item.kind])).toEqual(
      expect.arrayContaining([
        ["DOCUMENTS", "MEDIUM", "document.expiring"],
        ["MAINTENANCE", "HIGH", "maintenance.overdue"],
      ]),
    );
    const paper = items.find((item) => item.category === "DOCUMENTS")!;
    expect(paper).toMatchObject({
      href: `/documents/${puc.id}`,
      vehicle: { id: victoris.id, name: "Maruti Suzuki Victoris" },
    });

    // Raised once: refreshing again adds nothing.
    expect((await refresh(token)).unread).toBe(2);

    // Renewed far ahead: the expiry notification goes.
    await as(token)
      .patch(`/api/v1/documents/${puc.id}`, { expiryDate: addDays(today, 360), reminderDays: [30] })
      .expect(200);
    // Within the minute the inbox isn't recomputed; a refresh (or the next minute) is.
    expect((await inbox(token)).map((item) => item.category).sort()).toEqual([
      "DOCUMENTS",
      "MAINTENANCE",
    ]);
    await refresh(token);
    expect((await inbox(token)).map((item) => item.category)).toEqual(["MAINTENANCE"]);

    // Maintenance reminders switched off in Settings: that goes too.
    await as(token)
      .patch("/api/v1/users/me/preferences", { notifications: { maintenance: false } })
      .expect(200);
    expect((await refresh(token)).unread).toBe(0);
  });

  it("lets the bell and the list read at once: both wait for the same sync, and renewals open", async () => {
    const token = await signUp();
    const vehicle = await car(token);
    const document = dataOf<{ id: string }>(
      await as(token)
        .post("/api/v1/documents", {
          vehicleId: vehicle.id,
          type: "PUC",
          name: "PUC certificate",
          expiryDate: addDays(today, 5),
          fileIds: [],
        })
        .expect(201),
    );
    // A page opening on the inbox asks for both together.
    const [summary, list] = await Promise.all([
      as(token).get("/api/v1/notifications/summary").expect(200),
      as(token).get("/api/v1/notifications").expect(200),
    ]);
    const puc = dataOf<NotificationItem[]>(list).find((item) => item.kind === "document.expiring");
    expect(dataOf<NotificationSummary>(summary).unread).toBeGreaterThan(0);
    expect(puc?.action).toEqual({
      label: "Renew",
      href: `/documents/${document.id}/edit?renew=1`,
    });
  });

  it("reads, snoozes and dismisses; a dismissal holds while the reminder still applies", async () => {
    const token = await signUp();
    const victoris = await car(token);
    const reminders = await Promise.all(
      ["Get the tyres rotated", "Renew FASTag KYC", "Wash the car"].map(async (title, index) =>
        dataOf<Reminder>(
          await as(token)
            .post("/api/v1/reminders", {
              title,
              vehicleId: victoris.id,
              dueDate: addDays(today, index),
              remindDaysBefore: 2,
            })
            .expect(201),
        ),
      ),
    );
    expect(reminders.map((reminder) => reminder.state)).toEqual(["DUE", "DUE", "DUE"]);
    expect((await refresh(token)).unread).toBe(3);
    const [first, second, third] = await inbox(token);

    await as(token).patch(`/api/v1/notifications/${first!.id}`, { read: true }).expect(200);
    expect(await inbox(token, "?filter=unread")).toHaveLength(2);

    const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await as(token).post(`/api/v1/notifications/${second!.id}/snooze`, { until }).expect(200);
    expect((await inbox(token)).map((item) => item.id)).not.toContain(second!.id);
    expect((await inbox(token, "?filter=snoozed")).map((item) => item.snoozedUntil)).toEqual([
      until,
    ]);
    await as(token)
      .post(`/api/v1/notifications/${second!.id}/snooze`, { until: "2020-01-01T00:00:00.000Z" })
      .expect(400);

    await as(token).delete(`/api/v1/notifications/${third!.id}`).expect(204);
    await refresh(token);
    expect((await inbox(token)).map((item) => item.id)).toEqual([first!.id]);

    // Marking the reminder done takes its notification away.
    const done = reminders.find((reminder) => first!.title.startsWith(reminder.title))!;
    await as(token).post(`/api/v1/reminders/${done.id}/done`).expect(200);
    expect(await inbox(token)).toEqual([]);
    const open = await as(token).get("/api/v1/reminders").expect(200);
    expect(metaOf(open)).toMatchObject({ total: 2 });

    const other = await signUp();
    await as(other).patch(`/api/v1/notifications/${first!.id}`, { read: true }).expect(404);
    await as(other).post(`/api/v1/reminders/${done.id}/reopen`).expect(404);
  });

  it("sums last month when asked, and keeps the summary after the switch goes off", async () => {
    const token = await signUp();
    const victoris = await car(token);
    const lastMonth = `${addDays(`${today.slice(0, 8)}01`, -1).slice(0, 8)}10`;
    await as(token)
      .post("/api/v1/expenses", {
        allocation: { mode: "single", vehicleId: victoris.id },
        categoryId: keyed.get("DAILY_USAGE"),
        title: "Car wash",
        amount: "450",
        date: lastMonth,
      })
      .expect(201);
    expect((await refresh(token)).unread).toBe(0);
    await as(token)
      .patch("/api/v1/users/me/preferences", { notifications: { monthlySummary: true } })
      .expect(200);
    await refresh(token);
    const [summary] = await inbox(token, "?category=EXPENSES");
    expect(summary).toMatchObject({ kind: "summary.monthly", priority: "LOW" });
    expect(summary!.title).toContain("₹450.00 spent");
    await as(token)
      .patch("/api/v1/users/me/preferences", { notifications: { monthlySummary: false } })
      .expect(200);
    await refresh(token);
    expect(await inbox(token, "?category=EXPENSES")).toHaveLength(1);
    expect(
      dataOf<{ updated: number }>(
        await as(token).post("/api/v1/notifications/read-all").expect(200),
      ),
    ).toEqual({ updated: 1 });
  });

  it("shows due reminders in the dashboard's action centre and lets information be dismissed", async () => {
    const token = await signUp();
    const victoris = await car(token);
    await as(token)
      .post("/api/v1/reminders", {
        title: "Get the tyres rotated",
        vehicleId: victoris.id,
        dueDate: addDays(today, -1),
      })
      .expect(201);
    const overview = async () =>
      dataOf<DashboardOverview>(
        await as(token)
          .get(`/api/v1/dashboard/overview?vehicleId=${victoris.id}&period=this_month`)
          .expect(200),
      );
    const items = (await overview()).status;
    expect(
      items.state === "ok" && items.data.items.map((item) => [item.source, item.severity]),
    ).toEqual([
      ["reminder", "critical"],
      ["warranty", "info"],
    ]);
    await as(token)
      .post("/api/v1/dashboard/dismissals", { vehicleId: victoris.id, itemId: "warranty" })
      .expect(204);
    const after = (await overview()).status;
    expect(after.state === "ok" && after.data.items.map((item) => item.source)).toEqual([
      "reminder",
    ]);
    const other = await signUp();
    await as(other)
      .post("/api/v1/dashboard/dismissals", { vehicleId: victoris.id, itemId: "warranty" })
      .expect(404);
  });
});
