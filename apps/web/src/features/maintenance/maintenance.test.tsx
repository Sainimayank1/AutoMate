import type {
  MaintenanceOverview,
  MaintenanceSchedule,
  ScheduleDue,
  ScheduleStatus,
  ServiceRecord,
} from "@automate/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it } from "vitest";

import { useSessionStore } from "@/stores/session-store";
import { useActiveVehicleStore } from "@/stores/vehicle-store";
import { fail, mockApi, type MockReply, ok, okPage, testUser, testVehicle } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";

const victoris = testVehicle();
const OVERVIEW = `/vehicles/${victoris.id}/maintenance-overview`;
const SCHEDULES = `/vehicles/${victoris.id}/maintenance-schedules`;
const RECORDS = `/vehicles/${victoris.id}/service-records`;

const distanceDue = (kmRemaining: number, status: ScheduleStatus): ScheduleDue => ({
  status,
  decidedBy: "DISTANCE",
  date: null,
  distance: {
    fromKm: 5120,
    basis: "LAST_DONE",
    nextDueKm: 8450 + kmRemaining,
    kmRemaining,
    status,
  },
});

const schedule = (overrides: Partial<MaintenanceSchedule> = {}): MaintenanceSchedule => ({
  id: "0190d4a2-0000-7000-8000-00000000c001",
  vehicleId: victoris.id,
  name: "Engine oil & filter",
  categoryKey: "ENGINE.ENGINE_OIL",
  intervalKm: 10_000,
  intervalMonths: null,
  dueDate: null,
  dueKm: null,
  lastDoneDate: "2026-05-18",
  lastDoneKm: 5120,
  addedOdometerKm: 8450,
  remindersEnabled: true,
  leadDays: null,
  leadKm: null,
  priority: "NORMAL",
  notes: null,
  pausedAt: null,
  createdAt: "2026-11-27T05:00:00.000Z",
  updatedAt: "2026-11-27T05:00:00.000Z",
  due: distanceDue(6670, "UP_TO_DATE"),
  ...overrides,
});

const oil = schedule({ due: distanceDue(850, "DUE_SOON") });
const brakes = schedule({
  id: "0190d4a2-0000-7000-8000-00000000c002",
  name: "Brake inspection",
  categoryKey: "BRAKES.INSPECTION",
  intervalKm: null,
  lastDoneDate: null,
  lastDoneKm: null,
  dueKm: 7250,
  priority: "HIGH",
  due: {
    ...distanceDue(-1200, "OVERDUE"),
    distance: {
      fromKm: null,
      basis: "FIXED",
      nextDueKm: 7250,
      kmRemaining: -1200,
      status: "OVERDUE",
    },
  },
});

const counts = (overrides: Partial<Record<ScheduleStatus, number>> = {}) => ({
  OVERDUE: 0,
  DUE: 0,
  DUE_SOON: 0,
  UPCOMING: 0,
  UP_TO_DATE: 0,
  PAUSED: 0,
  COMPLETED: 0,
  NOT_CONFIGURED: 0,
  ...overrides,
});

const overview = (overrides: Partial<MaintenanceOverview> = {}): MaintenanceOverview => ({
  odometerKm: 8450,
  period: {
    period: "last_12_months",
    from: "2025-11-28",
    to: "2026-11-27",
    previous: { from: "2024-11-28", to: "2025-11-27" },
    endsToday: true,
  },
  state: "OVERDUE",
  counts: counts({ OVERDUE: 1, DUE_SOON: 1 }),
  overdue: [brakes],
  upcoming: [oil],
  next: oil,
  recordCount: 0,
  recent: [],
  spend: {
    total: "14250.00",
    maintenance: "13050.00",
    repairs: "1200.00",
    previousTotal: "6850.00",
    months: [
      { month: "2026-10", maintenance: "6850.00", repairs: "0.00" },
      { month: "2026-11", maintenance: "6200.00", repairs: "1200.00" },
    ],
  },
  ...overrides,
});

type Routes = Record<string, (config: InternalAxiosRequestConfig) => MockReply>;
function api(routes: Routes) {
  return mockApi((config) => {
    const key = `${(config.method ?? "get").toUpperCase()} ${config.url}`;
    return routes[key]?.(config) ?? fail(404, "NOT_FOUND", "Not found");
  });
}
const bodyOf = (config: InternalAxiosRequestConfig | undefined) =>
  JSON.parse(String(config?.data)) as Record<string, unknown>;

beforeEach(() => {
  useSessionStore.getState().setSession({ user: testUser, accessToken: "t" });
  useActiveVehicleStore.setState({ activeVehicleId: null });
});

describe("maintenance overview", () => {
  it("asks for a vehicle first", async () => {
    api({ "GET /vehicles": () => okPage([]) });
    renderApp("/maintenance");
    expect(await screen.findByText("Add a vehicle first")).toBeInTheDocument();
  });

  it("shows the overdue state, due items and spending from the API, with no health score", async () => {
    api({ "GET /vehicles": () => okPage([victoris]), [`GET ${OVERVIEW}`]: () => ok(overview()) });
    renderApp("/maintenance");

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Overdue maintenance · 1 item overdue",
    );
    expect(screen.getByText("₹14,250.00")).toBeInTheDocument();
    expect(screen.getByText(/₹6,850\.00 the 12 months before/)).toBeInTheDocument();
    const overdue = document.getElementById("overdue")!;
    expect(within(overdue).getByText("Brake inspection")).toBeInTheDocument();
    expect(within(overdue).getByText("1,200 km overdue")).toBeInTheDocument();
    expect(screen.getAllByText("Engine oil & filter").length).toBeGreaterThan(0);
    expect(screen.getByText("Due soon")).toBeInTheDocument();
    expect(screen.getByText(/Due at 9,300 km · 850 km left/)).toBeInTheDocument();
    expect(screen.queryByText(/health/i)).not.toBeInTheDocument();
  });

  it("says data is incomplete and invites a first schedule", async () => {
    api({
      "GET /vehicles": () => okPage([victoris]),
      [`GET ${OVERVIEW}`]: () =>
        ok(
          overview({
            state: "INCOMPLETE",
            counts: counts(),
            overdue: [],
            upcoming: [],
            next: null,
          }),
        ),
    });
    renderApp("/maintenance");
    expect(await screen.findByRole("status")).toHaveTextContent("Maintenance data incomplete");
    expect(screen.getByText("No maintenance schedules")).toBeInTheDocument();
  });

  it("shows an error with retry when the overview fails", async () => {
    api({
      "GET /vehicles": () => okPage([victoris]),
      [`GET ${OVERVIEW}`]: () => fail(403, "FORBIDDEN", "Not allowed"),
    });
    renderApp("/maintenance");
    expect(await screen.findByText("Couldn't load maintenance")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("maintenance schedules", () => {
  it("lists schedules, filters by status on the server and opens the details", async () => {
    const calls = api({
      "GET /vehicles": () => okPage([victoris]),
      [`GET ${OVERVIEW}`]: () => ok(overview()),
      [`GET ${SCHEDULES}`]: (config) => {
        const status = (config.params as { status?: string }).status;
        return okPage([brakes, oil].filter((item) => !status || item.due.status === status));
      },
    });
    renderApp("/maintenance/schedules");
    const user = userEvent.setup();

    expect(await screen.findByRole("button", { name: "Brake inspection" })).toBeInTheDocument();
    expect(screen.getByText("Every 10,000 km")).toBeInTheDocument();
    expect(screen.getByText("Last done 18/05/2026 · 5,120 km")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Overdue/ }));
    await waitFor(() =>
      expect(calls.filter((call) => call.url === SCHEDULES).at(-1)?.params).toMatchObject({
        status: "OVERDUE",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Engine oil & filter" })).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Brake inspection" }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText("Once at 7,250 km")).toBeInTheDocument();
    expect(within(sheet).getByText(/1,200 km overdue/)).toBeInTheDocument();
  });

  it("invites the first schedule when there are none", async () => {
    api({
      "GET /vehicles": () => okPage([victoris]),
      [`GET ${OVERVIEW}`]: () => ok(overview({ counts: counts() })),
      [`GET ${SCHEDULES}`]: () => okPage([]),
    });
    renderApp("/maintenance/schedules");
    expect(await screen.findByText("No maintenance schedules")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create schedule" })).toHaveAttribute(
      "href",
      "/maintenance/schedules/new",
    );
  });

  it("adds a repeating schedule, refusing one without an interval", { timeout: 15_000 }, async () => {
    const calls = api({
      "GET /vehicles": () => okPage([victoris]),
      [`GET ${OVERVIEW}`]: () => ok(overview()),
      [`GET ${SCHEDULES}`]: () => okPage([oil]),
      [`POST ${SCHEDULES}`]: () => ok(oil, 201),
    });
    renderApp("/maintenance/schedules/new");
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Name"), "Engine oil & filter");
    await user.click(screen.getByRole("combobox", { name: "What it's for" }));
    await user.click(await screen.findByRole("option", { name: "Engine oil" }));
    await user.click(screen.getByRole("button", { name: "Save schedule" }));
    expect(await screen.findByText("Set an interval in km or months")).toBeInTheDocument();
    expect(calls.some((call) => call.method === "post")).toBe(false);

    await user.type(screen.getByLabelText("Every"), "10000");
    await user.click(screen.getByRole("button", { name: "Save schedule" }));
    await waitFor(() => expect(calls.some((call) => call.method === "post")).toBe(true));
    const body = bodyOf(calls.find((call) => call.method === "post"));
    expect(body).toMatchObject({
      name: "Engine oil & filter",
      categoryKey: "ENGINE.ENGINE_OIL",
      intervalKm: 10_000,
      intervalMonths: null,
      dueDate: null,
      dueKm: null,
      priority: "NORMAL",
      remindersEnabled: true,
    });
    expect(body.id).toEqual(expect.any(String));
    expect(await screen.findByRole("button", { name: "Engine oil & filter" })).toBeInTheDocument();
  });
});

const serviced: ServiceRecord = {
  id: "0190d4a2-0000-7000-8000-00000000d001",
  vehicleId: victoris.id,
  type: "ROUTINE_SERVICE",
  title: "2nd free periodic service",
  categoryKey: "GENERAL.PERIODIC_SERVICE",
  serviceDate: "2026-05-18",
  odometerKm: 5120,
  provider: { id: "p1", name: "Maruti Arena Service, Gurugram" },
  technician: null,
  description: null,
  labourAmount: "1200.00",
  partsAmount: "4800.00",
  otherAmount: null,
  taxAmount: "1350.00",
  discountAmount: "500.00",
  totalAmount: "6850.00",
  paymentMethod: "UPI",
  warrantyUntil: null,
  warrantyNotes: null,
  notes: null,
  items: [
    {
      id: "i1",
      name: "Engine oil 0W-20",
      partNumber: null,
      scheduleId: oil.id,
      scheduleName: oil.name,
    },
  ],
  expenseId: "0190d4a2-0000-7000-8000-00000000e001",
  createdAt: "2026-05-18T10:00:00.000Z",
  updatedAt: "2026-05-18T10:00:00.000Z",
};

describe("service records", () => {
  it("lists recent records on the overview", async () => {
    api({
      "GET /vehicles": () => okPage([victoris]),
      [`GET ${OVERVIEW}`]: () => ok(overview({ recordCount: 1, recent: [serviced] })),
    });
    renderApp("/maintenance");
    const link = await screen.findByRole("link", { name: /2nd free periodic service/ });
    expect(link).toHaveAttribute("href", `/maintenance/records/${victoris.id}/${serviced.id}`);
    expect(within(link).getByText("₹6,850.00")).toBeInTheDocument();
    expect(screen.getByText("Last service 18/05/2026")).toBeInTheDocument();
  });

  it("marks a schedule completed by logging a service with a cost breakdown", { timeout: 15_000 }, async () => {
    const calls = api({
      "GET /vehicles": () => okPage([victoris]),
      [`GET ${SCHEDULES}`]: () => okPage([oil]),
      "GET /maintenance-providers": () =>
        okPage([{ id: "p1", name: "Maruti Arena Service, Gurugram" }]),
      [`POST ${RECORDS}`]: () => ok(serviced, 201),
      [`GET ${SCHEDULES}/${oil.id}`]: () => ok(oil),
      [`GET ${OVERVIEW}`]: () => ok(overview()),
    });
    renderApp(`/maintenance/records/new?schedule=${oil.id}`);
    const user = userEvent.setup();

    expect(await screen.findByText("Completing Engine oil & filter")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Engine oil & filter");
    await user.type(screen.getByLabelText("Odometer"), "8450");
    await user.type(screen.getByLabelText("Labour"), "1200");
    await user.type(screen.getByLabelText("Parts"), "4800");
    await user.type(screen.getByLabelText("Discount"), "500");
    expect(screen.getAllByText("₹5,500.00").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Save record" }));

    await waitFor(() => expect(calls.some((call) => call.method === "post")).toBe(true));
    const body = bodyOf(calls.find((call) => call.method === "post"));
    expect(body).toMatchObject({
      type: "ROUTINE_SERVICE",
      title: "Engine oil & filter",
      categoryKey: "ENGINE.ENGINE_OIL",
      odometerKm: 8450,
      labourAmount: "1200",
      partsAmount: "4800",
      discountAmount: "500",
      totalAmount: null,
      items: [{ name: "Engine oil & filter", scheduleId: oil.id }],
    });
    expect(body.id).toEqual(expect.any(String));
  });

  it("shows a record's breakdown, completions and linked expense, and deletes it", async () => {
    const calls = api({
      "GET /vehicles": () => okPage([victoris]),
      [`GET ${RECORDS}/${serviced.id}`]: () => ok(serviced),
      [`DELETE ${RECORDS}/${serviced.id}`]: () => ({ status: 204 }),
      [`GET ${OVERVIEW}`]: () => ok(overview()),
    });
    renderApp(`/maintenance/records/${victoris.id}/${serviced.id}`);
    const user = userEvent.setup();

    expect(
      await screen.findByRole("heading", { name: "2nd free periodic service" }),
    ).toBeInTheDocument();
    expect(screen.getByText("−₹500.00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Completed: Engine oil & filter/ })).toHaveAttribute(
      "href",
      `/maintenance/schedules/${oil.id}`,
    );
    expect(screen.getByRole("link", { name: /View expense/ })).toHaveAttribute(
      "href",
      `/expenses/transactions/${serviced.expenseId}`,
    );

    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Its expense of ₹6,850.00 is deleted too");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(calls.some((call) => call.method === "delete")).toBe(true));
  });
});
