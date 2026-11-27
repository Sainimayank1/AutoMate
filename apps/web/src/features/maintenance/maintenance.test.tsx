import type {
  Inspection,
  MaintenanceOverview,
  MaintenanceSchedule,
  ProviderProfile,
  ScheduleDue,
  ScheduleStatus,
  ServiceRecord,
  VehicleComponentDetail,
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
const COMPONENTS = `/vehicles/${victoris.id}/components`;
const INSPECTIONS = `/vehicles/${victoris.id}/inspections`;

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
  component: null,
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

  it(
    "adds a repeating schedule, refusing one without an interval",
    { timeout: 15_000 },
    async () => {
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
      expect(
        await screen.findByRole("button", { name: "Engine oil & filter" }),
      ).toBeInTheDocument();
    },
  );
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
      componentId: null,
      componentName: null,
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

  it(
    "marks a schedule completed by logging a service with a cost breakdown",
    { timeout: 15_000 },
    async () => {
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
    },
  );

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

describe("service history", () => {
  const brakeRepair: ServiceRecord = {
    ...serviced,
    id: "0190d4a2-0000-7000-8000-00000000d002",
    type: "REPAIR",
    title: "Front brakes",
    serviceDate: "2024-11-14",
    odometerKm: 1040,
    totalAmount: "3200.00",
    items: [],
    notes: "Squeal fixed",
  };

  it("shows a timeline grouped by month, filters through the API and switches to a list", async () => {
    const calls = api({
      "GET /vehicles": () => okPage([victoris]),
      [`GET ${RECORDS}`]: (config) => {
        const params = config.params as { group?: string; search?: string };
        if (params.group === "BRAKES" || params.search) return okPage([brakeRepair]);
        return okPage([serviced, brakeRepair]);
      },
      [`GET ${RECORDS}/summary`]: () => ok({ count: 2, totalAmount: "10050.00" }),
      "GET /maintenance-providers": () =>
        okPage([{ id: "p1", name: "Maruti Arena Service, Gurugram" }]),
    });
    renderApp("/maintenance/history");
    const user = userEvent.setup();

    expect(await screen.findByRole("heading", { name: "2026 · May" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "2024 · November" })).toBeInTheDocument();
    expect(screen.getByText("2 records · ₹10,050.00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Front brakes/ })).toHaveAttribute(
      "href",
      `/maintenance/records/${victoris.id}/${brakeRepair.id}`,
    );

    await user.click(screen.getByRole("button", { name: /Filters/ }));
    await user.click(await screen.findByRole("combobox", { name: "Category" }));
    await user.click(await screen.findByRole("option", { name: "Brakes" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() =>
      expect(calls.filter((call) => call.url === RECORDS).at(-1)?.params).toMatchObject({
        group: "BRAKES",
        page: 1,
      }),
    );
    expect(await screen.findByText("Category: Brakes")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole("link", { name: /2nd free periodic service/ }),
      ).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole("radio", { name: "List" }));
    expect(await screen.findByRole("columnheader", { name: "Odometer" })).toBeInTheDocument();
  });

  it("separates a filtered empty result from an empty history", async () => {
    api({
      "GET /vehicles": () => okPage([victoris]),
      [`GET ${RECORDS}`]: () => okPage([]),
      [`GET ${RECORDS}/summary`]: () => ok({ count: 0, totalAmount: "0.00" }),
    });
    renderApp("/maintenance/history?q=turbo");
    expect(await screen.findByText("No records match")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
  });

  it("invites the first record when there is no history", async () => {
    api({
      "GET /vehicles": () => okPage([victoris]),
      [`GET ${RECORDS}`]: () => okPage([]),
      [`GET ${RECORDS}/summary`]: () => ok({ count: 0, totalAmount: "0.00" }),
    });
    renderApp("/maintenance/history");
    expect(await screen.findByText("No service history")).toBeInTheDocument();
  });
});

describe("components", () => {
  const battery: VehicleComponentDetail = {
    id: "0190d4a2-0000-7000-8000-00000000f101",
    vehicleId: victoris.id,
    kind: "BATTERY",
    name: "12V battery",
    position: null,
    brand: "Amaron Pro",
    partNumber: "38B20L",
    installedAt: "2025-02-14",
    installedKm: 1020,
    provider: null,
    expectedLifeKm: 40_000,
    expectedLifeMonths: 48,
    warrantyUntil: "2028-02-14",
    warrantyKm: null,
    warrantyActive: true,
    condition: "GOOD",
    state: "INSTALLED",
    status: "GOOD",
    removedAt: null,
    removedKm: null,
    installRecordId: null,
    replacedBy: null,
    replaces: null,
    life: {
      kmUsed: 18_400,
      kmRemaining: 21_600,
      estimatedKm: 41_020,
      monthsUsed: 21,
      daysRemaining: 810,
      estimatedDate: "2029-02-14",
      fractionUsed: 0.46,
      decidedBy: "DISTANCE",
    },
    schedules: [{ id: oil.id, name: "Battery check", status: "UPCOMING" }],
    notes: null,
    createdAt: "2025-02-14T10:00:00.000Z",
    updatedAt: "2025-02-14T10:00:00.000Z",
    history: [
      {
        source: "EVENT",
        type: "INSTALLED",
        date: "2025-02-14",
        odometerKm: 1020,
        condition: null,
        notes: null,
        recordId: null,
        recordTitle: null,
        inspectionId: null,
        inspectionTitle: null,
        checklistCondition: null,
      },
    ],
  };

  it("shows fitted parts with their status, estimated life and warranty", async () => {
    api({
      "GET /vehicles": () => okPage([victoris]),
      [`GET ${COMPONENTS}`]: (config) =>
        (config.params as { state?: string }).state === "history"
          ? okPage([], { total: 1 })
          : okPage([battery]),
    });
    renderApp("/maintenance/components");
    const card = await screen.findByRole("link", { name: /12V battery/ });
    expect(card).toHaveAttribute("href", `/maintenance/components/${battery.id}`);
    expect(within(card).getByText("Good")).toBeInTheDocument();
    expect(within(card).getByText("Amaron Pro · 38B20L")).toBeInTheDocument();
    expect(
      within(card).getByText("Estimated life: 46% used · about 21,600 km left (estimate)"),
    ).toBeInTheDocument();
    expect(within(card).getByText("Under warranty until 14/02/2028")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Replaced & removed/ })).toHaveTextContent("1");
  });

  it("invites the first component", async () => {
    api({
      "GET /vehicles": () => okPage([victoris]),
      [`GET ${COMPONENTS}`]: () => okPage([]),
    });
    renderApp("/maintenance/components");
    expect(await screen.findByText("No components tracked")).toBeInTheDocument();
  });

  it("shows a part's life and lifecycle, and records an inspection", async () => {
    const calls = api({
      "GET /vehicles": () => okPage([victoris]),
      [`GET ${COMPONENTS}/${battery.id}`]: () => ok(battery),
      [`POST ${COMPONENTS}/${battery.id}/inspect`]: () =>
        ok({ ...battery, condition: "MONITORING" }),
    });
    renderApp(`/maintenance/components/${battery.id}`);
    const user = userEvent.setup();

    expect(await screen.findByRole("heading", { name: "12V battery" })).toBeInTheDocument();
    expect(screen.getByText("18,400 of 40,000 km")).toBeInTheDocument();
    expect(screen.getByText("21 of 48 months")).toBeInTheDocument();
    expect(
      screen.getByText(/Estimates from the lifespan you set; not a guarantee/),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Installed")).toHaveLength(2); // details row + lifecycle entry
    expect(screen.getByRole("link", { name: "Replace" })).toHaveAttribute(
      "href",
      `/maintenance/components/${battery.id}/replace`,
    );

    await user.click(screen.getByRole("button", { name: "Record inspection" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Your own check, not a professional inspection.");
    await user.click(within(dialog).getByRole("combobox", { name: "Condition" }));
    await user.click(await screen.findByRole("option", { name: "Needs monitoring" }));
    await user.click(within(dialog).getByRole("button", { name: "Save inspection" }));
    await waitFor(() => expect(calls.some((call) => call.method === "post")).toBe(true));
    expect(bodyOf(calls.find((call) => call.method === "post"))).toMatchObject({
      condition: "MONITORING",
    });
  });

  it("replaces a part with a cost and opens the new one", async () => {
    const fresh = {
      ...battery,
      id: "0190d4a2-0000-7000-8000-00000000f102",
      condition: "NEW" as const,
    };
    const calls = api({
      "GET /vehicles": () => okPage([victoris]),
      [`GET ${COMPONENTS}/${battery.id}`]: () => ok(battery),
      [`GET ${COMPONENTS}/${fresh.id}`]: () => ok(fresh),
      [`POST ${COMPONENTS}/${battery.id}/replace`]: () => ok(fresh),
      "GET /maintenance-providers": () => okPage([]),
    });
    renderApp(`/maintenance/components/${battery.id}/replace`);
    const user = userEvent.setup();

    expect(await screen.findByText(/The old part is kept in its history/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Expected life/)).toHaveValue("40,000");
    await user.type(screen.getByLabelText(/Brand/), "Exide");
    await user.type(screen.getByLabelText(/^Total/), "5400");
    await user.click(screen.getByRole("button", { name: "Save replacement" }));
    await waitFor(() => expect(calls.some((call) => call.method === "post")).toBe(true));
    const body = bodyOf(calls.find((call) => call.method === "post"));
    expect(body).toMatchObject({ brand: "Exide", totalAmount: "5400", expectedLifeKm: 40_000 });
    expect(body.id).toEqual(expect.any(String));
    expect(await screen.findByRole("heading", { name: "12V battery" })).toBeInTheDocument();
  });
});

describe("inspections", () => {
  const finding = (id: string, overrides: Partial<Inspection["items"][number]>) => ({
    id,
    area: "TYRES" as const,
    label: "Tyre pressure",
    condition: "GOOD" as const,
    notes: null,
    recommendedAction: null,
    componentId: null,
    componentName: null,
    followUpSchedule: null,
    ...overrides,
  });
  const PADS = "0190d4a2-0000-7000-8000-00000000a102";
  const TREAD = "0190d4a2-0000-7000-8000-00000000a103";
  const monthly: Inspection = {
    id: "0190d4a2-0000-7000-8000-00000000a001",
    vehicleId: victoris.id,
    kind: "SELF_CHECK",
    templateKey: "MONTHLY",
    title: "Monthly check",
    date: "2026-11-27",
    odometerKm: 8450,
    inspector: null,
    provider: null,
    followUpDate: "2026-12-15",
    notes: "Book alignment before the highway trip.",
    items: [
      finding("0190d4a2-0000-7000-8000-00000000a101", { notes: "33 PSI" }),
      finding(PADS, {
        area: "BRAKES",
        label: "Front brake pads",
        condition: "REPLACE_SOON",
        notes: "About 3 mm left",
        recommendedAction: "Replace front brake pads",
      }),
      finding(TREAD, {
        label: "Front tyre tread",
        condition: "ATTENTION",
        recommendedAction: "Rotate tyres",
        followUpSchedule: { id: oil.id, name: "Front tyre check", status: "DUE_SOON" },
      }),
    ],
    counts: { issues: 2, monitor: 0, ok: 1, notInspected: 0 },
    createdAt: "2026-11-27T10:00:00.000Z",
    updatedAt: "2026-11-27T10:00:00.000Z",
  };

  it("lists inspections with what they found, and filters by kind on the server", async () => {
    const calls = api({
      "GET /vehicles": () => okPage([victoris]),
      [`GET ${INSPECTIONS}`]: (config) =>
        okPage(config.params?.kind === "PROFESSIONAL" ? [] : [monthly]),
    });
    renderApp("/maintenance/inspections");
    const user = userEvent.setup();

    const row = await screen.findByRole("link", { name: /Monthly check/ });
    expect(within(row).getByText("2 issues")).toBeInTheDocument();
    expect(within(row).getByText("1 good")).toBeInTheDocument();
    expect(within(row).getByText("Follow up by 15/12/2026")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Professional/ }));
    expect(await screen.findByText("No workshop inspections")).toBeInTheDocument();
    expect(
      calls.some((call) => call.params?.kind === "PROFESSIONAL" && call.params?.page === 1),
    ).toBe(true);
  });

  it(
    "records a checklist from a template, asking for an action on flagged items",
    { timeout: 15_000 },
    async () => {
      const calls = api({
        "GET /vehicles": () => okPage([victoris]),
        [`GET ${COMPONENTS}`]: () => okPage([]),
        "GET /maintenance-providers": () => okPage([]),
        [`POST ${INSPECTIONS}`]: () => ok(monthly, 201),
        [`GET ${INSPECTIONS}/${monthly.id}`]: () => ok(monthly),
      });
      renderApp("/maintenance/inspections/new");
      const user = userEvent.setup();

      expect(await screen.findByText("0 of 8 checked")).toBeInTheDocument();
      await user.click(screen.getByRole("combobox", { name: "Condition of Tyre pressure" }));
      await user.click(await screen.findByRole("option", { name: "Good" }));
      await user.click(screen.getByRole("combobox", { name: "Condition of Battery terminals" }));
      await user.click(await screen.findByRole("option", { name: "Replace soon" }));
      await user.type(screen.getByLabelText(/Recommended action/), "Clean the terminals");
      expect(screen.getByText("2 of 8 checked")).toBeInTheDocument();
      expect(screen.getByText("Battery terminals · Replace soon")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Save inspection" }));
      await waitFor(() => expect(calls.some((call) => call.method === "post")).toBe(true));
      const body = bodyOf(calls.find((call) => call.method === "post"));
      expect(body).toMatchObject({
        kind: "SELF_CHECK",
        templateKey: "QUICK",
        title: "Quick walk-around",
        odometerKm: null,
      });
      expect(body.id).toEqual(expect.any(String));
      const items = body.items as Record<string, unknown>[];
      expect(items).toHaveLength(8);
      expect(items[0]).toMatchObject({ area: "TYRES", label: "Tyre pressure", condition: "GOOD" });
      expect(items[7]).toMatchObject({
        area: "BATTERY",
        label: "Battery terminals",
        condition: "REPLACE_SOON",
        recommendedAction: "Clean the terminals",
      });
      expect(await screen.findByRole("heading", { name: "Monthly check" })).toBeInTheDocument();
    },
  );

  it(
    "follows a finding up with a linked schedule, and deletes the inspection",
    { timeout: 15_000 },
    async () => {
      const calls = api({
        "GET /vehicles": () => okPage([victoris]),
        [`GET ${INSPECTIONS}/${monthly.id}`]: () => ok(monthly),
        [`GET ${INSPECTIONS}`]: () => okPage([]),
        [`GET ${COMPONENTS}`]: () => okPage([]),
        [`POST ${SCHEDULES}`]: () => ok(oil, 201),
        [`DELETE ${INSPECTIONS}/${monthly.id}`]: () => ({ status: 204 }),
      });
      renderApp(`/maintenance/inspections/${monthly.id}`);
      const user = userEvent.setup();

      expect(await screen.findByRole("heading", { name: "Monthly check" })).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /Schedule: Front tyre check · due soon/ }),
      ).toHaveAttribute("href", `/maintenance/schedules/${oil.id}`);
      expect(screen.getByRole("link", { name: /Log repair/ })).toHaveAttribute(
        "href",
        `/maintenance/records/new?inspection=${monthly.id}`,
      );

      await user.click(screen.getByRole("link", { name: "Create schedule" }));
      expect(await screen.findByLabelText("Name")).toHaveValue("Replace front brake pads");
      await user.click(screen.getByRole("button", { name: "Save schedule" }));
      await waitFor(() => expect(calls.some((call) => call.method === "post")).toBe(true));
      expect(bodyOf(calls.find((call) => call.method === "post"))).toMatchObject({
        name: "Replace front brake pads",
        categoryKey: "BRAKES.INSPECTION",
        dueDate: "2026-12-15",
        intervalKm: null,
        priority: "HIGH",
        inspectionItemId: PADS,
      });

      expect(await screen.findByRole("heading", { name: "Monthly check" })).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Delete" }));
      const dialog = await screen.findByRole("alertdialog");
      expect(dialog).toHaveTextContent("Schedules created from its findings are kept");
      await user.click(within(dialog).getByRole("button", { name: "Delete" }));
      await waitFor(() => expect(calls.some((call) => call.method === "delete")).toBe(true));
      expect(await screen.findByText("No inspections yet")).toBeInTheDocument();
    },
  );

  it("edits an inspection, keeping its items' ids", { timeout: 15_000 }, async () => {
    const calls = api({
      "GET /vehicles": () => okPage([victoris]),
      [`GET ${INSPECTIONS}/${monthly.id}`]: () => ok(monthly),
      [`GET ${COMPONENTS}`]: () => okPage([]),
      "GET /maintenance-providers": () => okPage([]),
      [`PATCH ${INSPECTIONS}/${monthly.id}`]: () => ok(monthly),
    });
    renderApp(`/maintenance/inspections/${monthly.id}/edit`);
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("combobox", { name: "Condition of Front brake pads" }),
    );
    await user.click(await screen.findByRole("option", { name: "Replaced" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(calls.some((call) => call.method === "patch")).toBe(true));
    const items = bodyOf(calls.find((call) => call.method === "patch")).items as Record<
      string,
      unknown
    >[];
    expect(items.map((item) => item.id)).toEqual([monthly.items[0]!.id, PADS, TREAD]);
    expect(items[1]).toMatchObject({ condition: "REPLACED" });
  });
});

describe("workshops", () => {
  const WORKSHOPS = "/maintenance-providers";
  const arena: ProviderProfile = {
    id: "0190d4a2-0000-7000-8000-00000000b001",
    name: "Maruti Arena Service, Gurugram",
    type: "AUTHORISED",
    phone: "+91 98100 12345",
    email: "service@arenagurugram.in",
    address: "Plot 42, Sector 18, Gurugram",
    city: "Gurugram",
    preferred: true,
    notes: "Ask for Ramesh at the service desk.",
    archivedAt: null,
    stats: { visits: 1, firstVisit: "2026-05-18", lastVisit: "2026-05-18", spent: "6500.00" },
    createdAt: "2026-05-18T10:00:00.000Z",
    updatedAt: "2026-05-18T10:00:00.000Z",
  };
  const quickFix: ProviderProfile = {
    ...arena,
    id: "0190d4a2-0000-7000-8000-00000000b002",
    name: "Quick Fix Garage",
    type: "INDEPENDENT",
    phone: null,
    email: null,
    address: null,
    city: null,
    preferred: false,
    notes: null,
    stats: { visits: 0, firstVisit: null, lastVisit: null, spent: "0.00" },
  };

  it("lists workshops with visits and spending, and adds one", { timeout: 15_000 }, async () => {
    const calls = api({
      "GET /vehicles": () => okPage([victoris]),
      [`GET ${WORKSHOPS}`]: (config) =>
        okPage(
          config.params?.archived ? [] : config.params?.preferred ? [arena] : [arena, quickFix],
        ),
      [`POST ${WORKSHOPS}`]: () => ok(quickFix, 201),
    });
    renderApp("/maintenance/workshops");
    const user = userEvent.setup();

    const card = (await screen.findByRole("link", { name: arena.name })).closest("article")!;
    expect(within(card).getByText("Authorised service centre")).toBeInTheDocument();
    expect(within(card).getByText("Preferred")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: /\+91 98100 12345/ })).toHaveAttribute(
      "href",
      "tel:+919810012345",
    );
    expect(within(card).getByText("₹6,500.00 spent")).toBeInTheDocument();
    expect(screen.getByText("No visits yet")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add workshop" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Name"), "Quick Fix Garage");
    await user.type(within(dialog).getByLabelText(/Phone/), "call me");
    await user.click(within(dialog).getByRole("button", { name: "Save workshop" }));
    expect(await within(dialog).findByText("Enter a phone number")).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText(/Phone/));
    await user.click(within(dialog).getByRole("switch", { name: /Preferred workshop/ }));
    await user.click(within(dialog).getByRole("button", { name: "Save workshop" }));
    await waitFor(() => expect(calls.some((call) => call.method === "post")).toBe(true));
    const body = bodyOf(calls.find((call) => call.method === "post"));
    expect(body).toMatchObject({
      name: "Quick Fix Garage",
      type: "OTHER",
      phone: null,
      preferred: true,
    });
    expect(body.id).toEqual(expect.any(String));
  });

  it("shows a workshop's visits and contact, and archives it", { timeout: 15_000 }, async () => {
    const calls = api({
      "GET /vehicles": () => okPage([victoris]),
      [`GET ${WORKSHOPS}/${arena.id}`]: () => ok(arena),
      [`GET ${WORKSHOPS}/${arena.id}/service-records`]: () => okPage([serviced]),
      [`POST ${WORKSHOPS}/${arena.id}/archive`]: () =>
        ok({ ...arena, archivedAt: "2026-11-27T10:00:00.000Z" }),
    });
    renderApp(`/maintenance/workshops/${arena.id}`);
    const user = userEvent.setup();

    expect(await screen.findByRole("heading", { name: arena.name })).toBeInTheDocument();
    expect(screen.getByText("From Expenses, net of refunds")).toBeInTheDocument();
    const visit = await screen.findByRole("link", { name: /2nd free periodic service/ });
    expect(visit).toHaveAttribute("href", `/maintenance/records/${victoris.id}/${serviced.id}`);
    expect(screen.getByRole("link", { name: "service@arenagurugram.in" })).toHaveAttribute(
      "href",
      "mailto:service@arenagurugram.in",
    );
    expect(screen.getByText(/so it can't be deleted/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument();
    await user.click(await screen.findByRole("menuitem", { name: "Archive" }));
    await waitFor(() =>
      expect(calls.some((call) => call.url === `${WORKSHOPS}/${arena.id}/archive`)).toBe(true),
    );
  });
});
