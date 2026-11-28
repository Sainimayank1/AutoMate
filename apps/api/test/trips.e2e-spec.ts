/**
 * Trips API through the real HTTP pipeline and database (docker compose up -d).
 * Users are created under a throwaway domain and deleted afterwards (everything cascades).
 */
import { randomUUID } from "node:crypto";

import {
  addDays,
  type ApiErrorResponse,
  type ApiSuccessResponse,
  type DashboardOverview,
  istToday,
  type PageMeta,
  type Trip,
  type TripCategory,
  type TripCost,
  type TripCostsSummary,
  type TripFuelEntry,
  type TripOverview,
  type TripPlan,
  type TripSpending,
  type Vehicle,
} from "@automate/shared";
import { ServiceUnavailableException } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "@/app.module";
import { configureApp } from "@/app.setup";
import { PrismaService } from "@/database/prisma.service";
import { AuthService } from "@/modules/auth/auth.service";
import { seedSystemExpenseCategories } from "@/modules/expenses/expense-categories.seed";
import { ROUTE_UNAVAILABLE, RoutingService } from "@/modules/geocoding/routing.service";

const DOMAIN = "trips.e2e.automate.test";

/** The route provider, faked: 100 km per leg (alternatives for two points), or down. */
const routing = {
  calls: 0,
  down: false,
  route(points: { latitude: number; longitude: number }[]) {
    this.calls += 1;
    if (this.down) return Promise.reject(new ServiceUnavailableException(ROUTE_UNAVAILABLE));
    const km = (points.length - 1) * 100;
    const option = (extra: number) => ({
      distanceKm: (km + extra).toFixed(1),
      durationMinutes: (km + extra) / 2,
      geometry: "_p~iF~ps|U_ulLnnqC",
    });
    return Promise.resolve({
      provider: "OpenStreetMap (OSRM)",
      routes: points.length === 2 ? [option(0), option(12)] : [option(0)],
    });
  },
};

describe("Trips (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let arjun: string;
  let priya: string;
  let types: TripCategory[];
  const today = istToday(new Date());
  const typeId = (key: string) => types.find((type) => type.key === key)!.id;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RoutingService)
      .useValue(routing)
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      bodyParser: false,
      bufferLogs: true,
    });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await seedSystemExpenseCategories(prisma);
    const signUp = async (name: string) =>
      (
        await app.get(AuthService).register(
          {
            name,
            email: `trips-${randomUUID()}@${DOMAIN}`,
            password: "Drive2026safe",
            acceptedTerms: true,
          },
          {},
        )
      ).session.accessToken;
    arjun = await signUp("Arjun Mehta");
    priya = await signUp("Priya Nair");
    types = dataOf<TripCategory[]>(
      await as(arjun).get("/api/v1/trip-categories?pageSize=100").expect(200),
    );
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
    const plate = `KA${Math.floor(10 + Math.random() * 89)}TR${Math.floor(1000 + Math.random() * 9000)}`;
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
  const odometerKmOf = async (token: string, id: string) =>
    dataOf<Vehicle>(await as(token).get(`/api/v1/vehicles/${id}`).expect(200)).odometerKm;
  const trip = (vehicleId: string, overrides: object = {}) => ({
    vehicleId,
    method: "ODOMETER",
    categoryId: typeId("ROAD_TRIP"),
    date: addDays(today, -5),
    startKm: 8100,
    endKm: 8368,
    origin: "Gurugram",
    destination: "Jaipur",
    ...overrides,
  });

  it("logs odometer and entered-distance trips, raising the odometer once per client id", async () => {
    const car = await vehicle(arjun, 8000);
    const id = randomUUID();
    const created = dataOf<Trip>(
      await as(arjun)
        .post("/api/v1/trips", trip(car.id, { id, startTime: "06:10", endTime: "10:22" }))
        .expect(201),
    );
    expect(created).toMatchObject({
      id,
      method: "ODOMETER",
      distanceKm: "268.0",
      durationMinutes: 252,
      category: { key: "ROAD_TRIP", name: "Road trip" },
    });
    expect(await odometerKmOf(arjun, car.id)).toBe(8368);
    // A retried save returns the same trip.
    await as(arjun).post("/api/v1/trips", trip(car.id, { id })).expect(201);
    expect(metaOf(await as(arjun).get(`/api/v1/trips?vehicleId=${car.id}`))?.total).toBe(1);

    // A quick log: the distance as entered, no readings, the odometer untouched.
    const quick = dataOf<Trip>(
      await as(arjun)
        .post("/api/v1/trips", {
          vehicleId: car.id,
          method: "DISTANCE",
          categoryId: typeId("ERRANDS"),
          date: today,
          distanceKm: "12.5",
          startKm: 1,
          endKm: 2,
        })
        .expect(201),
    );
    expect(quick).toMatchObject({ distanceKm: "12.5", startKm: null, endKm: null });
    expect(await odometerKmOf(arjun, car.id)).toBe(8368);

    // Overnight: the duration runs across midnight.
    expect(
      dataOf<Trip>(
        await as(arjun)
          .post("/api/v1/trips", {
            vehicleId: car.id,
            method: "DISTANCE",
            categoryId: typeId("PERSONAL"),
            date: addDays(today, -2),
            endDate: addDays(today, -1),
            startTime: "22:30",
            endTime: "01:00",
            distanceKm: "180",
          })
          .expect(201),
      ).durationMinutes,
    ).toBe(150);

    const bad = (body: object) => as(arjun).post("/api/v1/trips", body).expect(400);
    await bad(trip(car.id, { endKm: 8100 }));
    await bad({ ...trip(car.id), method: "DISTANCE", distanceKm: null });
    await bad(trip(car.id, { date: addDays(today, 3) }));
    await bad(trip(car.id, { endDate: addDays(today, -6) }));
    await bad(trip(car.id, { startTime: "10:00", endTime: "09:00" }));
  });

  it("checks readings against the one odometer history and refuses overlapping trips", async () => {
    const car = await vehicle(arjun, 8000);
    // An expense reading 10 days ago at 8,500 km and a service 2 days ago at 9,000 km.
    const misc = await prisma.expenseCategory.findFirstOrThrow({ where: { key: "OTHER" } });
    await as(arjun)
      .post("/api/v1/expenses", {
        allocation: { mode: "single", vehicleId: car.id },
        categoryId: misc.id,
        title: "Car wash",
        amount: "300",
        date: addDays(today, -10),
        odometerKm: 8500,
      })
      .expect(201);
    await as(arjun)
      .post(`/api/v1/vehicles/${car.id}/service-records`, {
        type: "ROUTINE_SERVICE",
        title: "Service",
        categoryKey: "GENERAL.PERIODIC_SERVICE",
        serviceDate: addDays(today, -2),
        odometerKm: 9000,
      })
      .expect(201);

    const conflict = async (body: object, field: string) => {
      const res = await as(arjun).post("/api/v1/trips", body).expect(409);
      expect(errorOf(res).details).toMatchObject([{ field }]);
    };
    await conflict(trip(car.id, { startKm: 8400, endKm: 8600 }), "startKm");
    await conflict(trip(car.id, { startKm: 8600, endKm: 9100 }), "endKm");
    // In between: a historical trip is fine, whatever the vehicle shows now.
    const between = dataOf<Trip>(
      await as(arjun)
        .post("/api/v1/trips", trip(car.id, { startKm: 8600, endKm: 8800 }))
        .expect(201),
    );
    await conflict(
      trip(car.id, { date: addDays(today, -4), startKm: 8700, endKm: 8900 }),
      "startKm",
    );
    // Maintenance sees trips too: a service below a trip's end from an earlier day is refused.
    await as(arjun)
      .post(`/api/v1/vehicles/${car.id}/service-records`, {
        type: "ROUTINE_SERVICE",
        title: "Wash",
        categoryKey: "GENERAL.PERIODIC_SERVICE",
        serviceDate: addDays(today, -4),
        odometerKm: 8700,
      })
      .expect(409);
    await as(arjun).delete(`/api/v1/trips/${between.id}`).expect(204);
  });

  it("corrects the odometer down when a trip's reading is lowered or the trip is deleted", async () => {
    const car = await vehicle(arjun, 8000);
    const logged = dataOf<Trip>(
      await as(arjun)
        .post("/api/v1/trips", trip(car.id, { date: today, startKm: 8000, endKm: 84120 }))
        .expect(201),
    );
    expect(await odometerKmOf(arjun, car.id)).toBe(84120);
    const fixed = dataOf<Trip>(
      await as(arjun).patch(`/api/v1/trips/${logged.id}`, { endKm: 8412 }).expect(200),
    );
    expect(fixed).toMatchObject({ distanceKm: "412.0", origin: "Gurugram" });
    expect(await odometerKmOf(arjun, car.id)).toBe(8412);
    await as(arjun).patch(`/api/v1/trips/${logged.id}`, { endKm: 7999 }).expect(400);
    await as(arjun).delete(`/api/v1/trips/${logged.id}`).expect(204);
    await as(arjun).get(`/api/v1/trips/${logged.id}`).expect(404);
  });

  it("aggregates the overview for a vehicle or all vehicles", async () => {
    const [car, scooter] = [await vehicle(priya, 1000), await vehicle(priya, 500)];
    const post = (body: object) => as(priya).post("/api/v1/trips", body).expect(201);
    await post(
      trip(car.id, {
        date: today,
        startKm: 1000,
        endKm: 1040,
        categoryId: typeId("COMMUTE"),
        startTime: "09:00",
        endTime: "09:40",
      }),
    );
    await post(
      trip(car.id, { date: today, startKm: 1040, endKm: 1300, categoryId: typeId("ROAD_TRIP") }),
    );
    await post({
      vehicleId: scooter.id,
      method: "DISTANCE",
      categoryId: typeId("COMMUTE"),
      date: today,
      distanceKm: "20",
    });

    const one = dataOf<TripOverview>(
      await as(priya)
        .get(`/api/v1/trips/overview?vehicleId=${car.id}&period=this_week`)
        .expect(200),
    );
    expect(one).toMatchObject({
      vehicleId: car.id,
      trips: 2,
      distanceKm: "300.0",
      averageKm: "150.0",
      longest: { distanceKm: "260.0", label: "Gurugram → Jaipur" },
      drivingMinutes: 40,
      timedTrips: 1,
      series: { granularity: "day" },
    });
    expect(one.byCategory.map((row) => [row.key, row.distanceKm])).toEqual([
      ["ROAD_TRIP", "260.0"],
      ["COMMUTE", "40.0"],
    ]);
    expect(one.series.points.at(-1)).toEqual({ start: today, distanceKm: "300.0", trips: 2 });
    expect(one.recent).toHaveLength(2);

    const all = dataOf<TripOverview>(
      await as(priya).get("/api/v1/trips/overview?period=all_time").expect(200),
    );
    expect(all).toMatchObject({ vehicleId: null, trips: 3, distanceKm: "320.0" });
    expect(all.series.points).toHaveLength(1);

    const empty = dataOf<TripOverview>(
      await as(priya).get("/api/v1/trips/overview?period=last_month").expect(200),
    );
    expect(empty).toMatchObject({
      trips: 0,
      distanceKm: "0.0",
      averageKm: null,
      longest: null,
      drivingMinutes: null,
    });
  });

  it("feeds the dashboard's Driving card and activity, apart from odometer distance", async () => {
    const car = await vehicle(arjun, 5000);
    const overview = async () =>
      dataOf<DashboardOverview>(
        await as(arjun)
          .get(`/api/v1/dashboard/overview?vehicleId=${car.id}&period=this_month`)
          .expect(200),
      ).driving;
    expect(await overview()).toEqual({ state: "empty" });
    await as(arjun)
      .post("/api/v1/trips", trip(car.id, { date: today, startKm: 5000, endKm: 5120 }))
      .expect(201);
    expect(await overview()).toMatchObject({
      state: "ok",
      data: {
        distanceKm: null,
        trips: { count: 1, distanceKm: "120.0", longestKm: "120.0" },
      },
    });
    const activity = dataOf<{ kind: string; title: string; href: string }[]>(
      await as(arjun).get(`/api/v1/dashboard/activity?vehicleId=${car.id}`).expect(200),
    );
    expect(activity[0]).toMatchObject({ kind: "trip", title: "Gurugram → Jaipur" });
  });

  it("filters, searches and sorts the history on the server, with its summary", async () => {
    const car = await vehicle(arjun, 20000);
    const post = (body: object) => as(arjun).post("/api/v1/trips", body).expect(201);
    await post(
      trip(car.id, {
        date: addDays(today, -20),
        startKm: 20000,
        endKm: 20040,
        categoryId: typeId("COMMUTE"),
        origin: "DLF Phase 4",
        destination: "Cyber Hub",
      }),
    );
    await post(
      trip(car.id, {
        date: addDays(today, -10),
        startKm: 20040,
        endKm: 20308,
        notes: "Breakfast at Behror",
      }),
    );
    await post({
      vehicleId: car.id,
      method: "DISTANCE",
      categoryId: typeId("ERRANDS"),
      date: addDays(today, -1),
      distanceKm: "8",
      destination: "Sector 29 market",
    });
    const list = async (query: string) =>
      dataOf<Trip[]>(
        await as(arjun).get(`/api/v1/trips?vehicleId=${car.id}&${query}`).expect(200),
      ).map((row) => row.distanceKm);

    expect(await list("")).toEqual(["8.0", "268.0", "40.0"]);
    expect(await list("sort=oldest")).toEqual(["40.0", "268.0", "8.0"]);
    expect(await list("sort=longest")).toEqual(["268.0", "40.0", "8.0"]);
    expect(await list("sort=shortest")).toEqual(["8.0", "40.0", "268.0"]);
    expect(await list("search=behror")).toEqual(["268.0"]);
    expect(await list("search=cyber")).toEqual(["40.0"]);
    expect(await list(`categoryId=${typeId("COMMUTE")}`)).toEqual(["40.0"]);
    expect(await list("method=DISTANCE")).toEqual(["8.0"]);
    expect(await list("minKm=10&maxKm=100")).toEqual(["40.0"]);
    expect(await list(`from=${addDays(today, -15)}&to=${addDays(today, -5)}`)).toEqual(["268.0"]);
    expect(await list("destination=jaipur")).toEqual(["268.0"]);
    expect(
      dataOf(
        await as(arjun).get(`/api/v1/trips/summary?vehicleId=${car.id}&maxKm=100`).expect(200),
      ),
    ).toEqual({ trips: 2, distanceKm: "48.0" });
    await as(arjun).get(`/api/v1/trips?vehicleId=${car.id}&minKm=100&maxKm=10`).expect(400);
    await as(arjun).get("/api/v1/trips?sort=cheapest").expect(400);
  });

  it("moves trips to another type or deletes them in bulk, all or none", async () => {
    const car = await vehicle(arjun, 30000);
    const ids = [];
    for (const [startKm, endKm] of [
      [30000, 30100],
      [30100, 30250],
    ] as const) {
      ids.push(
        dataOf<Trip>(
          await as(arjun)
            .post("/api/v1/trips", trip(car.id, { date: today, startKm, endKm }))
            .expect(201),
        ).id,
      );
    }
    expect(await odometerKmOf(arjun, car.id)).toBe(30250);
    expect(
      dataOf(
        await as(arjun)
          .post("/api/v1/trips/bulk", { action: "category", ids, categoryId: typeId("BUSINESS") })
          .expect(200),
      ),
    ).toEqual({ count: 2 });
    expect(
      dataOf<Trip>(await as(arjun).get(`/api/v1/trips/${ids[1]}`).expect(200)).category.key,
    ).toBe("BUSINESS");
    await as(arjun).post("/api/v1/trips/bulk", { action: "category", ids }).expect(400);
    // Someone else's trip in the batch: nothing changes.
    await as(priya).post("/api/v1/trips/bulk", { action: "delete", ids }).expect(404);
    await as(arjun)
      .post("/api/v1/trips/bulk", { action: "delete", ids: [...ids, randomUUID()] })
      .expect(404);
    expect(
      dataOf(await as(arjun).post("/api/v1/trips/bulk", { action: "delete", ids }).expect(200)),
    ).toEqual({ count: 2 });
    await as(arjun).get(`/api/v1/trips/${ids[0]}`).expect(404);
    // Back down to the highest reading left (none from trips: the vehicle's own stays).
    expect(await odometerKmOf(arjun, car.id)).toBe(30250);
  });

  describe("costs", () => {
    const costs = (tripId: string) => `/api/v1/trips/${tripId}/costs`;
    const expenseOf = async (costId: string) =>
      prisma.expense.findFirst({
        where: { source: "TRIP", sourceId: costId },
        include: { category: true, subcategory: true },
      });

    it("keeps toll, parking and other in Expenses (read-only there) and food with the trip", async () => {
      const car = await vehicle(arjun, 40000);
      const jaipur = dataOf<Trip>(
        await as(arjun)
          .post("/api/v1/trips", trip(car.id, { date: today, startKm: 40000, endKm: 40268 }))
          .expect(201),
      );
      const id = randomUUID();
      const toll = dataOf<TripCost>(
        await as(arjun)
          .post(costs(jaipur.id), {
            id,
            category: "TOLL",
            amount: "240",
            date: today,
            vendor: "Kherki Daula plaza",
            paymentMethod: "UPI",
          })
          .expect(201),
      );
      // A retried save returns the same cost (and one expense).
      await as(arjun)
        .post(costs(jaipur.id), { id, category: "TOLL", amount: "240", date: today })
        .expect(201);
      expect(toll).toMatchObject({ id, amount: "240.00", trip: { label: "Gurugram → Jaipur" } });
      const expense = await expenseOf(id);
      expect(expense).toMatchObject({
        title: "Toll · Gurugram → Jaipur",
        vendor: "Kherki Daula plaza",
        category: { key: "DAILY_USAGE" },
        subcategory: { key: "DAILY_USAGE.TOLL" },
      });
      expect(toll.expenseId).toBe(expense!.id);
      await as(arjun).patch(`/api/v1/expenses/${expense!.id}`, { title: "x" }).expect(409);

      const food = dataOf<TripCost>(
        await as(arjun)
          .post(costs(jaipur.id), { category: "FOOD", amount: "285.50", date: today })
          .expect(201),
      );
      expect(food.expenseId).toBeNull();
      expect(await expenseOf(food.id)).toBeNull();
      // Food → parking makes it an expense; toll → accommodation takes its expense away.
      await as(arjun)
        .patch(`${costs(jaipur.id)}/${food.id}`, { category: "PARKING" })
        .expect(200);
      expect((await expenseOf(food.id))?.subcategory?.key).toBe("DAILY_USAGE.PARKING");
      await as(arjun)
        .patch(`${costs(jaipur.id)}/${id}`, { category: "ACCOMMODATION" })
        .expect(200);
      expect(await expenseOf(id)).toBeNull();

      await as(arjun)
        .post(costs(jaipur.id), { category: "TOLL", amount: "0", date: today })
        .expect(400);
      await as(priya).get(costs(jaipur.id)).expect(404);
      await as(priya)
        .post(costs(jaipur.id), { category: "TOLL", amount: "1", date: today })
        .expect(404);

      // Deleting the cost deletes its expense; deleting the trip deletes the rest.
      await as(arjun)
        .delete(`${costs(jaipur.id)}/${food.id}`)
        .expect(204);
      expect(await expenseOf(food.id)).toBeNull();
      const other = dataOf<TripCost>(
        await as(arjun)
          .post(costs(jaipur.id), { category: "OTHER", amount: "50", date: today })
          .expect(201),
      );
      await as(arjun).delete(`/api/v1/trips/${jaipur.id}`).expect(204);
      expect(await expenseOf(other.id)).toBeNull();
    });

    it("counts linked fill-ups as the trip's actual fuel, apart from estimates", async () => {
      const car = await vehicle(arjun, 50000);
      const other = await vehicle(arjun, 1000);
      const jaipur = dataOf<Trip>(
        await as(arjun)
          .post(
            "/api/v1/trips",
            trip(car.id, { date: addDays(today, -1), startKm: 50000, endKm: 50200 }),
          )
          .expect(201),
      );
      const fill = async (vehicleId: string, odometerKm: number) =>
        dataOf<{ id: string }>(
          await as(arjun)
            .post(`/api/v1/vehicles/${vehicleId}/fuel-entries`, {
              filledAt: new Date().toISOString(),
              odometerKm,
              fuelType: "PETROL",
              quantity: "7.6",
              pricePerUnit: "105.26",
              totalAmount: "800",
              isFullTank: false,
              stationName: "IndianOil, Behror",
            })
            .expect(201),
        ).id;
      const fuelId = await fill(car.id, 50250);
      const candidates = dataOf<TripFuelEntry[]>(
        await as(arjun).get(`/api/v1/trips/${jaipur.id}/fuel-candidates`).expect(200),
      );
      expect(candidates.map((row) => row.id)).toEqual([fuelId]);
      await as(arjun)
        .post(`/api/v1/trips/${jaipur.id}/fuel-entries`, { fuelEntryId: fuelId })
        .expect(204);
      await as(arjun)
        .post(`/api/v1/trips/${jaipur.id}/fuel-entries`, {
          fuelEntryId: await fill(other.id, 1100),
        })
        .expect(404);
      await as(arjun)
        .post(costs(jaipur.id), { category: "TOLL", amount: "240", date: today })
        .expect(201);

      const spending = dataOf<TripSpending>(
        await as(arjun).get(`/api/v1/trips/${jaipur.id}/spending`).expect(200),
      );
      expect(spending).toMatchObject({
        actual: "1040.00",
        perKm: "5.20",
        fuelEntries: 1,
        byCategory: [
          { category: "FUEL", amount: "800.00" },
          { category: "TOLL", amount: "240.00" },
        ],
        estimate: null, // no full-tank sequence yet: no mileage to estimate with
      });
      expect(
        dataOf<Trip>(await as(arjun).get(`/api/v1/trips/${jaipur.id}`).expect(200)).actualCost,
      ).toBe("1040.00");

      // Another trip can't take the same fill-up; unlinking leaves it in Fuel.
      const second = dataOf<Trip>(
        await as(arjun)
          .post("/api/v1/trips", {
            vehicleId: car.id,
            method: "DISTANCE",
            categoryId: typeId("ERRANDS"),
            date: today,
            distanceKm: "5",
          })
          .expect(201),
      );
      await as(arjun)
        .post(`/api/v1/trips/${second.id}/fuel-entries`, { fuelEntryId: fuelId })
        .expect(409);
      await as(arjun).delete(`/api/v1/trips/${jaipur.id}/fuel-entries/${fuelId}`).expect(204);
      await as(arjun).delete(`/api/v1/trips/${jaipur.id}/fuel-entries/${fuelId}`).expect(404);
      expect(
        (await prisma.fuelEntry.findUniqueOrThrow({ where: { id: fuelId } })).tripId,
      ).toBeNull();

      // The Costs tab and the overview read the same money.
      await as(arjun)
        .post(`/api/v1/trips/${jaipur.id}/fuel-entries`, { fuelEntryId: fuelId })
        .expect(204);
      const summary = dataOf<TripCostsSummary>(
        await as(arjun)
          .get(`/api/v1/trip-costs/summary?vehicleId=${car.id}&period=this_month`)
          .expect(200),
      );
      expect(summary).toMatchObject({ total: "1040.00", perKm: "5.20" });
      const listed = dataOf<TripCost[]>(
        await as(arjun).get(`/api/v1/trip-costs?vehicleId=${car.id}&period=this_month`).expect(200),
      );
      expect(listed.map((row) => row.category)).toEqual(["TOLL"]);
      const overview = dataOf<TripOverview>(
        await as(arjun)
          .get(`/api/v1/trips/overview?vehicleId=${car.id}&period=this_month`)
          .expect(200),
      );
      expect(overview.cost).toEqual({ total: "1040.00", perKm: "5.20" });
    });
  });

  it("measures a route trip on the provider's route, never on a guess", async () => {
    const car = await vehicle(arjun, 60000);
    const places = {
      origin: "Hisar",
      originLat: 29.1492,
      originLng: 75.7217,
      destination: "Manali",
      destinationLat: 32.2432,
      destinationLng: 77.1892,
    };
    const stops = [
      { label: "Chandigarh", latitude: 30.7333, longitude: 76.7794, arrivalTime: "10:30" },
      { label: "Shimla", latitude: 31.1048, longitude: 77.1734 },
    ];
    const body = {
      vehicleId: car.id,
      method: "ROUTE",
      categoryId: typeId("ROAD_TRIP"),
      date: today,
      ...places,
      stops,
    };
    const created = dataOf<Trip>(await as(arjun).post("/api/v1/trips", body).expect(201));
    expect(created).toMatchObject({
      method: "ROUTE",
      distanceKm: "300.0",
      startKm: null,
      originPoint: { latitude: 29.1492, longitude: 75.7217 },
      stops: [{ label: "Chandigarh", arrivalTime: "10:30" }, { label: "Shimla" }],
      route: { provider: "OpenStreetMap (OSRM)", distanceKm: "300.0", durationMinutes: 150 },
    });
    expect(await odometerKmOf(arjun, car.id)).toBe(60000);

    // A notes change keeps the stored route; a new stop list fetches a fresh one.
    const calls = routing.calls;
    await as(arjun).patch(`/api/v1/trips/${created.id}`, { notes: "Snow at Rohtang" }).expect(200);
    expect(routing.calls).toBe(calls);
    const shorter = dataOf<Trip>(
      await as(arjun)
        .patch(`/api/v1/trips/${created.id}`, { stops: [], routeIndex: 1 })
        .expect(200),
    );
    expect(shorter).toMatchObject({ distanceKm: "112.0", stops: [] });

    // No route without pinned places; the provider down means nothing is saved.
    await as(arjun)
      .post("/api/v1/trips", { ...body, originLat: null, originLng: null })
      .expect(400);
    await as(arjun)
      .post("/api/v1/trips", { ...body, originLng: null })
      .expect(400);
    routing.down = true;
    const id = randomUUID();
    await as(arjun)
      .post("/api/v1/trips", { ...body, id })
      .expect(503);
    await as(arjun).get(`/api/v1/trips/${id}`).expect(404);
    routing.down = false;

    expect(
      dataOf(
        await as(arjun)
          .post("/api/v1/trips/routes/calculate", {
            points: [
              { latitude: 29.1492, longitude: 75.7217 },
              { latitude: 32.2432, longitude: 77.1892 },
            ],
          })
          .expect(200),
      ),
    ).toMatchObject({
      provider: "OpenStreetMap (OSRM)",
      routes: [{ distanceKm: "100.0" }, { distanceKm: "112.0" }],
    });
    await as(arjun)
      .post("/api/v1/trips/routes/calculate", { points: [{ latitude: 91, longitude: 0 }] })
      .expect(400);
  });

  it("keeps the system trip types and the user's own, unique by name", async () => {
    expect(types.filter((type) => type.key).map((type) => type.name)).toEqual([
      "Personal",
      "Commute",
      "Business",
      "Road trip",
      "Errands",
      "Airport / railway",
      "Other",
    ]);
    const mine = dataOf<TripCategory>(
      await as(arjun).post("/api/v1/trip-categories", { name: "Temple visits" }).expect(201),
    );
    expect(mine).toMatchObject({ key: null, name: "Temple visits", archivedAt: null });
    await as(arjun).post("/api/v1/trip-categories", { name: "temple VISITS" }).expect(409);
    await as(arjun).post("/api/v1/trip-categories", { name: "commute" }).expect(409);
    // Another user can use the same name; nobody else sees it.
    await as(priya).post("/api/v1/trip-categories", { name: "Temple visits" }).expect(201);
    await as(priya).patch(`/api/v1/trip-categories/${mine.id}`, { name: "X" }).expect(404);
    await as(arjun)
      .patch(`/api/v1/trip-categories/${typeId("COMMUTE")}`, { name: "X" })
      .expect(404);
    expect(
      dataOf<TripCategory>(
        await as(arjun)
          .patch(`/api/v1/trip-categories/${mine.id}`, { name: "Pilgrimage" })
          .expect(200),
      ).name,
    ).toBe("Pilgrimage");

    const car = await vehicle(arjun);
    await as(arjun).post(`/api/v1/trip-categories/${mine.id}/archive`).expect(200);
    await as(arjun)
      .post("/api/v1/trips", trip(car.id, { categoryId: mine.id }))
      .expect(400);
    await as(arjun).post(`/api/v1/trip-categories/${mine.id}/restore`).expect(200);
    await as(arjun)
      .post("/api/v1/trips", trip(car.id, { categoryId: mine.id }))
      .expect(201);
  });

  it("keeps each user's trips private and archived vehicles read-only", async () => {
    const car = await vehicle(arjun);
    const mine = dataOf<Trip>(await as(arjun).post("/api/v1/trips", trip(car.id)).expect(201));
    await as(priya).get(`/api/v1/trips/${mine.id}`).expect(404);
    await as(priya).patch(`/api/v1/trips/${mine.id}`, { notes: "x" }).expect(404);
    await as(priya).delete(`/api/v1/trips/${mine.id}`).expect(404);
    await as(priya).get(`/api/v1/trips?vehicleId=${car.id}`).expect(404);
    await as(priya).get(`/api/v1/trips/overview?vehicleId=${car.id}`).expect(404);
    await as(priya).post("/api/v1/trips", trip(car.id)).expect(404);
    expect(
      dataOf<Trip[]>(await as(priya).get("/api/v1/trips").expect(200)).map((row) => row.id),
    ).not.toContain(mine.id);

    await as(arjun).post(`/api/v1/vehicles/${car.id}/archive`).expect(200);
    await as(arjun).patch(`/api/v1/trips/${mine.id}`, { notes: "x" }).expect(409);
    await as(arjun).get(`/api/v1/trips/${mine.id}`).expect(200);
  });
  describe("plans", () => {
    const manali = (vehicleId: string, overrides: object = {}) => ({
      vehicleId,
      categoryId: typeId("ROAD_TRIP"),
      title: "Manali road trip",
      date: addDays(today, 16),
      endDate: addDays(today, 19),
      origin: "Hisar",
      destination: "Manali",
      plannedDistanceKm: "540",
      estMileage: "18",
      estFuelPrice: "104",
      estToll: "1450",
      estAccommodation: "4800",
      estOther: "480",
      ...overrides,
    });

    it("budgets a plan without counting it anywhere, and cancels or restores it", async () => {
      const car = await vehicle(arjun, 9000);
      const plan = dataOf<TripPlan>(
        await as(arjun).post("/api/v1/trip-plans", manali(car.id)).expect(201),
      );
      expect(plan).toMatchObject({
        status: "PLANNED",
        method: "DISTANCE",
        plannedDistanceKm: "540.0",
        budget: { fuelQuantity: "30.0", fuelCost: "3120.00", total: "9850.00", perKm: "18.24" },
      });
      const sooner = dataOf<TripPlan>(
        await as(arjun)
          .post("/api/v1/trip-plans", {
            ...manali(car.id),
            status: "DRAFT",
            title: "Jaipur visit",
            date: addDays(today, 2),
            endDate: undefined,
            estFuelPrice: undefined,
          })
          .expect(201),
      );
      // Unknown fuel price: no fuel cost, the rest still adds up.
      expect(sooner.budget).toMatchObject({ fuelCost: null, total: "6730.00" });

      const upcoming = await as(arjun).get(`/api/v1/trip-plans?vehicleId=${car.id}`).expect(200);
      expect(dataOf<TripPlan[]>(upcoming).map((row) => row.id)).toEqual([sooner.id, plan.id]);
      expect(metaOf(upcoming)?.total).toBe(2);

      // Plans are not trips: not in history, the overview, the trip route or the odometer.
      expect(
        dataOf<Trip[]>(await as(arjun).get(`/api/v1/trips?vehicleId=${car.id}`).expect(200)),
      ).toEqual([]);
      await as(arjun).get(`/api/v1/trips/${plan.id}`).expect(404);
      expect(await odometerKmOf(arjun, car.id)).toBe(9000);

      const edited = dataOf<TripPlan>(
        await as(arjun)
          .patch(`/api/v1/trip-plans/${plan.id}`, { estAccommodation: null, estParking: "200" })
          .expect(200),
      );
      expect(edited.budget.total).toBe("5250.00");
      await as(arjun)
        .patch(`/api/v1/trip-plans/${plan.id}`, { endDate: addDays(today, 1) })
        .expect(400);

      await as(arjun).post(`/api/v1/trip-plans/${plan.id}/cancel`).expect(200);
      const cancelled = await as(arjun)
        .get(`/api/v1/trip-plans?vehicleId=${car.id}&view=cancelled`)
        .expect(200);
      expect(dataOf<TripPlan[]>(cancelled).map((row) => row.status)).toEqual(["CANCELLED"]);
      const restored = dataOf<TripPlan>(
        await as(arjun).post(`/api/v1/trip-plans/${plan.id}/restore`).expect(200),
      );
      expect(restored.status).toBe("PLANNED");

      await as(arjun).delete(`/api/v1/trip-plans/${sooner.id}`).expect(204);
      await as(arjun).get(`/api/v1/trip-plans/${sooner.id}`).expect(404);
    });

    it("completes a route plan into a trip, keeping the plan for planned vs actual", async () => {
      const car = await vehicle(arjun, 20000);
      const plan = dataOf<TripPlan>(
        await as(arjun)
          .post(
            "/api/v1/trip-plans",
            manali(car.id, {
              method: "ROUTE",
              plannedDistanceKm: undefined,
              originLat: 29.1492,
              originLng: 75.7217,
              destinationLat: 32.2432,
              destinationLng: 77.1892,
              stops: [{ label: "Chandigarh", latitude: 30.7333, longitude: 76.7794 }],
            }),
          )
          .expect(201),
      );
      expect(plan).toMatchObject({
        plannedDistanceKm: "200.0",
        plannedDurationMinutes: 100,
        route: { distanceKm: "200.0" },
        stops: [{ label: "Chandigarh" }],
      });

      // Readings that go backwards are refused like any trip's.
      await as(arjun)
        .post(
          "/api/v1/trips",
          trip(car.id, { date: addDays(today, -1), startKm: 19900, endKm: 20005 }),
        )
        .expect(201);
      await as(arjun)
        .post(`/api/v1/trip-plans/${plan.id}/complete`, {
          method: "ODOMETER",
          date: today,
          startKm: 20000,
          endKm: 20100,
        })
        .expect(409);
      const done = dataOf<Trip>(
        await as(arjun)
          .post(`/api/v1/trip-plans/${plan.id}/complete`, {
            method: "ODOMETER",
            date: today,
            startKm: 20010,
            endKm: 20236,
          })
          .expect(200),
      );
      expect(done).toMatchObject({
        id: plan.id,
        method: "ODOMETER",
        distanceKm: "226.0",
        title: "Manali road trip",
        stops: [{ label: "Chandigarh" }],
        plan: { distanceKm: "200.0", durationMinutes: 100, budget: "7885.56" },
      });
      expect(await odometerKmOf(arjun, car.id)).toBe(20236);
      await as(arjun).get(`/api/v1/trip-plans/${plan.id}`).expect(404);
      expect(
        dataOf<Trip[]>(await as(arjun).get(`/api/v1/trips?vehicleId=${car.id}`).expect(200)).map(
          (row) => row.id,
        ),
      ).toContain(plan.id);

      // A route plan done as planned reuses its stored route.
      const again = dataOf<TripPlan>(
        await as(arjun)
          .post(
            "/api/v1/trip-plans",
            manali(car.id, {
              method: "ROUTE",
              plannedDistanceKm: undefined,
              date: addDays(today, 30),
              endDate: undefined,
              originLat: 29.1492,
              originLng: 75.7217,
              destinationLat: 32.2432,
              destinationLng: 77.1892,
            }),
          )
          .expect(201),
      );
      const calls = routing.calls;
      const asPlanned = dataOf<Trip>(
        await as(arjun)
          .post(`/api/v1/trip-plans/${again.id}/complete`, { method: "ROUTE", date: today })
          .expect(200),
      );
      expect(routing.calls).toBe(calls);
      expect(asPlanned).toMatchObject({ method: "ROUTE", distanceKm: "100.0" });
    });

    it("keeps each user's plans private", async () => {
      const car = await vehicle(arjun);
      const plan = dataOf<TripPlan>(
        await as(arjun).post("/api/v1/trip-plans", manali(car.id)).expect(201),
      );
      await as(priya).get(`/api/v1/trip-plans/${plan.id}`).expect(404);
      await as(priya).patch(`/api/v1/trip-plans/${plan.id}`, { notes: "x" }).expect(404);
      await as(priya).post(`/api/v1/trip-plans/${plan.id}/cancel`).expect(404);
      await as(priya)
        .post(`/api/v1/trip-plans/${plan.id}/complete`, {
          method: "DISTANCE",
          date: today,
          distanceKm: "10",
        })
        .expect(404);
      await as(priya).delete(`/api/v1/trip-plans/${plan.id}`).expect(404);
      await as(priya).get(`/api/v1/trip-plans?vehicleId=${car.id}`).expect(404);
      await as(priya).post("/api/v1/trip-plans", manali(car.id)).expect(404);
    });
  });
});
