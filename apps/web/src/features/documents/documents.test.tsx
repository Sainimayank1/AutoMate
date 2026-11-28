import type { DocumentSummary, VehicleDocument } from "@automate/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSessionStore } from "@/stores/session-store";
import { useActiveVehicleStore } from "@/stores/vehicle-store";
import { fail, mockApi, type MockReply, ok, okPage, testUser, testVehicle } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";

const victoris = testVehicle();
const ID = (n: number) => `0190d4a2-0000-7000-8000-0000000f${String(n).padStart(4, "0")}`;
const doc = (overrides: Partial<VehicleDocument>): VehicleDocument => ({
  id: ID(1),
  vehicleId: victoris.id,
  type: "PUC",
  name: "PUC certificate",
  number: "HR026-PUC-9921",
  issuer: "Shree Balaji PUC Centre",
  issueDate: "2026-06-10",
  expiryDate: "2026-12-10",
  notes: null,
  reminderDays: [30, 7, 1],
  remindOn: null,
  state: "EXPIRING",
  daysLeft: 12,
  files: [],
  createdAt: "2026-06-10T00:00:00.000Z",
  updatedAt: "2026-06-10T00:00:00.000Z",
  ...overrides,
});
const puc = doc({});
const rsa = doc({
  id: ID(2),
  type: "ROADSIDE_ASSISTANCE",
  name: "Roadside assist",
  number: "MSIL-RSA-7721",
  expiryDate: "2026-11-06",
  state: "EXPIRED",
  daysLeft: -22,
});
const summary: DocumentSummary = {
  total: 2,
  valid: 0,
  expiring: 1,
  expired: 1,
  noExpiry: 0,
  vehicles: 1,
};

type Routes = Record<string, (config: InternalAxiosRequestConfig) => MockReply>;
function api(routes: Routes) {
  return mockApi((config) => {
    const key = `${(config.method ?? "get").toUpperCase()} ${config.url}`;
    return routes[key]?.(config) ?? fail(404, "NOT_FOUND", "Not found");
  });
}
const base: Routes = {
  "GET /vehicles": () => okPage([victoris]),
  "GET /documents/summary": () => ok(summary),
  "GET /documents": (config) => {
    const state = (config.params as { state?: string }).state;
    return okPage(state === "EXPIRED" ? [rsa] : state === "EXPIRING" ? [puc] : [rsa, puc]);
  },
};
const bodyOf = (config: InternalAxiosRequestConfig | undefined) =>
  JSON.parse(String(config?.data)) as Record<string, unknown>;

beforeEach(() => {
  useSessionStore.getState().setSession({ user: testUser, accessToken: "t" });
  useActiveVehicleStore.setState({ activeVehicleId: null });
});
afterEach(() => vi.unstubAllGlobals());

describe("documents vault", () => {
  it("counts by state, lists soonest first, filters by type and shows renewals", async () => {
    const calls = api(base);
    renderApp("/documents");
    const user = userEvent.setup();

    const counts = within(await screen.findByRole("region", { name: "Documents by state" }));
    expect(await counts.findByText("Expiring soon")).toBeInTheDocument();
    const list = within(screen.getByRole("region", { name: "Documents" }));
    const card = within(
      (await list.findByRole("heading", { name: "PUC certificate" })).closest("a")!,
    );
    expect(card.getByText("12 days")).toBeInTheDocument();
    expect(card.getByText("10/12/2026")).toHaveClass("text-warning");
    expect(card.getByRole("heading").closest("a")).toHaveAttribute("href", `/documents/${puc.id}`);
    expect(list.getByText("Expired on")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Upload new" })).toHaveAttribute(
      "href",
      `/documents/${rsa.id}/edit?renew=1`,
    );

    await user.click(screen.getByRole("button", { name: "Insurance" }));
    await waitFor(() =>
      expect(
        calls
          .filter((call) => call.url === "/documents" && !(call.params as { state?: string }).state)
          .at(-1)?.params,
      ).toMatchObject({ type: "INSURANCE", page: 1 }),
    );
  });
});

describe("add a document", () => {
  it("uploads a file straight to storage, then saves the document with it", async () => {
    const put = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })));
    vi.stubGlobal("fetch", put);
    const file = {
      id: ID(50),
      fileName: "puc.pdf",
      contentType: "application/pdf",
      size: 9,
      createdAt: "",
    };
    const calls = api({
      ...base,
      "POST /documents/uploads": () =>
        ok(
          {
            fileId: ID(50),
            url: "https://bucket.example/put",
            headers: { "content-type": "application/pdf" },
            expiresAt: "",
          },
          201,
        ),
      [`POST /documents/uploads/${ID(50)}/confirm`]: () => ok(file),
      "POST /documents": (config) => ok({ ...puc, ...bodyOf(config), id: ID(9) }, 201),
      [`GET /documents/${ID(9)}`]: () => ok({ ...puc, id: ID(9) }),
    });
    renderApp("/documents/new");
    const user = userEvent.setup();

    await user.type(
      await screen.findByRole("textbox", { name: "Document name" }),
      "PUC certificate",
    );
    await user.upload(
      screen.getByLabelText("Files"),
      new File(["%PDF-1.7"], "puc.pdf", { type: "application/pdf" }),
    );
    const files = within(await screen.findByRole("list", { name: "Attached files" }));
    expect(await files.findByText("8 B")).toBeInTheDocument();
    expect(put).toHaveBeenCalledWith(
      "https://bucket.example/put",
      expect.objectContaining({ method: "PUT", headers: { "content-type": "application/pdf" } }),
    );
    expect(bodyOf(calls.find((call) => call.url === "/documents/uploads"))).toEqual({
      fileName: "puc.pdf",
      contentType: "application/pdf",
      size: 8,
    });

    await user.click(screen.getByRole("button", { name: "Save to vault" }));
    await waitFor(() =>
      expect(
        bodyOf(calls.find((call) => call.method === "post" && call.url === "/documents")),
      ).toMatchObject({
        vehicleId: victoris.id,
        type: "PUC",
        name: "PUC certificate",
        reminderDays: [30, 7, 1],
        fileIds: [ID(50)],
      }),
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: "PUC certificate" }),
    ).toBeInTheDocument();
  });

  it("refuses a file type storage won't take, before uploading", async () => {
    api(base);
    renderApp("/documents/new");
    const user = userEvent.setup({ applyAccept: false });
    await user.upload(
      await screen.findByLabelText("Files"),
      new File(["x"], "notes.txt", { type: "text/plain" }),
    );
    expect(await screen.findByText("Use a PDF, JPEG, PNG, WebP or HEIC file.")).toBeInTheDocument();
  });
});

describe("document details", () => {
  it("shows the details and reminders, and deletes after asking", async () => {
    const calls = api({
      ...base,
      [`GET /documents/${puc.id}`]: () => ok({ ...puc, remindOn: "2026-12-01" }),
      [`DELETE /documents/${puc.id}`]: () => ({ status: 204, data: "" }),
    });
    renderApp(`/documents/${puc.id}`);
    const user = userEvent.setup();

    expect(
      await screen.findByRole("heading", { level: 1, name: "PUC certificate" }),
    ).toBeInTheDocument();
    expect(screen.getByText("HR026-PUC-9921")).toBeInTheDocument();
    expect(screen.getByText("30, 7 and 1 days before expiry")).toBeInTheDocument();
    expect(screen.getByText("Also on 01/12/2026")).toBeInTheDocument();
    expect(screen.getByText("No copy attached yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Renew" })).toHaveAttribute(
      "href",
      `/documents/${puc.id}/edit?renew=1`,
    );

    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    const confirm = within(
      await screen.findByRole("alertdialog", { name: "Delete PUC certificate?" }),
    );
    await user.click(confirm.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(calls.some((call) => call.method === "delete")).toBe(true));
  });
});
