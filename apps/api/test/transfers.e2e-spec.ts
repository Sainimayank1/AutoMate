/**
 * Direct vehicle transfer between accounts through the real pipeline, database and local
 * storage: offer, the recipient's inbox, accept (records and files move, the sender's copy goes),
 * decline and cancel, and the checks around them.
 */
import { randomUUID } from "node:crypto";
import { access, rm } from "node:fs/promises";
import { resolve } from "node:path";

import {
  addDays,
  type ApiSuccessResponse,
  type Expense,
  istToday,
  type NotificationSummary,
  type UploadSlot,
  type Vehicle,
  type VehicleTransfer,
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

const DOMAIN = "transfers.e2e.automate.test";
const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
]);
const exists = (key: string) =>
  access(resolve(".storage", key)).then(
    () => true,
    () => false,
  );

describe("Vehicle transfers (e2e)", () => {
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

  const signUp = async (name: string) => {
    const email = `transfer-${randomUUID()}@${DOMAIN}`;
    const { session } = await app
      .get(AuthService)
      .register({ name, email, password: "Drive2026safe", acceptedTerms: true }, {});
    return { token: session.accessToken, email };
  };
  const as = (token: string) => ({
    get: (url: string) => request(app.getHttpServer()).get(url).auth(token, { type: "bearer" }),
    post: (url: string, body?: object) =>
      request(app.getHttpServer()).post(url).auth(token, { type: "bearer" }).send(body),
  });
  const dataOf = <T>(res: request.Response) => (res.body as ApiSuccessResponse<T>).data;
  const plate = () =>
    `HR${Math.floor(10 + Math.random() * 89)}EV${Math.floor(1000 + Math.random() * 9000)}`;
  const vehicle = async (token: string, registrationNumber = plate()) =>
    dataOf<Vehicle>(
      await as(token)
        .post("/api/v1/vehicles", {
          make: "Maruti Suzuki",
          model: "Victoris",
          variant: "LXI",
          manufacturingYear: 2025,
          category: "SUV",
          registrationNumber,
          fuelType: "PETROL",
          transmission: "MANUAL",
          ownershipType: "OWNED",
          odometerKm: 8000,
        })
        .expect(201),
    );
  const offer = (token: string, vehicleId: string, email: string) =>
    as(token).post("/api/v1/vehicle-transfers", { vehicleId, email });

  it("moves a vehicle with its records and files once the recipient accepts", async () => {
    const arjun = await signUp("Arjun Mehta");
    const priya = await signUp("Priya Nair");
    const car = await vehicle(arjun.token);
    await as(arjun.token)
      .post(`/api/v1/vehicles/${car.id}/fuel-entries`, {
        filledAt: `${addDays(today, -3)}T09:00:00.000+05:30`,
        odometerKm: 8200,
        fuelType: "PETROL",
        quantity: "30",
        pricePerUnit: "104.32",
        totalAmount: "3129.60",
        isFullTank: true,
      })
      .expect(201);
    const wash = dataOf<Expense>(
      await as(arjun.token)
        .post("/api/v1/expenses", {
          allocation: { mode: "single", vehicleId: car.id },
          categoryId: keyed.get("DAILY_USAGE"),
          title: "Foam wash",
          amount: "450",
          date: addDays(today, -2),
        })
        .expect(201),
    );
    const slot = dataOf<UploadSlot>(
      await as(arjun.token)
        .post("/api/v1/attachments/uploads", {
          owner: "expense",
          ownerId: wash.id,
          fileName: "wash.png",
          contentType: "image/png",
          size: PNG.length,
        })
        .expect(201),
    );
    await request(app.getHttpServer())
      .put(new URL(slot.url).pathname)
      .set(slot.headers)
      .send(PNG)
      .expect(200);
    await as(arjun.token).post(`/api/v1/attachments/uploads/${slot.fileId}/confirm`).expect(200);

    // The same answer whether or not the email has an account; never your own.
    const sent = dataOf<VehicleTransfer>(
      await offer(arjun.token, car.id, priya.email.toUpperCase()).expect(201),
    );
    expect(sent).toMatchObject({
      direction: "outgoing",
      status: "PENDING",
      otherParty: { name: null, email: priya.email },
      vehicleId: null,
    });
    await offer(arjun.token, car.id, "nobody@example.test").expect(409);
    const other = await vehicle(arjun.token);
    const unknown = dataOf<VehicleTransfer>(
      await offer(arjun.token, other.id, `ghost-${randomUUID()}@${DOMAIN}`).expect(201),
    );
    expect(Object.keys(unknown).sort()).toEqual(Object.keys(sent).sort());
    await offer(arjun.token, other.id, arjun.email).expect(400);

    // The recipient sees it in the list and the inbox; nobody else can act on it.
    const incoming = dataOf<VehicleTransfer[]>(
      await as(priya.token).get("/api/v1/vehicle-transfers?direction=incoming").expect(200),
    );
    expect(incoming).toEqual([
      expect.objectContaining({
        id: sent.id,
        otherParty: { name: "Arjun Mehta", email: arjun.email },
        status: "PENDING",
      }),
    ]);
    const inbox = dataOf<NotificationSummary>(
      await as(priya.token).get("/api/v1/notifications/summary").expect(200),
    );
    expect(inbox.latest.map((item) => item.title)).toContain(
      "Arjun Mehta wants to move Maruti Suzuki Victoris LXI to your garage",
    );
    const rahul = await signUp("Rahul Verma");
    await as(rahul.token).post(`/api/v1/vehicle-transfers/${sent.id}/accept`).expect(404);

    const accepted = dataOf<VehicleTransfer>(
      await as(priya.token).post(`/api/v1/vehicle-transfers/${sent.id}/accept`).expect(200),
    );
    expect(accepted.status).toBe("ACCEPTED");
    expect(accepted.vehicleId).toBeTruthy();
    await as(priya.token).post(`/api/v1/vehicle-transfers/${sent.id}/accept`).expect(409);

    await as(arjun.token).get(`/api/v1/vehicles/${car.id}`).expect(404);
    const moved = accepted.vehicleId!;
    expect(await prisma.fuelEntry.count({ where: { vehicleId: moved, odometerKm: 8200 } })).toBe(1);
    const newWash = await prisma.expense.findFirstOrThrow({
      where: { vehicleId: moved, title: "Foam wash" },
      include: { attachments: true },
    });
    expect(newWash.attachments).toHaveLength(1);
    expect(newWash.attachments[0]!.confirmedAt).not.toBeNull();
    expect(await exists(newWash.attachments[0]!.key)).toBe(true);
    const outgoing = dataOf<VehicleTransfer[]>(
      await as(arjun.token).get("/api/v1/vehicle-transfers?direction=outgoing").expect(200),
    );
    expect(outgoing.find((item) => item.id === sent.id)).toMatchObject({
      status: "ACCEPTED",
      vehicleId: null,
    });
  });

  it("declines, cancels, and refuses a vehicle the recipient already has", async () => {
    const arjun = await signUp("Arjun Mehta");
    const priya = await signUp("Priya Nair");
    const first = await vehicle(arjun.token);
    const declined = dataOf<VehicleTransfer>(
      await offer(arjun.token, first.id, priya.email).expect(201),
    );
    expect(
      dataOf<VehicleTransfer>(
        await as(priya.token).post(`/api/v1/vehicle-transfers/${declined.id}/decline`).expect(200),
      ).status,
    ).toBe("DECLINED");
    await as(arjun.token).get(`/api/v1/vehicles/${first.id}`).expect(200);

    const cancelled = dataOf<VehicleTransfer>(
      await offer(arjun.token, first.id, priya.email).expect(201),
    );
    await as(priya.token).post(`/api/v1/vehicle-transfers/${cancelled.id}/cancel`).expect(404);
    expect(
      dataOf<VehicleTransfer>(
        await as(arjun.token).post(`/api/v1/vehicle-transfers/${cancelled.id}/cancel`).expect(200),
      ).status,
    ).toBe("CANCELLED");
    await as(priya.token).post(`/api/v1/vehicle-transfers/${cancelled.id}/accept`).expect(409);

    // Priya already has this registration: the move is refused and stays open.
    await vehicle(priya.token, first.registrationNumber);
    const clash = dataOf<VehicleTransfer>(
      await offer(arjun.token, first.id, priya.email).expect(201),
    );
    await as(priya.token).post(`/api/v1/vehicle-transfers/${clash.id}/accept`).expect(409);
    const [still] = dataOf<VehicleTransfer[]>(
      await as(priya.token).get("/api/v1/vehicle-transfers").expect(200),
    );
    expect(still).toMatchObject({ id: clash.id, status: "PENDING" });
    await as(arjun.token).get(`/api/v1/vehicles/${first.id}`).expect(200);
  });
});
