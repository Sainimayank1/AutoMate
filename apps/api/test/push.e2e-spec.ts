/**
 * Web Push, quiet hours and repeating reminders through the real pipeline. Push delivery itself
 * is replaced (no push service is called): what's checked is what would be sent, and when.
 */
import { randomUUID } from "node:crypto";

import {
  addDays,
  type ApiSuccessResponse,
  istToday,
  type PushConfig,
  type PushPayload,
  type Reminder,
  type UserPreferences,
} from "@automate/shared";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import webpush from "web-push";

import { AppModule } from "@/app.module";
import { configureApp } from "@/app.setup";
import { PrismaService } from "@/database/prisma.service";
import { AuthService } from "@/modules/auth/auth.service";
import { PushService } from "@/modules/notifications/push.service";

const DOMAIN = "push.e2e.automate.test";
const SECRET = "dispatch-secret-".padEnd(48, "x");

describe("Push (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let push: PushService;
  const sent: { endpoint: string; payload: PushPayload }[] = [];
  let outcome: "sent" | "gone" = "sent";
  const today = istToday(new Date());

  beforeAll(async () => {
    const keys = webpush.generateVAPIDKeys();
    process.env.PUSH_VAPID_PUBLIC_KEY = keys.publicKey;
    process.env.PUSH_VAPID_PRIVATE_KEY = keys.privateKey;
    process.env.PUSH_CONTACT = "mailto:push@example.test";
    process.env.DISPATCH_SECRET = SECRET;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      bodyParser: false,
      bufferLogs: true,
    });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    push = app.get(PushService);
    vi.spyOn(push, "deliver").mockImplementation((device, payload) => {
      sent.push({ endpoint: device.endpoint, payload });
      return Promise.resolve(outcome);
    });
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
          email: `push-${randomUUID()}@${DOMAIN}`,
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
  });
  const dataOf = <T>(res: request.Response) => (res.body as ApiSuccessResponse<T>).data;
  const dispatch = (secret = SECRET) =>
    request(app.getHttpServer())
      .post("/api/v1/internal/notifications/dispatch")
      .set("authorization", `Bearer ${secret}`);
  const device = (endpoint: string) => ({
    endpoint,
    keys: {
      p256dh:
        "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
      auth: "tBHItJI5svbpez7KI4CCXg", // gitleaks:allow (example push subscription key, test data)
    },
  });

  it("pushes what's new to the user's devices once, and never during quiet hours", async () => {
    const token = await signUp();
    expect(
      dataOf<PushConfig>(await as(token).get("/api/v1/notifications/push/config").expect(200))
        .publicKey,
    ).toBeTruthy();
    const endpoint = `https://push.example.test/${randomUUID()}`;
    await as(token).post("/api/v1/notifications/push/subscriptions", device(endpoint)).expect(204);
    await as(token)
      .post("/api/v1/reminders", { title: "Renew FASTag KYC", dueDate: addDays(today, -2) })
      .expect(201);

    // Quiet all day: nothing goes, and it waits.
    await as(token)
      .patch("/api/v1/users/me/preferences", { quietHours: { start: "00:00", end: "23:59" } })
      .expect(200);
    await dispatch().expect(200);
    expect(sent.filter((item) => item.endpoint === endpoint)).toEqual([]);

    const prefs = dataOf<UserPreferences>(
      await as(token).patch("/api/v1/users/me/preferences", { quietHours: null }).expect(200),
    );
    expect(prefs.quietHours).toBeNull();
    await dispatch().expect(200);
    const mine = sent.filter((item) => item.endpoint === endpoint);
    expect(mine.map((item) => item.payload.title)).toEqual([
      expect.stringMatching(/^Renew FASTag KYC was due on /),
    ]);
    expect(mine[0]!.payload.href).toMatch(/^\/notifications\/reminders\?reminder=/);

    // Never twice.
    await dispatch().expect(200);
    expect(sent.filter((item) => item.endpoint === endpoint)).toHaveLength(1);

    await dispatch("wrong-secret").expect(401);
  });

  it("drops a device the push service no longer knows", async () => {
    const token = await signUp();
    const endpoint = `https://push.example.test/${randomUUID()}`;
    await as(token).post("/api/v1/notifications/push/subscriptions", device(endpoint)).expect(204);
    await as(token)
      .post("/api/v1/reminders", { title: "Pay the parking fee", dueDate: addDays(today, -1) })
      .expect(201);
    outcome = "gone";
    await dispatch().expect(200);
    outcome = "sent";
    expect(await prisma.pushSubscription.findUnique({ where: { endpoint } })).toBeNull();
  });

  it("moves a repeating reminder to its next date when done", async () => {
    const token = await signUp();
    const monthly = dataOf<Reminder>(
      await as(token)
        .post("/api/v1/reminders", {
          title: "Wash the car",
          dueDate: addDays(today, 1),
          repeat: "MONTHLY",
        })
        .expect(201),
    );
    expect(monthly.repeat).toBe("MONTHLY");
    const next = dataOf<Reminder>(
      await as(token).post(`/api/v1/reminders/${monthly.id}/done`).expect(200),
    );
    expect(next.doneAt).toBeNull();
    expect(next.dueDate > monthly.dueDate).toBe(true);
    expect(next.state).toBe("UPCOMING");
  });
});
