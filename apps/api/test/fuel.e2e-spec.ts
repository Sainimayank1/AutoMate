/**
 * Fuel API through the real HTTP pipeline and database (docker compose up -d).
 * Users are created under a throwaway domain and deleted afterwards (vehicles and fill-ups cascade).
 */
import { randomUUID } from "node:crypto";

import type {
  ApiErrorResponse,
  ApiSuccessResponse,
  Expense,
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
import { seedSystemExpenseCategories } from "@/modules/expenses/expense-categories.seed";

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
    // Fill-ups file their expense under the system Fuel categories (seeded on every deploy).
    await seedSystemExpenseCategories(prisma);

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

  it("pages, filters and searches the history after computing mileage on all of it", async () => {
    const car = await vehicle(arjun);
    const days = ["2026-11-01", "2026-11-05", "2026-11-10", "2026-11-15", "2026-11-20"];
    for (const [index, day] of days.entries()) {
      await as(arjun)
        .post(entries(car.id), {
          ...fillUp,
          filledAt: `${day}T08:00:00.000Z`,
          odometerKm: 8000 + index * 300,
          isFullTank: index !== 2,
          stationName: index === 3 ? "Shell V-Power" : "IndianOil XP95",
        })
        .expect(201);
    }

    const first = await as(arjun)
      .get(`${entries(car.id)}?pageSize=2`)
      .expect(200);
    expect(dataOf<FuelEntry[]>(first).map((e) => e.odometerKm)).toEqual([9200, 8900]);
    expect((first.body as ApiSuccessResponse<FuelEntry[]>).meta).toEqual({
      page: 1,
      pageSize: 2,
      total: 5,
      totalPages: 3,
    });

    // The partial is still "rolled in": statuses come from the whole history, not the page.
    const partial = dataOf<FuelEntry[]>(
      await as(arjun)
        .get(`${entries(car.id)}?tank=partial`)
        .expect(200),
    );
    expect(partial.map((e) => [e.odometerKm, e.mileageStatus])).toEqual([[8600, "ROLLED_IN"]]);

    const shell = await as(arjun)
      .get(`${entries(car.id)}?search=shell`)
      .expect(200);
    expect(dataOf<FuelEntry[]>(shell).map((e) => e.stationName)).toEqual(["Shell V-Power"]);
    expect((shell.body as ApiSuccessResponse<FuelEntry[]>).meta).toMatchObject({ total: 1 });

    await as(arjun)
      .get(`${entries(car.id)}?tank=half`)
      .expect(400);
  });

  it("follows a corrected odometer typo down, and keeps old fills editable after a fuel change", async () => {
    const car = await vehicle(arjun);
    await as(arjun)
      .post(entries(car.id), { ...fillUp, filledAt: "2026-11-01T08:00:00.000Z", odometerKm: 7900 })
      .expect(201);
    const typo = dataOf<FuelEntry>(
      await as(arjun)
        .post(entries(car.id), { ...fillUp, odometerKm: 84120 })
        .expect(201),
    );
    const odometer = async () =>
      dataOf<Vehicle>(await as(arjun).get(`${VEHICLES}/${car.id}`).expect(200)).odometerKm;
    expect(await odometer()).toBe(84120);

    await as(arjun)
      .patch(`${entries(car.id)}/${typo.id}`, { odometerKm: 8412 })
      .expect(200);
    expect(await odometer()).toBe(8412);

    // The vehicle becomes diesel; its old petrol fill-ups can still be edited (fuel unchanged)…
    await as(arjun).patch(`${VEHICLES}/${car.id}`, { fuelType: "DIESEL" }).expect(200);
    await as(arjun)
      .patch(`${entries(car.id)}/${typo.id}`, { fuelType: "PETROL", notes: "Old car fuel" })
      .expect(200);
    // …but a fill-up can't be switched to a fuel the vehicle doesn't take.
    const other = dataOf<FuelEntry[]>(await as(arjun).get(entries(car.id)).expect(200))[1]!;
    await as(arjun)
      .patch(`${entries(car.id)}/${other.id}`, { fuelType: "CNG" })
      .expect(400);
  });

  it("keeps every fill-up's expense in step: one per fill-up, read-only in Expenses", async () => {
    const car = await vehicle(arjun);
    const linked = async () => {
      const res = await as(arjun)
        .get(`/api/v1/expenses?vehicleId=${car.id}&source=FUEL`)
        .expect(200);
      return (res.body as ApiSuccessResponse<Expense[]>).data;
    };
    // 00:30 IST on 1 Nov is still 31 Oct in UTC: the expense is dated by the day in India.
    const entry = dataOf<FuelEntry>(
      await as(arjun)
        .post(entries(car.id), {
          ...fillUp,
          filledAt: "2026-10-31T19:00:00.000Z",
          odometerKm: 8000,
        })
        .expect(201),
    );
    expect(await linked()).toEqual([
      expect.objectContaining({
        sourceId: entry.id,
        title: "IndianOil XP95",
        amount: "3380.00",
        date: "2026-11-01",
        category: expect.objectContaining({ key: "FUEL" }) as object,
        subcategory: expect.objectContaining({ key: "FUEL.PETROL" }) as object,
        description: "32.4 L at ₹104.32/L",
        odometerKm: 8000,
        paymentMethod: "UPI",
        editable: false,
      }),
    ]);

    await as(arjun)
      .patch(`${entries(car.id)}/${entry.id}`, {
        quantity: "30",
        totalAmount: "3129.60",
        stationName: "HP Power95",
      })
      .expect(200);
    expect(await linked()).toEqual([
      expect.objectContaining({
        title: "HP Power95",
        amount: "3129.60",
        description: "30 L at ₹104.32/L",
      }),
    ]);

    // The expense can't be changed from Expenses…
    const expenseId = (await linked())[0]!.id;
    await as(arjun).patch(`/api/v1/expenses/${expenseId}`, { title: "x" }).expect(409);
    await as(arjun).delete(`/api/v1/expenses/${expenseId}`).expect(409);
    // …and goes with its fill-up.
    await as(arjun)
      .delete(`${entries(car.id)}/${entry.id}`)
      .expect(204);
    expect(await linked()).toEqual([]);
  });

  it("keeps an archived vehicle's fill-ups read-only", async () => {
    const car = await vehicle(arjun);
    const entry = dataOf<FuelEntry>(await as(arjun).post(entries(car.id), fillUp).expect(201));
    await as(arjun).post(`${VEHICLES}/${car.id}/archive`).expect(200);

    const res = await as(arjun).post(entries(car.id), fillUp).expect(409);
    expect(errorOf(res).code).toBe("CONFLICT");
    await as(arjun)
      .patch(`${entries(car.id)}/${entry.id}`, { notes: "x" })
      .expect(409);
    await as(arjun)
      .delete(`${entries(car.id)}/${entry.id}`)
      .expect(409);
    // Still readable.
    await as(arjun)
      .get(`${entries(car.id)}/${entry.id}`)
      .expect(200);
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
