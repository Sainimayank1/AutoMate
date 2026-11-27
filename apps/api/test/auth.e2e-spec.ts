/**
 * Auth flow through the real HTTP pipeline and database (docker compose up -d).
 * Users are created under a throwaway domain and deleted afterwards.
 */
import { randomUUID } from "node:crypto";

import type { ApiErrorResponse, ApiSuccessResponse, AuthSession } from "@automate/shared";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "@/app.module";
import { configureApp } from "@/app.setup";
import { PrismaService } from "@/database/prisma.service";
import { AuthService } from "@/modules/auth/auth.service";

const DOMAIN = "e2e.automate.test";
const PASSWORD = "Drive2026safe";
const AUTH = "/api/v1/auth";

const newEmail = () => `user-${randomUUID()}@${DOMAIN}`;

describe("Auth (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      bodyParser: false,
      bufferLogs: true,
    });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma?.user.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } });
    await app?.close();
  });

  const http = () => request(app.getHttpServer());
  const sessionOf = (res: request.Response) => (res.body as ApiSuccessResponse<AuthSession>).data;
  const errorOf = (res: request.Response) => res.body as ApiErrorResponse;

  /** The refresh cookie's Set-Cookie line, if the response set one. */
  const setCookieOf = (res: request.Response) =>
    ([] as string[])
      .concat(res.headers["set-cookie"] ?? [])
      .find((line) => line.startsWith("automate_rt="));
  /** "automate_rt=<token>", ready for a Cookie header. */
  const cookieOf = (res: request.Response) => setCookieOf(res)?.split(";")[0] ?? "";

  /** Registers over HTTP: only for the tests about the register endpoint itself (it is rate-limited). */
  async function register(email = newEmail()) {
    const res = await http()
      .post(`${AUTH}/register`)
      .send({ name: "Arjun Mehta", email, password: PASSWORD, acceptedTerms: true })
      .expect(201);
    return { res, email, cookie: cookieOf(res), session: sessionOf(res) };
  }

  /** Arrange step: a user with a live session, created through the service so setup isn't rate-limited. */
  async function signUp(email = newEmail()) {
    const issued = await app
      .get(AuthService)
      .register({ name: "Arjun Mehta", email, password: PASSWORD, acceptedTerms: true }, {});
    return { email, cookie: `automate_rt=${issued.refreshToken}`, session: issued.session };
  }

  it("registers, hashes the password, sets a scoped httpOnly cookie and returns a working access token", async () => {
    const email = newEmail();
    const { res, session } = await register(`  ${email.toUpperCase()} `);

    expect(session.user).toMatchObject({ name: "Arjun Mehta", email });
    expect(session.user).not.toHaveProperty("passwordHash");
    expect(session.expiresIn).toBe(900);

    const cookie = setCookieOf(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Max-Age=2592000/); // registration keeps the user signed in

    const stored = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    expect(stored.passwordHash).not.toContain(PASSWORD);

    const me = await http()
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${session.accessToken}`)
      .expect(200);
    expect((me.body as ApiSuccessResponse<unknown>).data).toEqual(session.user);
  });

  it("rejects a duplicate email with a field error on email", async () => {
    const { email } = await signUp();
    const res = await http()
      .post(`${AUTH}/register`)
      .send({ name: "Someone Else", email, password: PASSWORD, acceptedTerms: true })
      .expect(409);
    expect(errorOf(res).error.code).toBe("CONFLICT");
    expect(errorOf(res).error.details).toEqual([
      { field: "email", message: "An account with this email already exists" },
    ]);
  });

  it("validates registration with per-field messages", async () => {
    const res = await http()
      .post(`${AUTH}/register`)
      .send({ name: "A", email: "not-an-email", password: "lettersonly", acceptedTerms: false })
      .expect(400);
    const fields = (errorOf(res).error.details as { field: string; message: string }[]).map(
      (detail) => `${detail.field}: ${detail.message}`,
    );
    expect(fields).toEqual(
      expect.arrayContaining([
        "name: Enter your full name",
        "email: Enter a valid email address",
        "password: Include at least one number",
        "acceptedTerms: Accept the Terms of Service and Privacy Policy to continue",
      ]),
    );
  });

  it("gives the same 401 for a wrong password and an unknown email", async () => {
    const { email } = await signUp();
    const wrongPassword = await http()
      .post(`${AUTH}/login`)
      .send({ email, password: "Wrong2026pass" })
      .expect(401);
    const unknownEmail = await http()
      .post(`${AUTH}/login`)
      .send({ email: newEmail(), password: PASSWORD })
      .expect(401);
    expect(errorOf(wrongPassword).message).toBe("Incorrect email or password.");
    expect(errorOf(unknownEmail).message).toBe(errorOf(wrongPassword).message);
    expect(setCookieOf(wrongPassword)).toBeUndefined();
  });

  it("signs in; without 'keep me signed in' the cookie ends with the browser session", async () => {
    const { email } = await signUp();
    const res = await http()
      .post(`${AUTH}/login`)
      .send({ email, password: PASSWORD, rememberMe: false })
      .expect(200);
    expect(sessionOf(res).user.email).toBe(email);
    expect(setCookieOf(res)).not.toMatch(/Max-Age|Expires/i);
  });

  it("rotates the refresh token: the new one works, the old one is refused and cleared", async () => {
    const { cookie: first } = await signUp();

    const rotated = await http().post(`${AUTH}/refresh`).set("Cookie", first).expect(200);
    const second = cookieOf(rotated);
    expect(second).not.toBe(first);
    expect(sessionOf(rotated).accessToken).toBeTruthy();

    const reused = await http().post(`${AUTH}/refresh`).set("Cookie", first).expect(401);
    expect(errorOf(reused).error.code).toBe("UNAUTHORIZED");
    expect(setCookieOf(reused)).toMatch(/automate_rt=;/); // cleared

    await http().post(`${AUTH}/refresh`).set("Cookie", second).expect(200);
  });

  it("logout ends the session for good", async () => {
    const { cookie } = await signUp();
    const res = await http().post(`${AUTH}/logout`).set("Cookie", cookie).expect(204);
    expect(setCookieOf(res)).toMatch(/automate_rt=;/);
    await http().post(`${AUTH}/refresh`).set("Cookie", cookie).expect(401);
    // Logging out twice (or with no cookie) is harmless.
    await http().post(`${AUTH}/logout`).expect(204);
  });

  const me = (accessToken: string) =>
    http().get("/api/v1/users/me").set("Authorization", `Bearer ${accessToken}`);

  it("logout revokes the access token immediately, not when it expires", async () => {
    const { cookie, session } = await signUp();
    await me(session.accessToken).expect(200);

    await http().post(`${AUTH}/logout`).set("Cookie", cookie).expect(204);

    const res = await me(session.accessToken).expect(401);
    expect(errorOf(res).error.code).toBe("UNAUTHORIZED");
  });

  it("deleting a user's sessions in the database signs out every device", async () => {
    const { email, cookie: laptopCookie, session: laptop } = await signUp();
    const phoneLogin = await http()
      .post(`${AUTH}/login`)
      .send({ email, password: PASSWORD })
      .expect(200);
    const phone = sessionOf(phoneLogin);
    expect(await prisma.session.count({ where: { userId: laptop.user.id } })).toBe(2);
    await me(laptop.accessToken).expect(200);
    await me(phone.accessToken).expect(200);

    // What an admin "revoke all sessions" or a password change would do.
    await prisma.session.deleteMany({ where: { userId: laptop.user.id } });

    await me(laptop.accessToken).expect(401);
    await me(phone.accessToken).expect(401);
    await http().post(`${AUTH}/refresh`).set("Cookie", laptopCookie).expect(401);
    await http().post(`${AUTH}/refresh`).set("Cookie", cookieOf(phoneLogin)).expect(401);
  });

  it("a refreshed access token belongs to the same session", async () => {
    const { cookie, session } = await signUp();
    const rotated = await http().post(`${AUTH}/refresh`).set("Cookie", cookie).expect(200);
    await me(sessionOf(rotated).accessToken).expect(200);
    expect(await prisma.session.count({ where: { userId: session.user.id } })).toBe(1);
  });

  it("refuses refresh without a cookie, and protected routes without a token", async () => {
    await http().post(`${AUTH}/refresh`).expect(401);
    await http().get("/api/v1/users/me").expect(401);
  });

  it("refuses the cookie routes from untrusted sites (CSRF)", async () => {
    const { cookie } = await signUp();
    const res = await http()
      .post(`${AUTH}/refresh`)
      .set("Origin", "https://evil.example")
      .set("Cookie", cookie)
      .expect(403);
    expect(errorOf(res).error.code).toBe("FORBIDDEN");
    await http()
      .post(`${AUTH}/refresh`)
      .set("Origin", "http://localhost:5173")
      .set("Cookie", cookie)
      .expect(200);
  });
});
