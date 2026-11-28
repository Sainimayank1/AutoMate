/** App-wide search through the real HTTP pipeline: grouped, own records only, paginated. */
import { randomUUID } from "node:crypto";

import {
  addDays,
  type ApiSuccessResponse,
  istToday,
  type PageMeta,
  type SearchResult,
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

const DOMAIN = "search.e2e.automate.test";

describe("Search (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let daily: string;

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
    daily = (await prisma.expenseCategory.findFirstOrThrow({ where: { key: "DAILY_USAGE" } })).id;
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
          email: `search-${randomUUID()}@${DOMAIN}`,
          password: "Drive2026safe",
          acceptedTerms: true,
        },
        {},
      )
    ).session.accessToken;
  const as = (token: string) => ({
    get: (url: string) => request(app.getHttpServer()).get(url).auth(token, { type: "bearer" }),
    post: (url: string, body: object) =>
      request(app.getHttpServer()).post(url).auth(token, { type: "bearer" }).send(body),
  });
  const dataOf = <T>(res: request.Response) => (res.body as ApiSuccessResponse<T>).data;

  it("finds the user's own records by name, number or notes, vehicles first", async () => {
    const token = await signUp();
    const plate = `HR${Math.floor(10 + Math.random() * 89)}EV${Math.floor(1000 + Math.random() * 9000)}`;
    const car = dataOf<Vehicle>(
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
        })
        .expect(201),
    );
    await as(token)
      .post("/api/v1/expenses", {
        allocation: { mode: "single", vehicleId: car.id },
        categoryId: daily,
        title: "Victoris ceramic coating",
        amount: "18000",
        date: addDays(istToday(new Date()), -1),
      })
      .expect(201);
    await as(token)
      .post("/api/v1/documents", {
        vehicleId: car.id,
        type: "PUC",
        name: "PUC certificate",
        number: "HR026-PUC-9921",
        expiryDate: addDays(istToday(new Date()), 60),
      })
      .expect(201);

    const victoris = dataOf<SearchResult[]>(
      await as(token).get("/api/v1/search?q=victoris").expect(200),
    );
    expect(victoris.map((result) => [result.kind, result.title])).toEqual([
      ["vehicle", "Maruti Suzuki Victoris"],
      ["expense", "Victoris ceramic coating"],
    ]);
    expect(victoris[0]!.href).toBe(`/garage/${car.id}`);

    const byNumber = await as(token).get("/api/v1/search?q=puc-9921&pageSize=1").expect(200);
    expect(dataOf<SearchResult[]>(byNumber)[0]).toMatchObject({
      kind: "document",
      title: "PUC certificate",
    });
    expect((byNumber.body as ApiSuccessResponse<unknown, PageMeta>).meta).toMatchObject({
      total: 1,
    });

    const other = await signUp();
    expect(
      dataOf<SearchResult[]>(await as(other).get("/api/v1/search?q=victoris").expect(200)),
    ).toEqual([]);
    await as(token).get("/api/v1/search?q=v").expect(400);
  });
});
