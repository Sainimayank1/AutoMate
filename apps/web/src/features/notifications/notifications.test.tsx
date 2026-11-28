import type { NotificationItem, Reminder } from "@automate/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it } from "vitest";

import { useSessionStore } from "@/stores/session-store";
import { useActiveVehicleStore } from "@/stores/vehicle-store";
import { fail, mockApi, type MockReply, ok, okPage, testUser, testVehicle } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";

const victoris = testVehicle();
const now = new Date().toISOString();
const notification = (overrides: Partial<NotificationItem>): NotificationItem => ({
  id: "0190d4a2-0000-7000-8000-00000000b001",
  category: "MAINTENANCE",
  kind: "maintenance.overdue",
  priority: "HIGH",
  title: "Wheel alignment is overdue",
  body: "Due on 25 Nov 2026",
  href: "/maintenance/schedules/s1",
  vehicle: {
    id: victoris.id,
    name: "Maruti Suzuki Victoris LXI",
    registrationNumber: "HR26EV4821",
  },
  activeAt: now,
  readAt: null,
  snoozedUntil: null,
  createdAt: now,
  ...overrides,
});
const overdue = notification({});
const puc = notification({
  id: "0190d4a2-0000-7000-8000-00000000b002",
  category: "DOCUMENTS",
  kind: "document.expiring",
  priority: "MEDIUM",
  title: "PUC certificate expires on 3 Dec 2026",
  body: "PUC renewal · HR026-PUC-9921",
  href: "/documents/d1",
  readAt: now,
});
const reminder = (overrides: Partial<Reminder>): Reminder => ({
  id: "0190d4a2-0000-7000-8000-00000000c001",
  vehicleId: victoris.id,
  title: "Get the tyres rotated",
  dueDate: "2026-11-30",
  remindDaysBefore: 3,
  repeat: "NONE",
  notes: null,
  doneAt: null,
  state: "DUE",
  daysLeft: 2,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

type Routes = Record<string, (config: InternalAxiosRequestConfig) => MockReply>;
function api(routes: Routes) {
  return mockApi((config) => {
    const key = `${(config.method ?? "get").toUpperCase()} ${config.url}`;
    return routes[key]?.(config) ?? fail(404, "NOT_FOUND", "Not found");
  });
}
const base: Routes = {
  "GET /vehicles": () => okPage([victoris]),
  "GET /notifications/summary": () => ok({ unread: 1, latest: [overdue, puc] }),
  "GET /notifications": () => okPage([overdue, puc]),
};
const body = (config?: InternalAxiosRequestConfig) =>
  typeof config?.data === "string" ? (JSON.parse(config.data) as unknown) : config?.data;

beforeEach(() => {
  useSessionStore.getState().setSession({ user: testUser, accessToken: "t" });
  useActiveVehicleStore.setState({ activeVehicleId: null });
});

describe("notifications inbox", () => {
  it("lists today's notifications, filters by category and acts on them", async () => {
    const calls = api({
      ...base,
      [`PATCH /notifications/${overdue.id}`]: () => ok({ ...overdue, readAt: now }),
      [`DELETE /notifications/${puc.id}`]: () => ok(null, 204),
      "POST /notifications/read-all": () => ok({ updated: 1 }),
    });
    renderApp("/notifications");
    const user = userEvent.setup();

    const today = within(await screen.findByRole("region", { name: "Today" }));
    const card = within(today.getByRole("article", { name: overdue.title }));
    expect(card.getByLabelText("Unread")).toBeInTheDocument();
    expect(card.getByText(/^Maruti Suzuki Victoris LXI · /)).toBeInTheDocument();
    expect(card.getByRole("link", { name: "Open" })).toHaveAttribute("href", overdue.href);
    expect(screen.getByRole("button", { name: "Notifications, 1 unread" })).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Documents" }));
    await waitFor(() =>
      expect(calls.filter((call) => call.url === "/notifications").at(-1)?.params).toMatchObject({
        filter: "all",
        category: "DOCUMENTS",
      }),
    );

    await user.click(screen.getByRole("button", { name: `Actions for ${puc.title}` }));
    await user.click(await screen.findByRole("menuitem", { name: "Dismiss" }));
    await waitFor(() =>
      expect(calls.some((call) => call.method === "delete" && call.url?.endsWith(puc.id))).toBe(
        true,
      ),
    );

    await user.click(screen.getByRole("button", { name: "Mark all as read" }));
    await waitFor(() =>
      expect(calls.some((call) => call.url === "/notifications/read-all")).toBe(true),
    );
  });

  it("says when you're all caught up", async () => {
    api({
      ...base,
      "GET /notifications/summary": () => ok({ unread: 0, latest: [] }),
      "GET /notifications": () => okPage([]),
    });
    renderApp("/notifications");
    expect(await screen.findByText("You're all caught up")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark all as read" })).toBeDisabled();
  });
});

describe("reminders", () => {
  it("lists open reminders, marks one done and edits another", async () => {
    const tyres = reminder({});
    const fastag = reminder({
      id: "0190d4a2-0000-7000-8000-00000000c002",
      title: "Renew FASTag KYC",
      dueDate: "2026-11-25",
      state: "OVERDUE",
      daysLeft: -3,
      vehicleId: null,
    });
    const calls = api({
      ...base,
      "GET /reminders": () => okPage([tyres, fastag]),
      [`POST /reminders/${tyres.id}/done`]: () => ok({ ...tyres, doneAt: now, state: "DONE" }),
      [`PATCH /reminders/${fastag.id}`]: (config) => ok({ ...fastag, ...(body(config) as object) }),
    });
    renderApp("/notifications/reminders");
    const user = userEvent.setup();

    expect(await screen.findByText("Due in 2 days")).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText(/^30\/11\/2026 · 3 days before · /)).toBeInTheDocument();

    const [first] = screen.getAllByRole("button", { name: "Mark done" });
    await user.click(first!);
    await waitFor(() =>
      expect(calls.some((call) => call.url === `/reminders/${tyres.id}/done`)).toBe(true),
    );

    await user.click(screen.getByRole("button", { name: "Actions for Renew FASTag KYC" }));
    await user.click(await screen.findByRole("menuitem", { name: "Edit" }));
    const dialog = within(await screen.findByRole("dialog"));
    const title = dialog.getByLabelText("What to remind you about");
    await user.clear(title);
    await user.type(title, "Renew FASTag KYC with the bank");
    await user.click(dialog.getByRole("button", { name: "Save reminder" }));
    await waitFor(() =>
      expect(body(calls.find((call) => call.method === "patch"))).toMatchObject({
        title: "Renew FASTag KYC with the bank",
        dueDate: "2026-11-25",
        remindDaysBefore: 3,
        vehicleId: null,
      }),
    );
  });

  it("opens the dialog for a vehicle from the dashboard and checks the title", async () => {
    const calls = api({ ...base, "GET /reminders": () => okPage([]) });
    renderApp(`/notifications/reminders?new=1&vehicle=${victoris.id}`);
    const user = userEvent.setup();

    const dialog = within(await screen.findByRole("dialog", { name: "Add reminder" }));
    // The vehicle list arrives after the dialog opens.
    await waitFor(() =>
      expect(dialog.getByRole("combobox", { name: /^Vehicle/ })).toHaveTextContent("HR26EV4821"),
    );
    await user.click(dialog.getByRole("button", { name: "Save reminder" }));
    expect(await dialog.findByText("Enter what to remind you about")).toBeInTheDocument();
    expect(calls.some((call) => call.method === "post")).toBe(false);
  });
});
