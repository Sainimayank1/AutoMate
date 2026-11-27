/**
 * Fuel API through the real HTTP pipeline and database (docker compose up -d).
 * Users are created under a throwaway domain and deleted afterwards (vehicles and fill-ups cascade).
 */
import { randomUUID } from "node:crypto";

import type {
  ApiErrorResponse,
  ApiSuccessResponse,
  FuelEntry,
  FuelSummary,
  Vehicle,
} from "@automate/shared";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { AppModule } from "@/app.module";
import { configureApp } from "@/app.setup";
import { PrismaService } from "@/database/prisma.service";
import { AuthService } from "@/modules/auth/auth.service";

const DOMAIN = "fuel.e2e.automate.test";
const VEHICLES = "/api/v1/vehicles";

const fillUp = {
  filledAt: "2026-11-24T08:30:00.000Z",
  odometerKm: "8,412",
  fuelType: "PETROL",
  quantity: "32.40",
  pricePerUnit: "104.32",
  totalAmount: "3,380",
  isFullTank: true,
  stationName: "IndianOil XP95",
  paymentMethod: "UPI",
};

describe("Fuel (e2e)", () => {
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
            email: `fuel-${randomUUID()}@${DOMAIN}`,
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

  async function vehicle(token: string, overrides: object = {}) {
    const plate = `KA${Math.floor(10 + Math.random() * 89)}FU${Math.floor(1000 + Math.random() * 9000)}`;
    const res = await as(token)
      .post(VEHICLES, {
        make: "Maruti Suzuki",
        model: "Victoris",
        manufacturingYear: 2025,
        category: "SUV",
        registrationNumber: plate,
        fuelType: "PETROL",
        transmission: "MANUAL",
        ownershipType: "OWNED",
        odometerKm: 7000,
        ...overrides,
      })
      .expect(201);
    return dataOf<Vehicle>(res);
  }
  const entries = (vehicleId: string) => `${VEHICLES}/${vehicleId}/fuel-entries`;

  it("logs fill-ups, computes mileage across a partial fill and raises the odometer", async () => {
    const car = await vehicle(arjun);
    const first = await as(arjun)
      .post(entries(car.id), { ...fillUp, filledAt: "2026-10-26T08:00:00.000Z", odometerKm: 7490 })
      .expect(201);
    expect(dataOf<FuelEntry>(first)).toMatchObject({
      odometerKm: 7490,
      quantity: "32.400",
      pricePerUnit: "104.320",
      totalAmount: "3380.00",
      paymentMethod: "UPI",
      mileageStatus: "BASELINE",
      mileage: null,
      missedPrevious: false,
    });
    await as(arjun)
      .post(entries(car.id), {
        ...fillUp,
        filledAt: "2026-11-09T08:00:00.000Z",
        odometerKm: 7864,
        quantity: "14.2",
        totalAmount: "1481.34",
        isFullTank: false,
      })
      .expect(201);
    const last = await as(arjun).post(entries(car.id), fillUp).expect(201);
    // (8412 − 7490) km / (14.2 + 32.4) L
    expect(dataOf<FuelEntry>(last)).toMatchObject({
      mileageStatus: "CALCULATED",
      mileage: "19.79",
      distanceKm: 548,
    });

    const list = dataOf<FuelEntry[]>(await as(arjun).get(entries(car.id)).expect(200));
    expect(list.map((entry) => entry.mileageStatus)).toEqual([
      "CALCULATED",
      "ROLLED_IN",
      "BASELINE",
    ]);

    const summary = dataOf<FuelSummary>(
      await as(arjun).get(`${VEHICLES}/${car.id}/fuel-summary`).expect(200),
    );
    expect(summary).toMatchObject({ fillCount: 3, averageMileage: "19.79", mileageSequences: 1 });

    const updated = dataOf<Vehicle>(await as(arjun).get(`${VEHICLES}/${car.id}`).expect(200));
    expect(updated.odometerKm).toBe(8412);
  });

  it("keeps one odometer history: the error lands on the reading", async () => {
    const car = await vehicle(arjun);
    await as(arjun).post(entries(car.id), fillUp).expect(201);

    const lower = await as(arjun)
      .post(entries(car.id), { ...fillUp, filledAt: "2026-11-25T08:00:00.000Z", odometerKm: 8000 })
      .expect(409);
    expect(errorOf(lower).details).toEqual([
      { field: "odometerKm", message: expect.stringContaining("Lower than 8,412 km") as string },
    ]);

    const higherThanLater = await as(arjun)
      .post(entries(car.id), { ...fillUp, filledAt: "2026-11-01T08:00:00.000Z", odometerKm: 9000 })
      .expect(409);
    expect(errorOf(higherThanLater).details[0]).toMatchObject({ field: "odometerKm" });

    // Back-logging an older fill-up with an older reading is fine, and doesn't lower the vehicle.
    await as(arjun)
      .post(entries(car.id), { ...fillUp, filledAt: "2026-11-01T08:00:00.000Z", odometerKm: 7900 })
      .expect(201);
    const updated = dataOf<Vehicle>(await as(arjun).get(`${VEHICLES}/${car.id}`).expect(200));
    expect(updated.odometerKm).toBe(8412);
  });

  it("validates amounts, the fuel and the date", async () => {
    const car = await vehicle(arjun);
    const mismatch = await as(arjun)
      .post(entries(car.id), { ...fillUp, totalAmount: "4380" })
      .expect(400);
    expect(errorOf(mismatch).details).toEqual([
      { field: "totalAmount", message: expect.stringContaining("₹3,379.97") as string },
    ]);

    const wrongFuel = await as(arjun)
      .post(entries(car.id), { ...fillUp, fuelType: "DIESEL" })
      .expect(400);
    expect(errorOf(wrongFuel).details).toEqual([
      { field: "fuelType", message: expect.any(String) as string },
    ]);

    const future = await as(arjun)
      .post(entries(car.id), { ...fillUp, filledAt: "2099-01-01T00:00:00.000Z" })
      .expect(400);
    expect(errorOf(future).code).toBe("VALIDATION_ERROR");
  });

  it("lets a bi-fuel CNG car log petrol too", async () => {
    const car = await vehicle(arjun, { fuelType: "CNG" });
    await as(arjun)
      .post(entries(car.id), {
        ...fillUp,
        fuelType: "CNG",
        quantity: "8",
        pricePerUnit: "90",
        totalAmount: "720",
      })
      .expect(201);
    await as(arjun)
      .post(entries(car.id), { ...fillUp, filledAt: "2026-11-25T08:00:00.000Z", odometerKm: 8500 })
      .expect(201);
  });

  it("updates a fill-up, re-checking the merged amount and the odometer order", async () => {
    const car = await vehicle(arjun);
    const older = dataOf<FuelEntry>(
      await as(arjun)
        .post(entries(car.id), {
          ...fillUp,
          filledAt: "2026-11-01T08:00:00.000Z",
          odometerKm: 8000,
        })
        .expect(201),
    );
    await as(arjun).post(entries(car.id), fillUp).expect(201);

    const res = await as(arjun)
      .patch(`${entries(car.id)}/${older.id}`, { notes: "Highway run", stationName: "" })
      .expect(200);
    expect(dataOf<FuelEntry>(res)).toMatchObject({ notes: "Highway run", stationName: null });

    await as(arjun)
      .patch(`${entries(car.id)}/${older.id}`, { quantity: "50" })
      .expect(400);
    await as(arjun)
      .patch(`${entries(car.id)}/${older.id}`, { odometerKm: 8500 })
      .expect(409);
  });

  it("stores where the fill-up happened, as a coordinate pair", async () => {
    const car = await vehicle(arjun);
    const placed = {
      ...fillUp,
      latitude: 28.4595,
      longitude: 77.0726,
      location: "Sector 29, Gurugram, Haryana",
    };
    const created = dataOf<FuelEntry>(await as(arjun).post(entries(car.id), placed).expect(201));
    expect(created).toMatchObject({
      latitude: 28.4595,
      longitude: 77.0726,
      location: "Sector 29, Gurugram, Haryana",
    });

    const half = await as(arjun)
      .post(entries(car.id), {
        ...placed,
        filledAt: "2026-11-25T08:00:00.000Z",
        longitude: undefined,
      })
      .expect(400);
    expect(errorOf(half).details[0]).toMatchObject({ field: "longitude" });

    const cleared = await as(arjun)
      .patch(`${entries(car.id)}/${created.id}`, {
        latitude: null,
        longitude: null,
        location: null,
      })
      .expect(200);
    expect(dataOf<FuelEntry>(cleared)).toMatchObject({
      latitude: null,
      longitude: null,
      location: null,
    });
  });

  it("looks up the address of a point for signed-in users only", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            address: { suburb: "Sector 29", city: "Gurugram", state: "Haryana" },
          }),
        ),
      ),
    );
    try {
      const res = await as(arjun)
        .post("/api/v1/geocode/reverse", { latitude: 28.4595, longitude: 77.0726 })
        .expect(200);
      expect(dataOf<{ address: string | null }>(res)).toEqual({
        address: "Sector 29, Gurugram, Haryana",
      });
      await as(arjun).post("/api/v1/geocode/reverse", { latitude: 95, longitude: 77 }).expect(400);
      await request(app.getHttpServer())
        .post("/api/v1/geocode/reverse")
        .send({ latitude: 28, longitude: 77 })
        .expect(401);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("refuses new fill-ups on an archived vehicle", async () => {
    const car = await vehicle(arjun);
    await as(arjun).post(`${VEHICLES}/${car.id}/archive`).expect(200);
    const res = await as(arjun).post(entries(car.id), fillUp).expect(409);
    expect(errorOf(res).code).toBe("CONFLICT");
  });

  it("deletes a fill-up", async () => {
    const car = await vehicle(arjun);
    const entry = dataOf<FuelEntry>(await as(arjun).post(entries(car.id), fillUp).expect(201));
    await as(arjun)
      .delete(`${entries(car.id)}/${entry.id}`)
      .expect(204);
    await as(arjun)
      .get(`${entries(car.id)}/${entry.id}`)
      .expect(404);
    await as(arjun)
      .delete(`${entries(car.id)}/${entry.id}`)
      .expect(404);
  });

  it("hides one user's fuel records from another (404, never 403)", async () => {
    const car = await vehicle(arjun);
    const entry = dataOf<FuelEntry>(await as(arjun).post(entries(car.id), fillUp).expect(201));

    await as(priya).get(entries(car.id)).expect(404);
    await as(priya).get(`${VEHICLES}/${car.id}/fuel-summary`).expect(404);
    await as(priya)
      .get(`${entries(car.id)}/${entry.id}`)
      .expect(404);
    await as(priya).post(entries(car.id), fillUp).expect(404);
    await as(priya)
      .patch(`${entries(car.id)}/${entry.id}`, { notes: "x" })
      .expect(404);
    await as(priya)
      .delete(`${entries(car.id)}/${entry.id}`)
      .expect(404);

    // Nor through her own vehicle's URL.
    const hers = await vehicle(priya);
    await as(priya)
      .get(`${entries(hers.id)}/${entry.id}`)
      .expect(404);
  });
});
