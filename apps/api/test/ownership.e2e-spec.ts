/**
 * Ownership cost (Expenses phase 6) and CSV import (phase 8) through the real HTTP pipeline and
 * database: the three money views, depreciation on the IRDAI schedule, and importing the export. Users are created under a throwaway domain and
 * deleted afterwards.
 */
import { randomUUID } from "node:crypto";

import {
  addMonths,
  type ApiErrorResponse,
  type ApiSuccessResponse,
  type Expense,
  type ExpenseImportPreview,
  type ExpenseImportResult,
  type ExpenseReport,
  istToday,
  type OwnershipCost,
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

const DOMAIN = "ownership.e2e.automate.test";
const OWNERSHIP = "/api/v1/expenses/ownership";
const EXPENSES = "/api/v1/expenses";

describe("Ownership cost and CSV import (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let arjun: string;
  let priya: string;
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
    const signUp = async (name: string) =>
      (
        await app.get(AuthService).register(
          {
            name,
            email: `ownership-${randomUUID()}@${DOMAIN}`,
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
  const id = (key: string) => keyed.get(key)!;

  async function vehicle(token: string, extra: object = {}) {
    const plate = `KA${Math.floor(10 + Math.random() * 89)}RC${Math.floor(1000 + Math.random() * 9000)}`;
    const res = await as(token)
      .post("/api/v1/vehicles", {
        make: "Maruti Suzuki",
        model: "Victoris",
        manufacturingYear: 2025,
        category: "SUV",
        registrationNumber: plate,
        fuelType: "PETROL",
        transmission: "MANUAL",
        ownershipType: "FINANCED",
        odometerKm: 8000,
        ...extra,
      })
      .expect(201);
    return dataOf<Vehicle>(res);
  }

  const spend = async (car: string, values: Record<string, string>) =>
    dataOf<Expense>(
      await as(arjun)
        .post(EXPENSES, { allocation: { mode: "single", vehicleId: car }, date: today, ...values })
        .expect(201),
    );
  async function record(car: string) {
    const toll = await spend(car, {
      categoryId: id("DAILY_USAGE"),
      subcategoryId: id("DAILY_USAGE.TOLL"),
      title: "NH-48 FASTag",
      amount: "640",
    });
    await as(arjun)
      .post(`${EXPENSES}/${toll.id}/refunds`, { amount: "140", date: today, reason: "REFUND" })
      .expect(201);
    await spend(car, {
      categoryId: id("INSURANCE_LEGAL"),
      subcategoryId: id("INSURANCE_LEGAL.COMPREHENSIVE"),
      title: "ICICI Lombard",
      amount: "12000",
    });
    await spend(car, {
      categoryId: id("FINANCE"),
      subcategoryId: id("FINANCE.EMI"),
      title: "HDFC EMI",
      amount: "16607",
      principalAmount: "12129",
      interestAmount: "4478",
    });
    await spend(car, { categoryId: id("ACCESSORIES"), title: "Dashcam", amount: "6500" });
  }

  it("splits the money three ways since purchase, depreciation on the schedule", async () => {
    const purchased = addMonths(today, -12);
    const car = await vehicle(arjun, { purchasePrice: "1145000", purchaseDate: purchased });
    await record(car.id);

    const res = await as(arjun).get(`${OWNERSHIP}?vehicleId=${car.id}&period=all_time`).expect(200);
    // A year on the schedule: 15% of ₹11,45,000.
    expect(dataOf<OwnershipCost>(res)).toMatchObject({
      period: "all_time",
      window: { from: purchased, to: today },
      operating: "500.00",
      ownership: "12000.00",
      financingCharges: "4478.00",
      capital: "6500.00",
      depreciation: {
        amount: "171750.00",
        purchasePrice: "1145000.00",
        purchaseDate: purchased,
        ageMonths: 12,
        percent: "15.0",
        estimatedValue: "973250.00",
        beyondSchedule: false,
      },
      economic: "195228.00",
      // The full EMI is paid; its principal is cash, never cost.
      cashOutflow: "35607.00",
      principal: "12129.00",
      distanceKm: null,
      economicPerKm: null,
      months: "12.0",
      perMonth: "16269.00",
    });

    const month = dataOf<OwnershipCost>(
      await as(arjun).get(`${OWNERSHIP}?vehicleId=${car.id}&period=this_month`).expect(200),
    );
    expect(month.window).toEqual({ from: `${today.slice(0, 7)}-01`, to: today });
    expect(month.cashOutflow).toBe("35607.00");
    // A sliver of the year's loss, never more than it.
    expect(Number(month.depreciation!.amount)).toBeGreaterThan(0);
    expect(Number(month.depreciation!.amount)).toBeLessThan(171750);
    // The report: the same figures, by category (largest first) and by month.
    const report = dataOf<ExpenseReport>(
      await as(arjun).get(`${EXPENSES}/report?vehicleId=${car.id}&period=all_time`).expect(200),
    );
    expect(report.ownership.economic).toBe("195228.00");
    expect(report.categories.map((row) => [row.category.key, row.amount, row.percent])).toEqual([
      ["INSURANCE_LEGAL", "12000.00", 51.1],
      ["ACCESSORIES", "6500.00", 27.7],
      ["FINANCE", "4478.00", 19.1],
      ["DAILY_USAGE", "500.00", 2.1],
    ]);
    expect(report.months).toEqual([{ month: today.slice(0, 7), total: "23478.00" }]);

    // The default period is this year.
    const year = dataOf<OwnershipCost>(
      await as(arjun).get(`${OWNERSHIP}?vehicleId=${car.id}`).expect(200),
    );
    expect(year.period).toBe("this_year");
  });

  it("has no depreciation without a purchase price, and stays private", async () => {
    const car = await vehicle(arjun);
    await record(car.id);
    const all = dataOf<OwnershipCost>(
      await as(arjun).get(`${OWNERSHIP}?vehicleId=${car.id}&period=all_time`).expect(200),
    );
    expect(all).toMatchObject({
      window: { from: today, to: today },
      depreciation: null,
      economic: "23478.00",
      months: "1.0",
    });

    await as(priya).get(`${OWNERSHIP}?vehicleId=${car.id}`).expect(404);
    const bad = await as(arjun).get(`${OWNERSHIP}?vehicleId=${car.id}&period=custom`).expect(400);
    expect((bad.body as ApiErrorResponse).error.code).toBe("VALIDATION_ERROR");
    await as(arjun).get(OWNERSHIP).expect(400);
  });

  it("imports the export's columns: checks every row, skips linked and loan rows, spots duplicates", async () => {
    const car = await vehicle(arjun);
    const future = addMonths(today, 1);
    const csv = [
      "Date,Title,Category,Subcategory,Vehicle,Amount (INR),Payment method,Vendor,Source,Notes",
      `${today},NH-48 FASTag,Daily usage,Toll,Victoris,640.00,UPI,,Manual,`,
      `${today},NH-48 FASTag,Daily usage,Toll,Victoris,640.00,UPI,,Manual,`,
      `${today},Refund · NH-48 FASTag,Daily usage,Toll,Victoris,-140.00,UPI,,Manual,`,
      `${today},IndianOil XP95,Fuel,Petrol,Victoris,3379.97,UPI,,Fuel,`,
      `${today},HDFC EMI,Finance,Vehicle EMI,Victoris,16607.00,,,Manual,`,
      "31/02/2026,Odd date,Daily usage,,Victoris,100,,,,",
      `${today},Mystery,Gadgets,,Victoris,100,,,,`,
      `${today},Car wash,daily_usage,Washing & detailing,Victoris,"₹850.00",Net banking,"3M Car Care, Sector 29",,"Foam wash"`,
      `${future},Booked service,Daily usage,,Victoris,500,,,,`,
    ].join("\r\n");
    const body = { vehicleId: car.id, csv };

    const preview = dataOf<ExpenseImportPreview>(
      await as(arjun).post(`${EXPENSES}/import/preview`, body).expect(200),
    );
    expect(preview.counts).toEqual({ ready: 2, duplicate: 1, skipped: 3, error: 3 });
    expect(preview.rows.map((row) => [row.line, row.status, row.message])).toEqual([
      [3, "duplicate", expect.stringContaining("already recorded") as string],
      [4, "skipped", "Refunds aren't imported: record them on their expense."],
      [5, "skipped", "From Fuel: it's linked there, so it isn't imported again."],
      [6, "skipped", "Loan payments need their principal and interest: add them by hand."],
      [7, "error", "Enter the date as DD/MM/YYYY or YYYY-MM-DD."],
      [8, "error", 'No category called "Gadgets".'],
      [10, "error", "This date is in the future."],
      [2, "ready", null],
      [9, "ready", null],
    ]);

    const result = dataOf<ExpenseImportResult>(
      await as(arjun).post(`${EXPENSES}/import`, body).expect(201),
    );
    expect(result).toEqual({ imported: 2, notImported: 7 });
    const list = await as(arjun).get(`${EXPENSES}?vehicleId=${car.id}&source=IMPORT`).expect(200);
    const imported = dataOf<Expense[]>(list);
    expect(imported.map((expense) => [expense.title, expense.amount]).sort()).toEqual([
      ["Car wash", "850.00"],
      ["NH-48 FASTag", "640.00"],
    ]);
    expect(imported.find((expense) => expense.title === "Car wash")).toMatchObject({
      subcategory: { name: "Washing & detailing" },
      paymentMethod: "NET_BANKING",
      vendor: "3M Car Care, Sector 29",
      notes: "Foam wash",
    });

    // The same file again: everything ready is now already recorded.
    const again = dataOf<ExpenseImportResult>(
      await as(arjun).post(`${EXPENSES}/import`, body).expect(201),
    );
    expect(again).toEqual({ imported: 0, notImported: 9 });

    const bad = await as(arjun)
      .post(`${EXPENSES}/import/preview`, { vehicleId: car.id, csv: "Date,Title\n2026-11-01,X" })
      .expect(400);
    expect((bad.body as ApiErrorResponse).message).toBe(
      "The file needs these columns: category, amount (inr).",
    );
    await as(priya).post(`${EXPENSES}/import/preview`, body).expect(404);
  });
});
