/**
 * Attachments and the storage sweep through the real HTTP pipeline, database and local storage:
 * a receipt on an expense end to end, files going with their record, abandoned uploads swept,
 * and other users kept out.
 */
import { randomUUID } from "node:crypto";
import { access, rm } from "node:fs/promises";
import { resolve } from "node:path";

import {
  addDays,
  type ApiErrorResponse,
  type ApiSuccessResponse,
  type Attachment,
  type Expense,
  type FileLink,
  istToday,
  type PageMeta,
  type UploadSlot,
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
import { StorageSweepService } from "@/storage/storage-sweep.service";

const DOMAIN = "attachments.e2e.automate.test";
const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
]);
const stored = (key: string) => resolve(".storage", key);
const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

describe("Attachments (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let sweep: StorageSweepService;
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
    sweep = app.get(StorageSweepService);
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
          email: `files-${randomUUID()}@${DOMAIN}`,
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
    delete: (url: string) =>
      request(app.getHttpServer()).delete(url).auth(token, { type: "bearer" }),
  });
  const dataOf = <T>(res: request.Response) => (res.body as ApiSuccessResponse<T>).data;

  async function expense(token: string) {
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
    return dataOf<Expense>(
      await as(token)
        .post("/api/v1/expenses", {
          allocation: { mode: "single", vehicleId: car.id },
          categoryId: keyed.get("DAILY_USAGE"),
          title: "Car wash",
          amount: "450",
          date: addDays(today, -1),
        })
        .expect(201),
    );
  }

  /** Announce, PUT straight to storage, confirm. */
  async function upload(token: string, ownerId: string) {
    const slot = dataOf<UploadSlot>(
      await as(token)
        .post("/api/v1/attachments/uploads", {
          owner: "expense",
          ownerId,
          fileName: "receipt.png",
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
    return {
      slot,
      confirm: () => as(token).post(`/api/v1/attachments/uploads/${slot.fileId}/confirm`),
    };
  }

  it("keeps a receipt on an expense: upload, list, link, remove", async () => {
    const token = await signUp();
    const wash = await expense(token);
    const { confirm } = await upload(token, wash.id);
    const receipt = dataOf<Attachment>(await confirm().expect(200));
    expect(receipt).toMatchObject({ fileName: "receipt.png", contentType: "image/png", size: 16 });

    const list = await as(token)
      .get(`/api/v1/attachments?owner=expense&ownerId=${wash.id}`)
      .expect(200);
    expect(dataOf<Attachment[]>(list).map((file) => file.id)).toEqual([receipt.id]);
    expect((list.body as ApiSuccessResponse<unknown, PageMeta>).meta).toMatchObject({ total: 1 });
    const link = dataOf<FileLink>(
      await as(token).get(`/api/v1/attachments/${receipt.id}/link`).expect(200),
    );
    expect(link.url).toContain("/storage/local/");

    const row = await prisma.attachment.findUniqueOrThrow({ where: { id: receipt.id } });
    expect(await exists(stored(row.key))).toBe(true);
    await as(token).delete(`/api/v1/attachments/${receipt.id}`).expect(204);
    expect(await exists(stored(row.key))).toBe(false);
    await as(token).get(`/api/v1/attachments/${receipt.id}/link`).expect(404);
  });

  it("refuses a file that isn't what it says, and other users' records", async () => {
    const token = await signUp();
    const wash = await expense(token);
    const slot = dataOf<UploadSlot>(
      await as(token)
        .post("/api/v1/attachments/uploads", {
          owner: "expense",
          ownerId: wash.id,
          fileName: "receipt.pdf",
          contentType: "application/pdf",
          size: PNG.length,
        })
        .expect(201),
    );
    await request(app.getHttpServer())
      .put(new URL(slot.url).pathname)
      .set(slot.headers)
      .send(PNG)
      .expect(200);
    const refused = await as(token)
      .post(`/api/v1/attachments/uploads/${slot.fileId}/confirm`)
      .expect(400);
    expect((refused.body as ApiErrorResponse).error.details[0]).toMatchObject({ field: "file" });

    const other = await signUp();
    await as(other).get(`/api/v1/attachments?owner=expense&ownerId=${wash.id}`).expect(404);
    await as(other)
      .post("/api/v1/attachments/uploads", {
        owner: "expense",
        ownerId: wash.id,
        fileName: "x.png",
        contentType: "image/png",
        size: 16,
      })
      .expect(404);
  });

  it("removes files with their record, and sweeps abandoned uploads", async () => {
    const token = await signUp();
    const wash = await expense(token);
    const { slot, confirm } = await upload(token, wash.id);
    await confirm().expect(200);
    const kept = await prisma.attachment.findUniqueOrThrow({ where: { id: slot.fileId } });

    // Announced and sent, never confirmed, two days ago.
    const abandoned = await upload(token, wash.id);
    await prisma.attachment.update({
      where: { id: abandoned.slot.fileId },
      data: { createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
    });
    const left = await prisma.attachment.findUniqueOrThrow({
      where: { id: abandoned.slot.fileId },
    });
    const swept = await sweep.run();
    expect(swept.abandoned).toBeGreaterThanOrEqual(1);
    expect(await prisma.attachment.findUnique({ where: { id: left.id } })).toBeNull();
    expect(await exists(stored(left.key))).toBe(false);
    expect(await exists(stored(kept.key))).toBe(true);

    // Deleting the expense takes its receipt with it: the trigger queues the object.
    await as(token).delete(`/api/v1/expenses/${wash.id}`).expect(204);
    expect(await prisma.storageOrphan.findUnique({ where: { key: kept.key } })).not.toBeNull();
    await sweep.run();
    expect(await exists(stored(kept.key))).toBe(false);
    expect(await prisma.storageOrphan.findUnique({ where: { key: kept.key } })).toBeNull();
  });
});
