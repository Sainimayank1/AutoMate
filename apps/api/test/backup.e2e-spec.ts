/**
 * Backup & Export (M12) through the real HTTP pipeline and database: a backup of one account
 * restored into another (previewed first), duplicates left out, and bad files refused.
 */
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";

import {
  addDays,
  type ApiErrorResponse,
  type ApiSuccessResponse,
  type Backup,
  type BackupFileLink,
  type BackupRestoreReport,
  type Expense,
  type FuelEntry,
  istToday,
  type ServiceRecord,
  type Trip,
  type TripCategory,
  type UploadSlot,
  type Vehicle,
  type VehicleDocument,
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

const DOMAIN = "backup.e2e.automate.test";
const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
]);

describe("Backup (e2e)", () => {
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

  const signUp = async () =>
    (
      await app.get(AuthService).register(
        {
          name: "Arjun Mehta",
          email: `backup-${randomUUID()}@${DOMAIN}`,
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
  });
  const dataOf = <T>(res: request.Response) => (res.body as ApiSuccessResponse<T>).data;

  /** One account with a bit of everything on a financed Victoris. */
  async function arjunsGarage() {
    const token = await signUp();
    const plate = `HR${Math.floor(10 + Math.random() * 89)}EV${Math.floor(1000 + Math.random() * 9000)}`;
    const car = dataOf<Vehicle>(
      await as(token)
        .post("/api/v1/vehicles", {
          make: "Maruti Suzuki",
          model: "Victoris",
          variant: "LXI",
          manufacturingYear: 2025,
          category: "SUV",
          registrationNumber: plate,
          fuelType: "PETROL",
          transmission: "MANUAL",
          ownershipType: "FINANCED",
          purchasePrice: "1145000",
          odometerKm: 8000,
        })
        .expect(201),
    );
    const fill = (days: number, odometerKm: number) =>
      as(token)
        .post(`/api/v1/vehicles/${car.id}/fuel-entries`, {
          filledAt: `${addDays(today, days)}T09:00:00.000+05:30`,
          odometerKm,
          fuelType: "PETROL",
          quantity: "30",
          pricePerUnit: "104.32",
          totalAmount: "3129.60",
          isFullTank: true,
          stationName: "IndianOil, Sohna Road",
        })
        .expect(201);
    await fill(-20, 8100);
    const tripFill = dataOf<FuelEntry>(await fill(-8, 8500));
    await as(token)
      .post(`/api/v1/vehicles/${car.id}/service-records`, {
        type: "ROUTINE_SERVICE",
        title: "Periodic service",
        categoryKey: "GENERAL.PERIODIC_SERVICE",
        serviceDate: addDays(today, -15),
        odometerKm: 8300,
        providerName: "Shivam Autozone",
        labourAmount: "1200",
        partsAmount: "1450",
        items: [{ name: "Engine oil" }],
      })
      .expect(201);
    const toll = dataOf<Expense>(
      await as(token)
        .post("/api/v1/expenses", {
          allocation: { mode: "single", vehicleId: car.id },
          categoryId: keyed.get("DAILY_USAGE"),
          subcategoryId: keyed.get("DAILY_USAGE.TOLL"),
          title: "Kherki Daula FASTag",
          amount: "640",
          date: addDays(today, -6),
        })
        .expect(201),
    );
    await as(token)
      .post(`/api/v1/expenses/${toll.id}/refunds`, {
        amount: "140",
        date: addDays(today, -5),
        reason: "REFUND",
      })
      .expect(201);
    // A category of the user's own, which a fresh account doesn't have.
    const custom = dataOf<{ id: string }>(
      await as(token)
        .post("/api/v1/expense-categories", {
          name: "Detailing",
          icon: "sparkles",
          costClass: "OPERATING",
        })
        .expect(201),
    );
    await as(token)
      .post("/api/v1/expenses", {
        allocation: { mode: "single", vehicleId: car.id },
        categoryId: custom.id,
        title: "Ceramic coating",
        amount: "18000",
        date: addDays(today, -4),
      })
      .expect(201);
    const types = dataOf<TripCategory[]>(
      await as(token).get("/api/v1/trip-categories?pageSize=100").expect(200),
    );
    const trip = dataOf<Trip>(
      await as(token)
        .post("/api/v1/trips", {
          vehicleId: car.id,
          method: "ODOMETER",
          categoryId: types.find((type) => type.key === "ROAD_TRIP")!.id,
          date: addDays(today, -9),
          endDate: addDays(today, -7),
          startKm: 8400,
          endKm: 8700,
          origin: "Gurugram",
          destination: "Jaipur",
        })
        .expect(201),
    );
    await as(token)
      .post(`/api/v1/trips/${trip.id}/costs`, {
        category: "TOLL",
        amount: "320",
        date: addDays(today, -9),
      })
      .expect(201);
    await as(token)
      .post(`/api/v1/trips/${trip.id}/fuel-entries`, { fuelEntryId: tripFill.id })
      .expect(204);
    await as(token)
      .post("/api/v1/documents", {
        vehicleId: car.id,
        type: "PUC",
        name: "PUC certificate",
        number: "HR026-PUC-9921",
        expiryDate: addDays(today, 60),
      })
      .expect(201);
    await as(token)
      .post("/api/v1/documents", {
        type: "DRIVING_LICENCE",
        name: "Driving licence",
        expiryDate: addDays(today, 900),
      })
      .expect(201);
    return { token, car };
  }

  it("backs everything up and restores it into another account, once", async () => {
    const arjun = await arjunsGarage();
    const backup = dataOf<Backup>(await as(arjun.token).get("/api/v1/backup").expect(200));
    expect(backup).toMatchObject({ format: "automate-backup", version: 1 });
    const [entry] = backup.vehicles;
    expect(entry!.vehicle).toMatchObject({
      registrationNumber: arjun.car.registrationNumber,
      purchasePrice: "1145000.00",
      archived: false,
    });
    expect(entry!.fuel).toHaveLength(2);
    expect(entry!.services[0]).toMatchObject({
      providerName: "Shivam Autozone",
      items: [{ name: "Engine oil", partNumber: null }],
    });
    // Fuel, service and trip-cost expenses come back with their records, not as expenses.
    expect(entry!.expenses.map((expense) => [expense.title, expense.refunds.length])).toEqual([
      ["Kherki Daula FASTag", 1],
      ["Ceramic coating", 0],
    ]);
    expect(entry!.trips).toHaveLength(1);
    expect(entry!.documents.map((doc) => doc.name)).toEqual(["PUC certificate"]);
    expect(backup.documents.map((doc) => doc.name)).toEqual(["Driving licence"]);

    const priya = await signUp();
    const preview = dataOf<BackupRestoreReport>(
      await as(priya).post("/api/v1/backup/restore/preview", backup).expect(200),
    );
    expect(preview.vehicles).toEqual([
      expect.objectContaining({
        status: "NEW",
        counts: {
          fuel: 2,
          services: 1,
          expenses: 2,
          trips: 1,
          documents: 1,
          components: 0,
          inspections: 0,
          schedules: 0,
          loans: 0,
          recurring: 0,
          budgets: 0,
        },
        issueCount: 0,
      }),
    ]);
    expect(
      await prisma.vehicle.count({
        where: {
          user: { email: { endsWith: DOMAIN } },
          registrationNumber: arjun.car.registrationNumber,
        },
      }),
    ).toBe(1);

    const restored = dataOf<BackupRestoreReport>(
      await as(priya).post("/api/v1/backup/restore", backup).expect(200),
    );
    const [outcome] = restored.vehicles;
    expect(outcome).toMatchObject({
      status: "RESTORED",
      counts: {
        fuel: 2,
        services: 1,
        expenses: 2,
        trips: 1,
        documents: 1,
        components: 0,
        inspections: 0,
        schedules: 0,
        loans: 0,
        recurring: 0,
        budgets: 0,
      },
      issues: [],
    });
    expect(restored.documents).toEqual({ count: 1, issues: [] });
    const carId = outcome!.vehicleId!;

    const fills = dataOf<FuelEntry[]>(
      await as(priya).get(`/api/v1/vehicles/${carId}/fuel-entries`).expect(200),
    );
    expect(fills.map((fill) => fill.odometerKm).sort()).toEqual([8100, 8500]);
    const records = dataOf<ServiceRecord[]>(
      await as(priya).get(`/api/v1/vehicles/${carId}/service-records`).expect(200),
    );
    expect(records[0]).toMatchObject({
      totalAmount: "2650.00",
      provider: { name: "Shivam Autozone" },
    });
    const expenses = dataOf<Expense[]>(
      await as(priya).get(`/api/v1/expenses?vehicleId=${carId}&pageSize=100`).expect(200),
    );
    // 2 fills + the service + the trip toll (linked) + 2 manual + 1 refund: nothing twice.
    expect(expenses.map((expense) => [expense.source, expense.kind]).sort()).toEqual(
      [
        ["FUEL", "EXPENSE"],
        ["FUEL", "EXPENSE"],
        ["MAINTENANCE", "EXPENSE"],
        ["MANUAL", "EXPENSE"],
        ["MANUAL", "EXPENSE"],
        ["MANUAL", "REFUND"],
        ["TRIP", "EXPENSE"],
      ].sort(),
    );
    expect(expenses.find((expense) => expense.title === "Ceramic coating")?.category.name).toBe(
      "Detailing",
    );
    const trips = dataOf<Trip[]>(
      await as(priya).get(`/api/v1/trips?vehicleId=${carId}`).expect(200),
    );
    expect(trips).toHaveLength(1);
    const papers = dataOf<VehicleDocument[]>(
      await as(priya).get("/api/v1/documents?pageSize=100").expect(200),
    );
    expect(papers.map((paper) => paper.name).sort()).toEqual([
      "Driving licence",
      "PUC certificate",
    ]);

    // The same file again: the vehicle is already there, so it's left out.
    const again = dataOf<BackupRestoreReport>(
      await as(priya).post("/api/v1/backup/restore", backup).expect(200),
    );
    expect(again.vehicles[0]).toMatchObject({ status: "EXISTS", counts: { fuel: 0 } });
    expect(again.documents).toEqual({
      count: 0,
      issues: [{ section: "documents", index: 0, message: "Already in your documents" }],
    });
  });

  it("brings back parts, schedules, loans with their EMIs, recurring payments, budgets and files", async () => {
    const { token, car } = await arjunsGarage();
    const post = (url: string, body: object) => as(token).post(url, body);
    const battery = dataOf<{ id: string }>(
      await post(`/api/v1/vehicles/${car.id}/components`, {
        kind: "BATTERY",
        name: "Amaron battery",
        installedAt: addDays(today, -200),
        installedKm: 6000,
      }).expect(201),
    );
    await post(`/api/v1/vehicles/${car.id}/maintenance-schedules`, {
      name: "Battery check",
      categoryKey: "ELECTRICAL.BATTERY_REPLACEMENT",
      intervalMonths: 6,
      componentId: battery.id,
    }).expect(201);
    const loan = dataOf<{ id: string }>(
      await post("/api/v1/vehicle-loans", {
        vehicleId: car.id,
        lender: "HDFC Bank",
        principal: "800000",
        annualRate: "9",
        tenureMonths: 60,
        firstEmiDate: addDays(today, -40),
      }).expect(201),
    );
    const emi = dataOf<{ id: string }>(
      await post("/api/v1/expenses", {
        allocation: { mode: "single", vehicleId: car.id },
        categoryId: keyed.get("FINANCE"),
        subcategoryId: keyed.get("FINANCE.EMI"),
        title: "HDFC Auto Loan",
        amount: "16684",
        principalAmount: "10950",
        interestAmount: "5734",
        loanId: loan.id,
        date: addDays(today, -10),
      }).expect(201),
    );
    await post("/api/v1/recurring-expenses", {
      vehicleId: car.id,
      title: "Society parking pass",
      amount: "1500",
      categoryId: keyed.get("DAILY_USAGE"),
      subcategoryId: keyed.get("DAILY_USAGE.PARKING"),
      every: 1,
      unit: "MONTH",
      startDate: addDays(today, -60),
    }).expect(201);
    await post("/api/v1/expense-budgets", { vehicleId: car.id, amount: "20000" }).expect(201);
    // A receipt on the EMI, a file on a document, and a profile photo.
    const send = async (announce: string, body: object) => {
      const slot = dataOf<UploadSlot>(await post(announce, body).expect(201));
      await request(app.getHttpServer())
        .put(new URL(slot.url).pathname)
        .set(slot.headers)
        .send(PNG)
        .expect(200);
      return slot.fileId;
    };
    const receipt = await send("/api/v1/attachments/uploads", {
      owner: "expense",
      ownerId: emi.id,
      fileName: "emi-receipt.png",
      contentType: "image/png",
      size: PNG.length,
    });
    await post(`/api/v1/attachments/uploads/${receipt}/confirm`, {}).expect(200);
    const scan = await send("/api/v1/documents/uploads", {
      fileName: "rc.png",
      contentType: "image/png",
      size: PNG.length,
    });
    await post(`/api/v1/documents/uploads/${scan}/confirm`, {}).expect(200);
    await post("/api/v1/documents", {
      vehicleId: car.id,
      type: "REGISTRATION",
      name: "Registration certificate",
      expiryDate: addDays(today, 3000),
      fileIds: [scan],
    }).expect(201);
    const photo = await send("/api/v1/users/me/avatar/uploads", {
      contentType: "image/png",
      size: PNG.length,
    });
    await post(`/api/v1/users/me/avatar/uploads/${photo}/confirm`, {}).expect(200);

    const backup = dataOf<Backup>(await as(token).get("/api/v1/backup").expect(200));
    const [entry] = backup.vehicles;
    expect(entry!.components).toHaveLength(1);
    expect(entry!.schedules[0]).toMatchObject({
      name: "Battery check",
      componentBackupId: battery.id,
    });
    expect(entry!.loans[0]).toMatchObject({ backupId: loan.id, lender: "HDFC Bank" });
    expect(entry!.recurring).toHaveLength(1);
    expect(entry!.budgets[0]).toMatchObject({ category: null, amount: "20000.00" });
    const emiRow = entry!.expenses.find((expense) => expense.title === "HDFC Auto Loan")!;
    expect(emiRow).toMatchObject({
      loanBackupId: loan.id,
      files: [{ fileName: "emi-receipt.png" }],
    });
    expect(backup.profilePhoto).toMatchObject({
      path: "files/profile-photo",
      contentType: "image/png",
    });
    const links = dataOf<BackupFileLink[]>(await as(token).get("/api/v1/backup/files").expect(200));
    expect(links.map((link) => link.path).sort()).toEqual(
      [
        emiRow.files[0]!.path,
        entry!.documents.find((doc) => doc.name === "Registration certificate")!.files[0]!.path,
        "files/profile-photo",
      ].sort(),
    );

    const priya = await signUp();
    const preview = dataOf<BackupRestoreReport>(
      await as(priya).post("/api/v1/backup/restore/preview", backup).expect(200),
    );
    expect(preview.fileCount).toBe(3);
    const restored = dataOf<BackupRestoreReport>(
      await as(priya).post("/api/v1/backup/restore", backup).expect(200),
    );
    const outcome = restored.vehicles[0]!;
    expect(outcome).toMatchObject({
      status: "RESTORED",
      counts: { components: 1, schedules: 1, loans: 1, recurring: 1, budgets: 1 },
      issues: [],
    });
    expect(restored.files.map((file) => file.kind).sort()).toEqual([
      "avatar",
      "document",
      "expense",
    ]);
    const newLoan = await prisma.vehicleLoan.findFirstOrThrow({
      where: { vehicleId: outcome.vehicleId! },
    });
    const newEmi = await prisma.expense.findFirstOrThrow({
      where: { vehicleId: outcome.vehicleId!, title: "HDFC Auto Loan" },
    });
    expect(newEmi.loanId).toBe(newLoan.id);
    expect(restored.files.find((file) => file.kind === "expense")?.id).toBe(newEmi.id);
    const newSchedule = await prisma.maintenanceSchedule.findFirstOrThrow({
      where: { vehicleId: outcome.vehicleId!, name: "Battery check" },
    });
    expect(newSchedule.componentId).not.toBeNull();
  });

  it("brings back inspections, part and trip photos, rate changes and paused payments", async () => {
    const { token, car } = await arjunsGarage();
    const post = (url: string, body: object = {}) => as(token).post(url, body);
    const upload = async (announce: string, body: object) => {
      const slot = dataOf<UploadSlot>(
        await post(announce, { ...body, contentType: "image/png", size: PNG.length }).expect(201),
      );
      await request(app.getHttpServer())
        .put(new URL(slot.url).pathname)
        .set(slot.headers)
        .send(PNG)
        .expect(200);
      return slot.fileId;
    };
    const tyres = dataOf<{ id: string }>(
      await post(`/api/v1/vehicles/${car.id}/components`, {
        kind: "TYRES",
        name: "Front left tyre",
        installedAt: addDays(today, -300),
      }).expect(201),
    );
    const warranty = await upload("/api/v1/attachments/uploads", {
      owner: "component",
      ownerId: tyres.id,
      fileName: "warranty.png",
    });
    await post(`/api/v1/attachments/uploads/${warranty}/confirm`).expect(200);
    const inspection = dataOf<{ id: string }>(
      await post(`/api/v1/vehicles/${car.id}/inspections`, {
        kind: "SELF_CHECK",
        templateKey: "MONTHLY",
        title: "Monthly check",
        date: addDays(today, -3),
        items: [
          { area: "TYRES", label: "Tread", condition: "ATTENTION", componentId: tyres.id },
          { area: "AC", label: "AC cooling", condition: "GOOD" },
        ],
      }).expect(201),
    );
    const sidewall = await upload("/api/v1/attachments/uploads", {
      owner: "inspection",
      ownerId: inspection.id,
      fileName: "sidewall.png",
    });
    await post(`/api/v1/attachments/uploads/${sidewall}/confirm`).expect(200);
    const loan = dataOf<{ id: string }>(
      await post("/api/v1/vehicle-loans", {
        vehicleId: car.id,
        lender: "SBI",
        principal: "600000",
        annualRate: "8.75",
        tenureMonths: 48,
        firstEmiDate: addDays(today, -100),
      }).expect(201),
    );
    await post(`/api/v1/vehicle-loans/${loan.id}/rate-changes`, {
      effectiveFrom: addDays(today, -20),
      annualRate: "9.25",
    }).expect(201);
    const pass = dataOf<{ id: string }>(
      await post("/api/v1/recurring-expenses", {
        vehicleId: car.id,
        title: "Car wash plan",
        amount: "800",
        categoryId: keyed.get("DAILY_USAGE"),
        every: 1,
        unit: "MONTH",
        startDate: addDays(today, -30),
      }).expect(201),
    );
    await post(`/api/v1/recurring-expenses/${pass.id}/pause`).expect(200);
    const types = dataOf<TripCategory[]>(
      await as(token).get("/api/v1/trip-categories?pageSize=100").expect(200),
    );
    const trip = dataOf<Trip>(
      await post("/api/v1/trips", {
        vehicleId: car.id,
        method: "DISTANCE",
        categoryId: types.find((type) => type.key === "ROAD_TRIP")!.id,
        date: addDays(today, -6),
        distanceKm: 120,
      }).expect(201),
    );
    const toll = dataOf<{ id: string }>(
      await post(`/api/v1/trips/${trip.id}/costs`, {
        category: "TOLL",
        amount: "240",
        date: addDays(today, -6),
      }).expect(201),
    );
    const receipt = await upload(`/api/v1/trips/${trip.id}/attachments/uploads`, {
      fileName: "toll.png",
      costId: toll.id,
    });
    await post(`/api/v1/trips/${trip.id}/attachments/${receipt}/confirm`).expect(200);

    const backup = dataOf<Backup>(await as(token).get("/api/v1/backup").expect(200));
    const [entry] = backup.vehicles;
    expect(entry!.inspections).toEqual([
      expect.objectContaining({
        title: "Monthly check",
        items: [
          expect.objectContaining({ label: "Tread", componentBackupId: tyres.id }),
          expect.objectContaining({ label: "AC cooling", componentBackupId: null }),
        ],
        files: [expect.objectContaining({ fileName: "sidewall.png" })],
      }),
    ]);
    expect(entry!.loans[0]).toMatchObject({
      rateChanges: [{ effectiveFrom: addDays(today, -20), annualRate: "9.25", keepEmi: true }],
    });
    expect(entry!.recurring).toEqual([expect.objectContaining({ paused: true })]);
    const links = dataOf<BackupFileLink[]>(await as(token).get("/api/v1/backup/files").expect(200));
    expect(links).toHaveLength(3);

    const priya = await signUp();
    const restored = dataOf<BackupRestoreReport>(
      await as(priya).post("/api/v1/backup/restore", backup).expect(200),
    );
    const outcome = restored.vehicles[0]!;
    expect(outcome).toMatchObject({
      status: "RESTORED",
      // arjunsGarage has a trip of its own.
      counts: { components: 1, inspections: 1, loans: 1, recurring: 1, trips: 2 },
      issues: [],
    });
    const vehicleId = outcome.vehicleId!;
    const [newPart, newInspection, newLoan, newPass, newTrip] = await Promise.all([
      prisma.vehicleComponent.findFirstOrThrow({ where: { vehicleId } }),
      prisma.inspection.findFirstOrThrow({
        where: { vehicleId },
        include: { items: { orderBy: { position: "asc" } } },
      }),
      prisma.vehicleLoan.findFirstOrThrow({ where: { vehicleId }, include: { rateChanges: true } }),
      prisma.recurringExpense.findFirstOrThrow({ where: { vehicleId, title: "Car wash plan" } }),
      prisma.trip.findFirstOrThrow({
        where: { vehicleId, costs: { some: { amount: 240 } } },
        include: { costs: true },
      }),
    ]);
    expect(newInspection.items.map((item) => item.componentId)).toEqual([newPart.id, null]);
    expect(newLoan.rateChanges.map((change) => change.annualRate.toFixed(2))).toEqual(["9.25"]);
    expect(newPass.status).toBe("PAUSED");
    expect(restored.files.map(({ kind, id, costId }) => ({ kind, id, costId }))).toEqual(
      expect.arrayContaining([
        { kind: "component", id: newPart.id, costId: undefined },
        { kind: "inspection", id: newInspection.id, costId: undefined },
        { kind: "trip", id: newTrip.id, costId: newTrip.costs[0]!.id },
      ]),
    );
  });

  it("restores one vehicle's archive, skipping rows that fail their checks", async () => {
    const arjun = await arjunsGarage();
    const archive = dataOf<Backup>(
      await as(arjun.token).get(`/api/v1/backup?vehicleId=${arjun.car.id}`).expect(200),
    );
    expect(archive.documents).toEqual([]);
    const fill = archive.vehicles[0]!.fuel[0]!;
    // Far over the usual 100 KB request limit: restore routes take whole backup files.
    const broken = Array.from({ length: 400 }, (_, index) => ({
      ...fill,
      backupId: `broken-${index}`,
      odometerKm: -1,
      notes: "x".repeat(400),
    }));
    archive.vehicles[0]!.fuel.push(...broken);

    const priya = await signUp();
    const preview = dataOf<BackupRestoreReport>(
      await as(priya).post("/api/v1/backup/restore/preview", archive).expect(200),
    );
    expect(preview.vehicles[0]).toMatchObject({
      status: "NEW",
      counts: { fuel: 2 },
      issueCount: 400,
    });
    expect(preview.vehicles[0]!.issues).toHaveLength(50);
    expect(preview.vehicles[0]!.issues[0]).toEqual({
      section: "fuel",
      index: 2,
      message: "Enter the odometer reading in km, e.g. 8450",
    });

    // Elsewhere the limit holds.
    await as(priya)
      .post("/api/v1/expenses", { title: "x".repeat(150_000) })
      .expect(413);
  });

  it("refuses files that aren't AutoMate backups, or from a newer version", async () => {
    const token = await signUp();
    const bad = await as(token)
      .post("/api/v1/backup/restore/preview", { hello: "world" })
      .expect(400);
    expect((bad.body as ApiErrorResponse).error.details).toContainEqual({
      field: "format",
      message: "This isn't an AutoMate backup file",
    });
    const newer = await as(token)
      .post("/api/v1/backup/restore/preview", {
        format: "automate-backup",
        version: 99,
        exportedAt: new Date().toISOString(),
        vehicles: [],
      })
      .expect(400);
    expect(JSON.stringify((newer.body as ApiErrorResponse).error.details)).toMatch(/newer version/);
    await request(app.getHttpServer()).get("/api/v1/backup").expect(401);
  });
});
