/**
 * Documents (M6) through the real HTTP pipeline, database and the local storage provider: upload
 * straight to storage, confirm (size and real type), attach, link, replace and delete. Users and
 * their files are removed afterwards.
 */
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";

import {
  type ActivityItem,
  addDays,
  type ApiErrorResponse,
  type ApiSuccessResponse,
  type DashboardOverview,
  type DocumentFile,
  type DocumentSummary,
  type FileLink,
  istToday,
  type PageMeta,
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

const DOMAIN = "documents.e2e.automate.test";
const DOCS = "/api/v1/documents";
const PDF = Buffer.from("%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\ntrailer\n%%EOF\n");

describe("Documents (e2e)", () => {
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
            email: `documents-${randomUUID()}@${DOMAIN}`,
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

  const as = (token: string) => ({
    get: (url: string) => request(app.getHttpServer()).get(url).auth(token, { type: "bearer" }),
    post: (url: string, body?: object) =>
      request(app.getHttpServer()).post(url).auth(token, { type: "bearer" }).send(body),
    patch: (url: string, body: object) =>
      request(app.getHttpServer()).patch(url).auth(token, { type: "bearer" }).send(body),
    put: (url: string, body: Buffer, headers: Record<string, string>) =>
      request(app.getHttpServer()).put(new URL(url).pathname).set(headers).send(body),
    delete: (url: string) =>
      request(app.getHttpServer()).delete(url).auth(token, { type: "bearer" }),
  });
  const dataOf = <T>(res: request.Response) => (res.body as ApiSuccessResponse<T>).data;
  const metaOf = (res: request.Response) =>
    (res.body as ApiSuccessResponse<unknown, PageMeta>).meta;

  async function vehicle(token: string) {
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
      })
      .expect(201);
    return dataOf<Vehicle>(res);
  }

  /** Announce, PUT straight to storage, confirm: the file's id. */
  async function upload(file = PDF, contentType = "application/pdf", size = file.length) {
    const slot = dataOf<UploadSlot>(
      await as(arjun)
        .post(`${DOCS}/uploads`, { fileName: "puc certificate.pdf", contentType, size })
        .expect(201),
    );
    return { slot, put: await as(arjun).put(slot.url, file, slot.headers) };
  }

  it("uploads straight to storage, checks the file, and attaches it to a document", async () => {
    const car = await vehicle(arjun);
    const { slot, put } = await upload();
    expect(put.status).toBe(200);
    const file = dataOf<DocumentFile>(
      await as(arjun).post(`${DOCS}/uploads/${slot.fileId}/confirm`).expect(200),
    );
    expect(file).toMatchObject({ fileName: "puc certificate.pdf", contentType: "application/pdf" });

    const created = dataOf<VehicleDocument>(
      await as(arjun)
        .post(DOCS, {
          vehicleId: car.id,
          type: "PUC",
          name: "PUC certificate",
          number: "HR026-PUC-9921",
          issueDate: addDays(today, -170),
          expiryDate: addDays(today, 12),
          fileIds: [slot.fileId],
        })
        .expect(201),
    );
    expect(created).toMatchObject({
      state: "EXPIRING",
      daysLeft: 12,
      reminderDays: [30, 7, 1],
      files: [{ id: slot.fileId }],
    });

    // The link serves the file back, with its real type.
    const link = dataOf<FileLink>(
      await as(arjun).get(`${DOCS}/${created.id}/files/${slot.fileId}/link`).expect(200),
    );
    const served = await request(app.getHttpServer()).get(new URL(link.url).pathname).expect(200);
    expect(served.headers["content-type"]).toBe("application/pdf");
    expect(Buffer.from(served.body as Buffer).equals(PDF)).toBe(true);
    // Someone else can't get a link, or confirm the upload.
    await as(priya).get(`${DOCS}/${created.id}/files/${slot.fileId}/link`).expect(404);
    await as(priya).post(`${DOCS}/uploads/${slot.fileId}/confirm`).expect(404);

    // Filters, search and the summary.
    await as(arjun)
      .post(DOCS, {
        vehicleId: car.id,
        type: "INSURANCE",
        name: "Motor insurance",
        expiryDate: addDays(today, 200),
      })
      .expect(201);
    await as(arjun)
      .post(DOCS, {
        vehicleId: car.id,
        type: "ROADSIDE_ASSISTANCE",
        name: "Roadside assist",
        expiryDate: addDays(today, -3),
      })
      .expect(201);
    await as(arjun)
      .post(DOCS, { type: "DRIVING_LICENCE", name: "Driving licence", number: "HR-0620110012345" })
      .expect(201);
    const page = await as(arjun).get(`${DOCS}?vehicleId=${car.id}`).expect(200);
    expect(dataOf<VehicleDocument[]>(page).map((doc) => doc.state)).toEqual([
      "EXPIRED",
      "EXPIRING",
      "VALID",
    ]);
    expect(metaOf(page)).toMatchObject({ total: 3 });
    const expired = await as(arjun).get(`${DOCS}?state=EXPIRED`).expect(200);
    expect(dataOf<VehicleDocument[]>(expired).map((doc) => doc.name)).toEqual(["Roadside assist"]);
    const found = await as(arjun).get(`${DOCS}?search=0620110`).expect(200);
    expect(dataOf<VehicleDocument[]>(found).map((doc) => doc.name)).toEqual(["Driving licence"]);
    expect(dataOf<DocumentSummary>(await as(arjun).get(`${DOCS}/summary`).expect(200))).toEqual({
      total: 4,
      valid: 1,
      expiring: 1,
      expired: 1,
      noExpiry: 1,
      vehicles: 1,
    });

    // Removing the file deletes it from storage too.
    await as(arjun).patch(`${DOCS}/${created.id}`, { fileIds: [] }).expect(200);
    await as(arjun).get(`${DOCS}/${created.id}/files/${slot.fileId}/link`).expect(404);
    await request(app.getHttpServer()).get(new URL(link.url).pathname).expect(404);

    await as(arjun).delete(`${DOCS}/${created.id}`).expect(204);
    await as(arjun).get(`${DOCS}/${created.id}`).expect(404);
  });

  it("refuses renamed files, oversized uploads, missing uploads and bad links", async () => {
    // A PDF announced as a PNG.
    const renamed = await upload(PDF, "image/png");
    const refused = await as(arjun)
      .post(`${DOCS}/uploads/${renamed.slot.fileId}/confirm`)
      .expect(400);
    expect((refused.body as ApiErrorResponse).message).toBe(
      "That file isn't the PDF or photo it says it is.",
    );
    // Bigger than announced: storage refuses it.
    const big = await upload(Buffer.concat([PDF, PDF]), "application/pdf", PDF.length);
    expect(big.put.status).toBe(413);
    // Never uploaded.
    const slot = dataOf<UploadSlot>(
      await as(arjun)
        .post(`${DOCS}/uploads`, { fileName: "rc.pdf", contentType: "application/pdf", size: 10 })
        .expect(201),
    );
    const missing = await as(arjun).post(`${DOCS}/uploads/${slot.fileId}/confirm`).expect(400);
    expect((missing.body as ApiErrorResponse).message).toBe(
      "The file didn't arrive. Upload it again.",
    );
    // A tampered token, and an unconfirmed file can't be attached.
    await as(arjun).put(`${slot.url}x`, PDF, slot.headers).expect(403);
    const car = await vehicle(arjun);
    await as(arjun)
      .post(DOCS, { vehicleId: car.id, type: "OTHER", name: "Receipt", fileIds: [slot.fileId] })
      .expect(400);
    // Type and size limits, and a vehicle for vehicle papers.
    await as(arjun)
      .post(`${DOCS}/uploads`, {
        fileName: "a.exe",
        contentType: "application/x-msdownload",
        size: 10,
      })
      .expect(400);
    await as(arjun)
      .post(`${DOCS}/uploads`, {
        fileName: "a.pdf",
        contentType: "application/pdf",
        size: 11 * 1024 * 1024,
      })
      .expect(400);
    const noVehicle = await as(arjun).post(DOCS, { type: "INSURANCE", name: "Policy" }).expect(400);
    expect((noVehicle.body as ApiErrorResponse).error.details).toEqual([
      { field: "vehicleId", message: "Choose a vehicle" },
    ]);
  });

  it("feeds the dashboard: the action centre, the expiry card and recent activity", async () => {
    const car = await vehicle(arjun);
    const puc = dataOf<VehicleDocument>(
      await as(arjun)
        .post(DOCS, {
          vehicleId: car.id,
          type: "PUC",
          name: "PUC certificate",
          expiryDate: addDays(today, 5),
        })
        .expect(201),
    );
    const overview = dataOf<DashboardOverview>(
      await as(arjun).get(`/api/v1/dashboard/overview?vehicleId=${car.id}`).expect(200),
    );
    expect(overview.status).toMatchObject({
      state: "ok",
      data: {
        level: "attention",
        untracked: ["maintenance"],
        items: [
          {
            id: `document:${puc.id}`,
            source: "document",
            severity: "warning",
            title: "PUC certificate expires in 5 days",
            action: { label: "Renew", href: `/documents/${puc.id}/edit?renew=1` },
          },
        ],
      },
    });
    expect(overview.expiries).toMatchObject({
      state: "ok",
      data: [
        { id: `document:${puc.id}`, label: "PUC certificate", state: "expiring" },
        { id: "insurance", state: "not_added", href: "/documents/new?type=INSURANCE" },
      ],
    });
    const activity = dataOf<ActivityItem[]>(
      await as(arjun).get(`/api/v1/dashboard/activity?vehicleId=${car.id}`).expect(200),
    );
    expect(activity[0]).toMatchObject({
      kind: "document",
      title: "Added PUC certificate",
      href: `/documents/${puc.id}`,
    });
  });
});
