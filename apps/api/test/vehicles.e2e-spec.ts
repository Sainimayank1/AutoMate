/**
 * Garage API through the real HTTP pipeline and database (docker compose up -d).
 * Users are created under a throwaway domain and deleted afterwards (their vehicles cascade).
 */
import { randomUUID } from "node:crypto";

import type { ApiErrorResponse, ApiSuccessResponse, Vehicle } from "@automate/shared";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "@/app.module";
import { configureApp } from "@/app.setup";
import { PrismaService } from "@/database/prisma.service";
import { AuthService } from "@/modules/auth/auth.service";

/** Unique per test file: files run in parallel and each cleans up only its own users. */
const DOMAIN = "vehicles.e2e.automate.test";
const VEHICLES = "/api/v1/vehicles";

const victoris = {
  make: "Maruti Suzuki",
  model: "Victoris",
  variant: "LXI",
  manufacturingYear: 2025,
  category: "SUV",
  registrationNumber: "hr-26 ev-4821",
  fuelType: "PETROL",
  transmission: "MANUAL",
  engineCapacityCc: "1,462",
  fuelTankCapacityL: 45,
  ownershipType: "OWNED",
  purchaseDate: "2025-02-14",
  purchasePrice: "11,45,000",
  odometerKm: 8450,
};

describe("Vehicles (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let arjun: string;
  let priya: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      bodyParser: false,
      bufferLogs: true,
    });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const signUp = async (name: string) =>
      (
        await app.get(AuthService).register(
          {
            name,
            email: `vehicles-${randomUUID()}@${DOMAIN}`,
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
  const errorOf = (res: request.Response) => (res.body as ApiErrorResponse).error;

  async function create(token: string, overrides: object = {}) {
    const res = await as(token)
      .post(VEHICLES, { ...victoris, registrationNumber: plate(), ...overrides })
      .expect(201);
    return dataOf<Vehicle>(res);
  }
  /** A fresh valid plate per call, e.g. KA01AB1234. */
  const plate = () =>
    `KA${String(Math.floor(Math.random() * 90) + 10)}AB${Math.floor(1000 + Math.random() * 9000)}`;

  it("creates a vehicle with normalised values and a computed profile completion", async () => {
    const res = await as(arjun).post(VEHICLES, victoris).expect(201);
    const vehicle = dataOf<Vehicle>(res);

    expect(vehicle).toMatchObject({
      make: "Maruti Suzuki",
      model: "Victoris",
      registrationNumber: "HR26EV4821",
      engineCapacityCc: 1462,
      purchasePrice: "1145000.00",
      purchaseDate: "2025-02-14",
      odometerKm: 8450,
      colour: null,
      archivedAt: null,
    });
    expect(vehicle.profileCompletion).toBe(58); // 9 required + 5 of 15 optional
    expect(vehicle).not.toHaveProperty("userId");

    const fetched = await as(arjun).get(`${VEHICLES}/${vehicle.id}`).expect(200);
    expect(dataOf<Vehicle>(fetched)).toEqual(vehicle);
  });

  it("accepts a client-generated id (offline-ready) and ignores ids on update", async () => {
    const id = randomUUID();
    const vehicle = await create(arjun, { id });
    expect(vehicle.id).toBe(id);
    const res = await as(arjun)
      .patch(`${VEHICLES}/${id}`, { id: randomUUID(), colour: "Grey" })
      .expect(200);
    expect(dataOf<Vehicle>(res)).toMatchObject({ id, colour: "Grey" });
  });

  it("refuses a registration already in the garage, with the error on that field", async () => {
    const existing = await create(arjun);
    const res = await as(arjun)
      .post(VEHICLES, {
        ...victoris,
        registrationNumber: existing.registrationNumber.toLowerCase(),
      })
      .expect(409);
    expect(errorOf(res).code).toBe("CONFLICT");
    expect(errorOf(res).details).toEqual([
      {
        field: "registrationNumber",
        message: "A vehicle in your garage already has this registration.",
      },
    ]);
    // Another user may own a car with the same plate (resale): no clash across users.
    await as(priya)
      .post(VEHICLES, { ...victoris, registrationNumber: existing.registrationNumber })
      .expect(201);
  });

  it("validates input with per-field messages", async () => {
    const res = await as(arjun)
      .post(VEHICLES, { ...victoris, registrationNumber: "12", odometerKm: -5, fuelType: "STEAM" })
      .expect(400);
    const fields = (errorOf(res).details as { field: string }[]).map((detail) => detail.field);
    expect(fields).toEqual(
      expect.arrayContaining(["registrationNumber", "odometerKm", "fuelType"]),
    );
  });

  it("updates only the fields sent; null clears an optional field", async () => {
    const vehicle = await create(arjun, { colour: "Pearl Silver" });
    const res = await as(arjun)
      .patch(`${VEHICLES}/${vehicle.id}`, {
        odometerKm: 9100,
        colour: null,
        tyreSize: "215/60 R17",
      })
      .expect(200);
    expect(dataOf<Vehicle>(res)).toMatchObject({
      odometerKm: 9100,
      colour: null,
      tyreSize: "215/60 R17",
      model: "Victoris",
      purchasePrice: "1145000.00",
    });
  });

  it("archives and restores; archived vehicles are listed separately", async () => {
    const vehicle = await create(arjun);

    const archived = await as(arjun).post(`${VEHICLES}/${vehicle.id}/archive`).expect(200);
    expect(dataOf<Vehicle>(archived).archivedAt).not.toBeNull();

    const inUse = dataOf<Vehicle[]>(await as(arjun).get(VEHICLES).expect(200));
    const archivedList = dataOf<Vehicle[]>(
      await as(arjun).get(`${VEHICLES}?archived=true`).expect(200),
    );
    expect(inUse.map((v) => v.id)).not.toContain(vehicle.id);
    expect(archivedList.map((v) => v.id)).toContain(vehicle.id);

    const restored = await as(arjun).post(`${VEHICLES}/${vehicle.id}/restore`).expect(200);
    expect(dataOf<Vehicle>(restored).archivedAt).toBeNull();
  });

  it("tells you to restore when an archived vehicle already has the registration", async () => {
    const vehicle = await create(arjun);
    await as(arjun).post(`${VEHICLES}/${vehicle.id}/archive`).expect(200);
    const res = await as(arjun)
      .post(VEHICLES, { ...victoris, registrationNumber: vehicle.registrationNumber })
      .expect(409);
    const [detail] = errorOf(res).details as { field: string; message: string }[];
    expect(detail?.field).toBe("registrationNumber");
    expect(detail?.message).toMatch(/Restore it instead/);
  });

  it("deletes permanently", async () => {
    const vehicle = await create(arjun);
    await as(arjun).delete(`${VEHICLES}/${vehicle.id}`).expect(204);
    await as(arjun).get(`${VEHICLES}/${vehicle.id}`).expect(404);
    await as(arjun).delete(`${VEHICLES}/${vehicle.id}`).expect(404);
  });

  it("never exposes or changes another user's vehicle (404, not 403)", async () => {
    const mine = await create(arjun);
    const url = `${VEHICLES}/${mine.id}`;

    await as(priya).get(url).expect(404);
    await as(priya).patch(url, { odometerKm: 1 }).expect(404);
    await as(priya).post(`${url}/archive`).expect(404);
    await as(priya).delete(url).expect(404);
    expect(
      dataOf<Vehicle[]>(await as(priya).get(VEHICLES).expect(200)).map((v) => v.id),
    ).not.toContain(mine.id);

    // Untouched for the owner.
    expect(dataOf<Vehicle>(await as(arjun).get(url).expect(200))).toEqual(mine);
  });

  it("requires sign-in and a well-formed id", async () => {
    await request(app.getHttpServer()).get(VEHICLES).expect(401);
    await as(arjun).get(`${VEHICLES}/not-a-uuid`).expect(400);
  });
});
