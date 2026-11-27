/**
 * Boots the real AppModule through the same configureApp() as main.ts.
 * Needs PostgreSQL running (docker compose up -d) and DATABASE_URL in apps/api/.env or the environment.
 */
import type { ApiErrorResponse, ApiSuccessResponse } from "@automate/shared";
import { Body, Controller, Get, Module, Post } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import { createZodDto } from "nestjs-zod";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { AppModule } from "@/app.module";
import { configureApp } from "@/app.setup";
import { JWT_AUDIENCE, JWT_ISSUER } from "@/modules/auth/auth.constants";
import type { AuthUser } from "@/modules/auth/auth.types";
import { CurrentUser } from "@/modules/auth/decorators/current-user.decorator";
import { Public } from "@/modules/auth/decorators/public.decorator";

class OdometerDto extends createZodDto(z.object({ odometer: z.number().positive() })) {}

/** Test-only routes: one protected by the global guard, one public with Zod validation. */
@Controller("e2e")
class E2eController {
  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Public()
  @Post("odometer")
  odometer(@Body() body: OdometerDto) {
    return body;
  }
}

describe("API (e2e)", () => {
  let app: NestExpressApplication;
  let jwt: JwtService;

  beforeAll(async () => {
    @Module({ imports: [AppModule], controllers: [E2eController] })
    class TestAppModule {}

    const moduleRef = await Test.createTestingModule({ imports: [TestAppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      bodyParser: false,
      bufferLogs: true,
    });
    configureApp(app);
    await app.init();
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app?.close();
  });

  const http = () => request(app.getHttpServer());
  const errorOf = (res: request.Response) => (res.body as ApiErrorResponse).error;
  const dataOf = (res: request.Response) => (res.body as ApiSuccessResponse<unknown>).data;

  it("GET /api/v1/health reports the database as up inside the success envelope", async () => {
    const res = await http().get("/api/v1/health").expect(200);
    expect(res.headers["x-request-id"]).toBeTruthy();
    expect(res.body).toMatchObject({
      success: true,
      data: { status: "ok", checks: { database: "up" }, app: { name: "automate-api" } },
      meta: null,
    });
  });

  it("unknown routes return the error envelope with the correlation id", async () => {
    const res = await http()
      .get("/api/v1/does-not-exist")
      .set("x-request-id", "e2e-trace-1")
      .expect(404);
    expect(res.headers["x-request-id"]).toBe("e2e-trace-1");
    expect(res.body).toEqual({
      success: false,
      message: expect.any(String) as string,
      error: { code: "NOT_FOUND", details: [], requestId: "e2e-trace-1" },
    });
  });

  it("routes are protected by default", async () => {
    const res = await http().get("/api/v1/e2e/me").expect(401);
    expect(errorOf(res).code).toBe("UNAUTHORIZED");
  });

  it("accepts a valid access token and exposes the user", async () => {
    const token = jwt.sign({ sub: "user-123" });
    const res = await http().get("/api/v1/e2e/me").auth(token, { type: "bearer" }).expect(200);
    expect(dataOf(res)).toEqual({ id: "user-123" });
  });

  it("rejects a token signed with another secret", async () => {
    const forged = new JwtService({ secret: "attacker-secret-".padEnd(48, "y") }).sign(
      { sub: "user-123" },
      { issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
    );
    await http().get("/api/v1/e2e/me").auth(forged, { type: "bearer" }).expect(401);
  });

  it("validates bodies with Zod and reports field errors", async () => {
    const res = await http().post("/api/v1/e2e/odometer").send({ odometer: -1 }).expect(400);
    expect(errorOf(res).code).toBe("VALIDATION_ERROR");
    expect(errorOf(res).details).toEqual([
      { field: "odometer", message: expect.any(String) as string },
    ]);
  });

  it("wraps successful POST responses", async () => {
    const res = await http().post("/api/v1/e2e/odometer").send({ odometer: 1200 }).expect(201);
    expect(res.body).toMatchObject({ success: true, data: { odometer: 1200 } });
  });

  it("rejects oversized JSON bodies with 413", async () => {
    const res = await http()
      .post("/api/v1/e2e/odometer")
      .send({ padding: "a".repeat(200_000) })
      .expect(413);
    expect(errorOf(res).code).toBe("PAYLOAD_TOO_LARGE");
    expect(errorOf(res).requestId).toBe(res.headers["x-request-id"]);
  });
});
