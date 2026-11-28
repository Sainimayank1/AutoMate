/**
 * Settings (M11) through the real HTTP pipeline, database and local storage: profile and photo,
 * preferences, password, signed-in devices and deleting the account. Users and their files are
 * removed afterwards.
 */
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";

import {
  type ApiErrorResponse,
  type ApiSuccessResponse,
  type PageMeta,
  type SessionInfo,
  type UploadSlot,
  type UserPreferences,
  type UserProfile,
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

const DOMAIN = "settings.e2e.automate.test";
const PASSWORD = "Drive2026safe";
const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
]);

describe("Settings (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let auth: AuthService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      bodyParser: false,
      bufferLogs: true,
    });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    auth = app.get(AuthService);
  });

  afterAll(async () => {
    const users = await prisma?.user.findMany({
      where: { email: { endsWith: `@${DOMAIN}` } },
      select: { id: true },
    });
    for (const user of users ?? []) {
      await rm(resolve(".storage/users", user.id), { recursive: true, force: true });
    }
    await prisma?.user.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } });
    await app?.close();
  });

  const as = (token: string) => ({
    get: (url: string) => request(app.getHttpServer()).get(url).auth(token, { type: "bearer" }),
    post: (url: string, body?: object) =>
      request(app.getHttpServer()).post(url).auth(token, { type: "bearer" }).send(body),
    patch: (url: string, body: object) =>
      request(app.getHttpServer()).patch(url).auth(token, { type: "bearer" }).send(body),
    put: (url: string, body: Buffer, headers: Record<string, string>) =>
      request(app.getHttpServer()).put(new URL(url).pathname).set(headers).send(body),
    delete: (url: string) =>
      request(app.getHttpServer()).delete(url).auth(token, { type: "bearer" }),
  });
  const dataOf = <T>(res: request.Response) => (res.body as ApiSuccessResponse<T>).data;
  const metaOf = (res: request.Response) =>
    (res.body as ApiSuccessResponse<unknown, PageMeta>).meta;

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

  /** A new account, and a second sign-in from an iPhone. */
  async function account() {
    const email = `settings-${randomUUID()}@${DOMAIN}`;
    const first = await auth.register(
      { name: "Arjun Mehta", email, password: PASSWORD, acceptedTerms: true },
      { userAgent: CHROME },
    );
    const second = await auth.login(
      { email, password: PASSWORD, rememberMe: true },
      { userAgent: IPHONE },
    );
    return { email, token: first.session.accessToken, phone: second.session.accessToken };
  }

  it("changes the profile and its photo; the email needs the password", async () => {
    const { token } = await account();
    const renamed = dataOf<UserProfile>(
      await as(token).patch("/api/v1/users/me", { name: "Arjun M." }).expect(200),
    );
    expect(renamed).toMatchObject({ name: "Arjun M.", avatarUrl: null });
    const noPassword = await as(token)
      .patch("/api/v1/users/me", { email: "new@example.in" })
      .expect(400);
    expect((noPassword.body as ApiErrorResponse).error.details).toEqual([
      { field: "currentPassword", message: "Enter your current password to change your email" },
    ]);
    await as(token)
      .patch("/api/v1/users/me", {
        email: `new-${randomUUID()}@${DOMAIN}`,
        currentPassword: "wrong",
      })
      .expect(400);
    const email = `new-${randomUUID()}@${DOMAIN}`;
    const moved = dataOf<UserProfile>(
      await as(token).patch("/api/v1/users/me", { email, currentPassword: PASSWORD }).expect(200),
    );
    expect(moved.email).toBe(email);

    // A photo, straight to storage, then confirmed.
    const slot = dataOf<UploadSlot>(
      await as(token)
        .post("/api/v1/users/me/avatar/uploads", { contentType: "image/png", size: PNG.length })
        .expect(201),
    );
    await request(app.getHttpServer())
      .put(new URL(slot.url).pathname)
      .set(slot.headers)
      .send(PNG)
      .expect(200);
    const withPhoto = dataOf<UserProfile>(
      await as(token).post(`/api/v1/users/me/avatar/uploads/${slot.fileId}/confirm`).expect(200),
    );
    expect(withPhoto.avatarUrl).toContain("/storage/local/");
    const me = dataOf<UserProfile>(await as(token).get("/api/v1/users/me").expect(200));
    expect(me.avatarUrl).not.toBeNull();
    const removed = dataOf<UserProfile>(
      await as(token).delete("/api/v1/users/me/avatar").expect(200),
    );
    expect(removed.avatarUrl).toBeNull();
  });

  it("keeps preferences, with the defaults until changed and a vehicle of your own", async () => {
    const { token } = await account();
    const defaults = dataOf<UserPreferences>(
      await as(token).get("/api/v1/users/me/preferences").expect(200),
    );
    expect(defaults).toMatchObject({
      theme: "DARK",
      defaultVehicleId: null,
      notifications: { enabled: true, documents: true, monthlySummary: false },
      regional: { currency: "INR", timeZone: "Asia/Kolkata" },
    });
    const car = await vehicle(token);
    const changed = dataOf<UserPreferences>(
      await as(token)
        .patch("/api/v1/users/me/preferences", {
          theme: "LIGHT",
          defaultVehicleId: car.id,
          notifications: { trips: false },
        })
        .expect(200),
    );
    expect(changed).toMatchObject({
      theme: "LIGHT",
      defaultVehicleId: car.id,
      notifications: { enabled: true, trips: false, documents: true },
    });
    // Someone else's vehicle can't be the default.
    const other = await account();
    await as(other.token)
      .patch("/api/v1/users/me/preferences", { defaultVehicleId: car.id })
      .expect(404);
  });

  it("keeps reminder timing per category and uses it where a schedule has no lead of its own", async () => {
    const { token } = await account();
    const defaults = dataOf<UserPreferences>(
      await as(token).get("/api/v1/users/me/preferences").expect(200),
    );
    expect(defaults.reminderTiming).toEqual({
      documentDays: [30, 7, 1],
      serviceLeadDays: 30,
      serviceLeadKm: 1000,
      paymentDays: 3,
    });
    const changed = dataOf<UserPreferences>(
      await as(token)
        .patch("/api/v1/users/me/preferences", {
          reminderTiming: { documentDays: [3, 15, 15], serviceLeadKm: 12_000 },
        })
        .expect(200),
    );
    // Deduped and latest first; untouched values stay.
    expect(changed.reminderTiming).toEqual({
      documentDays: [15, 3],
      serviceLeadDays: 30,
      serviceLeadKm: 12_000,
      paymentDays: 3,
    });
    await as(token)
      .patch("/api/v1/users/me/preferences", { reminderTiming: { documentDays: [] } })
      .expect(400);

    const car = await vehicle(token);
    const schedule = (body: object) =>
      as(token)
        .post(`/api/v1/vehicles/${car.id}/maintenance-schedules`, {
          id: randomUUID(),
          categoryKey: "ENGINE.ENGINE_OIL",
          name: "Engine oil & filter",
          intervalKm: 10_000,
          ...body,
        })
        .expect(201);
    // 10,000 km away is inside the user's 12,000 km lead, unless the schedule sets its own.
    expect(dataOf<{ due: { status: string } }>(await schedule({})).due.status).toBe("DUE_SOON");
    expect(dataOf<{ due: { status: string } }>(await schedule({ leadKm: 500 })).due.status).toBe(
      "UP_TO_DATE",
    );
  });

  it("lists signed-in devices, signs them out, and a new password signs the others out", async () => {
    const { token, phone } = await account();
    const list = await as(token).get("/api/v1/auth/sessions").expect(200);
    expect(
      dataOf<SessionInfo[]>(list)
        .map((session) => [session.device, session.current])
        .sort(),
    ).toEqual([
      ["Chrome on Windows", true],
      ["Safari on iPhone", false],
    ]);
    expect(metaOf(list)).toMatchObject({ total: 2 });

    await as(token)
      .post("/api/v1/auth/password", { currentPassword: "wrong", newPassword: "Better2027drive" })
      .expect(400);
    await as(token)
      .post("/api/v1/auth/password", { currentPassword: PASSWORD, newPassword: "weak" })
      .expect(400);
    await as(token)
      .post("/api/v1/auth/password", { currentPassword: PASSWORD, newPassword: "Better2027drive" })
      .expect(204);
    // The phone's session is gone, so its token stops working; this one still works.
    await as(phone).get("/api/v1/users/me").expect(401);
    await as(token).get("/api/v1/users/me").expect(200);

    const again = await account();
    const sessions = dataOf<SessionInfo[]>(
      await as(again.token).get("/api/v1/auth/sessions").expect(200),
    );
    const phoneSession = sessions.find((session) => !session.current)!;
    await as(again.token).delete(`/api/v1/auth/sessions/${phoneSession.id}`).expect(204);
    await as(again.phone).get("/api/v1/users/me").expect(401);
    await as(again.token).delete(`/api/v1/auth/sessions/${phoneSession.id}`).expect(404);
  });

  it("deletes the account and its files, for good, after the password and DELETE", async () => {
    const { token, email } = await account();
    await as(token)
      .post("/api/v1/users/me/delete", { password: PASSWORD, confirm: "delete" })
      .expect(400);
    await as(token)
      .post("/api/v1/users/me/delete", { password: "wrong", confirm: "DELETE" })
      .expect(400);
    const deleted = await as(token)
      .post("/api/v1/users/me/delete", { password: PASSWORD, confirm: "DELETE" })
      .expect(204);
    expect(String(deleted.headers["set-cookie"] ?? "")).toContain("automate_rt=;");
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    await as(token).get("/api/v1/users/me").expect(401);
  });
});
