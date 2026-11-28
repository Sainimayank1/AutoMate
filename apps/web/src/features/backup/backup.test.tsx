import type { BackupRestoreReport, FuelEntry } from "@automate/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InternalAxiosRequestConfig } from "axios";
import { strToU8, zipSync } from "fflate";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSessionStore } from "@/stores/session-store";
import { useActiveVehicleStore } from "@/stores/vehicle-store";
import { fail, mockApi, type MockReply, ok, okPage, testUser, testVehicle } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";

const downloads = vi.hoisted(() => [] as { filename: string; text: string }[]);
vi.mock("@/utils/csv", async (original) => ({
  ...(await original<typeof import("@/utils/csv")>()),
  downloadCsv: (filename: string, csv: string) => downloads.push({ filename, text: csv }),
  downloadFile: (filename: string, parts: string[]) =>
    downloads.push({ filename, text: parts.join("") }),
}));

const victoris = testVehicle();
const fill: FuelEntry = {
  id: "0190d4a2-0000-7000-8000-00000000f001",
  vehicleId: victoris.id,
  filledAt: "2026-11-20T03:30:00.000Z",
  odometerKm: 8100,
  fuelType: "PETROL",
  quantity: "30.000",
  pricePerUnit: "104.320",
  totalAmount: "3129.60",
  isFullTank: true,
  missedPrevious: false,
  stationName: "IndianOil, Sohna Road",
  latitude: null,
  longitude: null,
  location: null,
  paymentMethod: "UPI",
  notes: null,
  distanceKm: null,
  mileage: null,
  mileageStatus: "BASELINE",
  createdAt: "2026-11-20T03:30:00.000Z",
  updatedAt: "2026-11-20T03:30:00.000Z",
};
const counts = {
  fuel: 2,
  services: 1,
  expenses: 2,
  trips: 1,
  documents: 1,
  components: 0,
  schedules: 0,
  loans: 0,
  recurring: 0,
  budgets: 0,
};
const report = (status: "NEW" | "RESTORED"): BackupRestoreReport => ({
  exportedAt: "2026-11-28T05:12:00.000Z",
  vehicles: [
    {
      index: 0,
      name: "Maruti Suzuki Victoris LXI",
      registrationNumber: "HR26EV4821",
      status,
      vehicleId: status === "RESTORED" ? "0190d4a2-0000-7000-8000-0000000000aa" : null,
      counts,
      issues: [{ section: "fuel", index: 11, message: "Enter the odometer reading in km" }],
      issueCount: 1,
    },
    {
      index: 1,
      name: "Hyundai Creta SX",
      registrationNumber: "HR26DQ1190",
      status: "EXISTS",
      vehicleId: null,
      counts: {
        fuel: 0,
        services: 0,
        expenses: 0,
        trips: 0,
        documents: 0,
        components: 0,
        schedules: 0,
        loans: 0,
        recurring: 0,
        budgets: 0,
      },
      issues: [],
      issueCount: 0,
    },
  ],
  documents: { count: 0, issues: [] },
  fileCount: 0,
  files: [],
});
const backupFile = {
  format: "automate-backup",
  version: 1,
  exportedAt: "2026-11-28T05:12:00.000Z",
};

type Routes = Record<string, (config: InternalAxiosRequestConfig) => MockReply>;
function api(routes: Routes) {
  return mockApi((config) => {
    const key = `${(config.method ?? "get").toUpperCase()} ${config.url}`;
    return routes[key]?.(config) ?? fail(404, "NOT_FOUND", "Not found");
  });
}
const body = (config?: InternalAxiosRequestConfig) =>
  typeof config?.data === "string" ? (JSON.parse(config.data) as unknown) : config?.data;
const base: Routes = { "GET /vehicles": () => okPage([victoris]) };

beforeEach(() => {
  downloads.length = 0;
  useSessionStore.getState().setSession({ user: testUser, accessToken: "t" });
  useActiveVehicleStore.setState({ activeVehicleId: null });
});

describe("backup & export", () => {
  it("exports the vehicle's fill-ups as CSV and everything as a backup file", async () => {
    api({
      ...base,
      [`GET /vehicles/${victoris.id}/fuel-entries`]: () => okPage([fill]),
      "GET /backup": (config) =>
        ok({ ...backupFile, vehicles: [], documents: [], vehicleId: config.params?.vehicleId }),
    });
    renderApp("/backup");
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("button", { name: "Download CSV: Fuel history (CSV)" }),
    );
    await waitFor(() => expect(downloads).toHaveLength(1));
    const [header, first] = downloads[0]!.text.split("\r\n");
    expect(downloads[0]!.filename).toMatch(/^automate-HR26EV4821-fuel-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(header).toMatch(/^Filled at,Odometer \(km\),Fuel,/);
    expect(first).toContain("8100,Petrol,30.000,104.320,3129.60,Full");

    await user.click(screen.getByRole("button", { name: "Records only (.json)" }));
    await waitFor(() => expect(downloads).toHaveLength(2));
    expect(downloads[1]!.filename).toMatch(/^automate-backup-.*\.json$/);
    expect(JSON.parse(downloads[1]!.text)).toMatchObject({ format: "automate-backup" });

    expect(screen.getByRole("link", { name: "Open Trips" })).toHaveAttribute(
      "href",
      "/trips/history",
    );
    expect(screen.getByRole("link", { name: "Open report" })).toHaveAttribute(
      "href",
      `/expenses/report?vehicle=${victoris.id}&period=all_time`,
    );
  });

  it("previews a backup, then restores what isn't in the garage", async () => {
    const calls = api({
      ...base,
      "POST /backup/restore/preview": () => ok(report("NEW")),
      "POST /backup/restore": () => ok(report("RESTORED")),
    });
    renderApp("/backup");
    const user = userEvent.setup();

    const file = new File([JSON.stringify(backupFile)], "automate-backup-2026-11-28.json", {
      type: "application/json",
    });
    await user.upload(await screen.findByLabelText("Backup file"), file);
    const preview = within(await screen.findByRole("region", { name: "In this backup" }));
    expect(preview.getByText("Will be restored")).toBeInTheDocument();
    expect(
      preview.getByText("2 fill-ups · 1 service record · 2 expenses · 1 trip · 1 document"),
    ).toBeInTheDocument();
    expect(preview.getByText("Already in your garage, skipped")).toBeInTheDocument();
    await user.click(preview.getByRole("button", { name: /1 row can't be restored/ }));
    expect(preview.getByText("Fill-up 12: Enter the odometer reading in km")).toBeInTheDocument();
    expect(calls.find((call) => call.url === "/backup/restore")).toBeUndefined();

    await user.click(preview.getByRole("button", { name: "Restore 1 vehicle" }));
    const done = within(await screen.findByRole("region", { name: "Restored" }));
    expect(done.getByText("Restored 1 vehicle.")).toBeInTheDocument();
    expect(
      done.getByRole("link", { name: "Maruti Suzuki Victoris LXI (HR26EV4821)" }),
    ).toHaveAttribute("href", "/garage/0190d4a2-0000-7000-8000-0000000000aa");
    const sent = calls.find((call) => call.url === "/backup/restore")!;
    expect(typeof sent.data === "string" ? JSON.parse(sent.data) : sent.data).toEqual(backupFile);
  });

  it("says when a file isn't a backup, and shows the API's reason", async () => {
    api({
      ...base,
      "POST /backup/restore/preview": () =>
        fail(400, "VALIDATION_ERROR", "Check the highlighted fields", [
          {
            field: "version",
            message: "Made by a newer version of AutoMate: update the app, then restore",
          },
        ]),
    });
    renderApp("/backup");
    const user = userEvent.setup();

    await user.upload(
      await screen.findByLabelText("Backup file"),
      new File(["not json"], "notes.json", { type: "application/json" }),
    );
    expect(await screen.findByText("This file isn't an AutoMate backup.")).toBeInTheDocument();

    await user.upload(
      screen.getByLabelText("Backup file"),
      new File([JSON.stringify({ ...backupFile, version: 9 })], "new.json", {
        type: "application/json",
      }),
    );
    expect(
      await screen.findByText("Made by a newer version of AutoMate: update the app, then restore"),
    ).toBeInTheDocument();
  });

  it("restores a ZIP backup, then puts each file back on its record", async () => {
    const receipt = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const zipped = zipSync({
      "backup.json": strToU8(JSON.stringify(backupFile)),
      "files/f1/emi-receipt.png": receipt,
    });
    const restored: BackupRestoreReport = {
      ...report("RESTORED"),
      fileCount: 1,
      files: [
        {
          path: "files/f1/emi-receipt.png",
          fileName: "emi-receipt.png",
          contentType: "image/png",
          kind: "expense",
          id: "0190d4a2-0000-7000-8000-0000000e00aa",
        },
      ],
    };
    const puts: string[] = [];
    vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
      if (init?.method === "PUT") puts.push(url);
      return Promise.resolve(new Response(null, { status: 200 }));
    });
    const calls = api({
      ...base,
      "POST /backup/restore/preview": () => ok({ ...report("NEW"), fileCount: 1 }),
      "POST /backup/restore": () => ok(restored),
      "POST /attachments/uploads": () =>
        ok(
          {
            fileId: "0190d4a2-0000-7000-8000-0000000f00aa",
            url: "http://storage.test/put",
            headers: {},
            expiresAt: "2026-11-28T12:00:00.000Z",
          },
          201,
        ),
      "POST /attachments/uploads/0190d4a2-0000-7000-8000-0000000f00aa/confirm": () =>
        ok({
          id: "0190d4a2-0000-7000-8000-0000000f00aa",
          fileName: "emi-receipt.png",
          contentType: "image/png",
          size: 8,
          createdAt: "2026-11-28T12:00:00.000Z",
        }),
    });
    renderApp("/backup");
    const user = userEvent.setup();

    await user.upload(
      await screen.findByLabelText("Backup file"),
      new File([zipped as Uint8Array<ArrayBuffer>], "automate-backup.zip", {
        type: "application/zip",
      }),
    );
    const preview = within(await screen.findByRole("region", { name: "In this backup" }));
    expect(
      preview.getByText("1 file (photos, receipts, document scans) will be restored too."),
    ).toBeInTheDocument();
    await user.click(preview.getByRole("button", { name: "Restore 1 vehicle" }));
    expect(await screen.findByText("1 file restored.")).toBeInTheDocument();
    expect(body(calls.find((call) => call.url === "/attachments/uploads"))).toMatchObject({
      owner: "expense",
      ownerId: "0190d4a2-0000-7000-8000-0000000e00aa",
      fileName: "emi-receipt.png",
      size: 8,
    });
    expect(puts).toEqual(["http://storage.test/put"]);
    vi.unstubAllGlobals();
  });
});
