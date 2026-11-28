import {
  customWindow,
  type DashboardInsights,
  type DashboardLayout,
  type DashboardMaintenance,
  type DashboardMetrics,
  type DashboardOverview,
  DEFAULT_DASHBOARD_LAYOUT,
  type DrivingOverview,
  type ExpiryItem,
  type FuelOverview,
  type MaintenanceSchedule,
  type ServiceRecord,
  type SpendingOverview,
  type Vehicle,
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
const ID_FUEL = "0190d4a2-0000-7000-8000-0000000c0001";
const creta = testVehicle({
  id: "0190d4a2-0000-7000-8000-00000000a002",
  make: "Hyundai",
  model: "Creta",
  registrationNumber: "DL8CAB5678",
});

const metrics: DashboardMetrics = {
  spent: {
    value: "11840.00",
    previous: "12590.00",
    change: "-750.00",
    changePercent: -6,
    records: 9,
  },
  runningCostPerKm: { value: "10.38", previous: "10.80", change: "-0.42", changePercent: -4 },
  mileage: {
    value: "16.80",
    previous: "16.20",
    change: "0.60",
    changePercent: 4,
    unit: "km/L",
    cycles: 2,
  },
  distance: { value: "1140", previous: "1018", change: "122", changePercent: 12, readings: 4 },
  fuelSpend: {
    value: "7120.00",
    previous: "6593.00",
    change: "527.00",
    changePercent: 8,
    quantity: "68.25",
    unit: "L",
  },
  nextEmi: {
    loanId: "0190d4a2-0000-7000-8000-0000000e0300",
    date: "2026-11-05",
    amount: "16607.00",
    state: "OVERDUE",
    number: 20,
    of: 60,
  },
};

const zeroGroups = {
  fuel: "0.00",
  maintenance: "0.00",
  insurance: "0.00",
  loan: "0.00",
  other: "0.00",
};
const spending: SpendingOverview = {
  total: "11840.00",
  categories: [
    {
      category: { id: ID_FUEL, key: "FUEL", name: "Fuel", icon: "fuel", costClass: "OPERATING" },
      amount: "7120.00",
      percent: 60.1,
    },
  ],
  months: ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"].map((month) => ({
    month,
    total: month === "2026-11" ? "11840.00" : "0.00",
    groups: month === "2026-11" ? { ...zeroGroups, fuel: "7120.00", other: "4720.00" } : zeroGroups,
  })),
};
const fuel: FuelOverview = {
  fuelType: "PETROL",
  unit: "L",
  mileageUnit: "km/L",
  averageMileage: "16.80",
  cycles: 2,
  latestMileage: { date: "2026-11-24T08:30:00.000Z", mileage: "17.20" },
  quantity: "68.25",
  spend: "7120.00",
  averagePrice: "104.32",
  costPerKm: "6.10",
  trend: [
    { date: "2026-11-09T08:30:00.000Z", mileage: "16.40" },
    { date: "2026-11-24T08:30:00.000Z", mileage: "17.20" },
  ],
};

const brakes = {
  id: "0190d4a2-0000-7000-8000-00000000c002",
  vehicleId: victoris.id,
  name: "Brake inspection",
  categoryKey: "BRAKES.INSPECTION",
  intervalKm: null,
  intervalMonths: null,
  dueDate: null,
  dueKm: 7250,
  lastDoneDate: null,
  lastDoneKm: null,
  addedOdometerKm: 8450,
  remindersEnabled: true,
  leadDays: null,
  leadKm: null,
  priority: "HIGH",
  notes: null,
  pausedAt: null,
  createdAt: "2026-11-27T05:00:00.000Z",
  updatedAt: "2026-11-27T05:00:00.000Z",
  due: {
    status: "OVERDUE",
    decidedBy: "DISTANCE",
    date: null,
    distance: {
      fromKm: null,
      basis: "FIXED",
      nextDueKm: 7250,
      kmRemaining: -1200,
      status: "OVERDUE",
    },
  },
} as MaintenanceSchedule;
const maintenance: DashboardMaintenance = {
  state: "OVERDUE",
  overdue: 1,
  dueSoon: 2,
  schedules: [brakes],
  lastService: {
    id: "0190d4a2-0000-7000-8000-00000000d001",
    title: "Periodic service",
    serviceDate: "2026-08-20",
    odometerKm: 5240,
  } as ServiceRecord,
};
const expiries: ExpiryItem[] = [
  {
    id: "insurance",
    label: "Insurance",
    state: "expiring",
    summary: "Expires in 24 days",
    detail: "From your insurance payment of 18 Aug 2026",
    href: "/expenses/transactions/0190d4a2-0000-7000-8000-0000000e0001",
  },
];
const driving: DrivingOverview = {
  distanceKm: 1092,
  readings: 4,
  perDay: "40.4",
  lastReading: { km: 8412, date: "2026-11-24" },
  trips: null,
};

const insights: DashboardInsights = {
  items: [
    {
      id: "fuel_cost_per_km",
      topic: "fuel",
      tone: "negative",
      title: "Fuel costs 16% more per km",
      explanation:
        "₹6.95 a km against ₹6.00, over full-tank cycles. Mileage 15.2 against 17.0 km/L.",
      metric: { label: "Fuel cost / km", value: "₹6.95", previous: "₹6.00" },
      comparedWith: null,
      confidence: "medium",
      action: { label: "View fuel", href: "/fuel" },
    },
    {
      id: "spending_change",
      topic: "spending",
      tone: "positive",
      title: "Spending is down 12%",
      explanation:
        "₹10,718.21 so far against ₹12,180.00. Insurance & legal fell the most: −₹1,500.00.",
      metric: { label: "Spent", value: "₹10,718.21", previous: "₹12,180.00" },
      comparedWith: { from: "2026-10-01", to: "2026-10-27" },
      confidence: null,
      action: {
        label: "View transactions",
        href: "/expenses/transactions?vehicle=v&from=2026-11-01&to=2026-11-27",
      },
    },
  ],
  needs: ["odometer"],
};

const overview = (
  vehicle: Vehicle = victoris,
  overrides: Partial<DashboardOverview> = {},
): DashboardOverview => ({
  vehicle,
  period: {
    period: "this_month",
    from: "2026-11-01",
    to: "2026-11-27",
    previous: { from: "2026-10-01", to: "2026-10-27" },
    endsToday: true,
  },
  status: {
    state: "ok",
    data: {
      level: "attention",
      items: [
        {
          id: "insurance",
          severity: "warning",
          title: "Insurance expires in 24 days",
          detail: "From your insurance payment of 18 Aug 2026",
          href: "/expenses/transactions/0190d4a2-0000-7000-8000-0000000e0001",
          source: "insurance",
          state: "due_soon",
          action: { label: "Add renewal", href: "/expenses/new" },
        },
        {
          id: "warranty",
          severity: "info",
          title: "Warranty valid until 14 Mar 2028 or 1,00,000 km",
          detail: null,
          href: `/garage/${vehicle.id}`,
          source: "warranty",
          state: "info",
          action: null,
        },
      ],
      untracked: ["maintenance", "documents"],
    },
  },
  metrics: { state: "ok", data: metrics },
  spending: { state: "ok", data: spending },
  fuel: { state: "ok", data: fuel },
  maintenance: { state: "ok", data: maintenance },
  expiries: { state: "ok", data: expiries },
  driving: { state: "ok", data: driving },
  insights: { state: "ok", data: insights },
  ...overrides,
});

type Routes = Record<
  string,
  (config: InternalAxiosRequestConfig) => MockReply | Promise<MockReply>
>;
function api(routes: Routes) {
  return mockApi((config) => {
    const key = `${(config.method ?? "get").toUpperCase()} ${config.url}`;
    const archived = (config.params as { archived?: boolean } | undefined)?.archived;
    const route =
      routes[archived ? `${key}?archived` : key] ??
      // The activity feed and the layout are their own requests: empty and the default unless a
      // test says otherwise.
      (key === "GET /dashboard/activity"
        ? () => okPage([])
        : key === "GET /dashboard/layout"
          ? () => ok(DEFAULT_DASHBOARD_LAYOUT)
          : undefined);
    return route?.(config) ?? fail(404, "NOT_FOUND", "Not found");
  });
}
const paramsOf = (config: InternalAxiosRequestConfig | undefined) =>
  (config?.params ?? {}) as Record<string, unknown>;
const overviewCalls = (calls: InternalAxiosRequestConfig[]) =>
  calls.filter((call) => call.url === "/dashboard/overview");

beforeEach(() => {
  useSessionStore.getState().setSession({ user: testUser, accessToken: "t" });
  useActiveVehicleStore.setState({ activeVehicleId: null });
});

describe("dashboard", () => {
  it("invites the first vehicle", async () => {
    api({ "GET /vehicles": () => okPage([]) });
    renderApp("/dashboard");
    expect(
      await screen.findByRole("heading", { name: "Add your first vehicle" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/, Arjun$/);
    expect(screen.getByRole("link", { name: "Add vehicle" })).toHaveAttribute(
      "href",
      "/garage/new",
    );
  });

  it("asks for the active vehicle and period, keeps the period in the URL, and refreshes", async () => {
    const calls = api({
      "GET /vehicles": () => okPage([victoris, creta]),
      "GET /dashboard/overview": (config) =>
        ok(overview(paramsOf(config).vehicleId === creta.id ? creta : victoris)),
    });
    const router = renderApp("/dashboard");
    const user = userEvent.setup();

    await waitFor(() =>
      expect(paramsOf(overviewCalls(calls)[0])).toMatchObject({
        vehicleId: victoris.id,
        period: "this_month",
      }),
    );

    await user.click(screen.getByRole("combobox", { name: "Period" }));
    await user.click(await screen.findByRole("option", { name: "Last month" }));
    await waitFor(() =>
      expect(paramsOf(overviewCalls(calls).at(-1))).toMatchObject({ period: "last_month" }),
    );
    expect(router.state.location.search).toBe("?period=last_month");

    // A custom range starts from the window on screen, so it always has both dates.
    await user.click(screen.getByRole("combobox", { name: "Period" }));
    await user.click(await screen.findByRole("option", { name: "Custom range" }));
    await waitFor(() =>
      expect(paramsOf(overviewCalls(calls).at(-1))).toMatchObject({
        period: "custom",
        from: "2026-11-01",
        to: "2026-11-27",
      }),
    );

    // The vehicle is the app's active vehicle (shared with the sidebar).
    await user.click(screen.getByRole("combobox", { name: "Vehicle" }));
    await user.click(await screen.findByRole("option", { name: /Hyundai Creta/ }));
    await waitFor(() =>
      expect(paramsOf(overviewCalls(calls).at(-1))).toMatchObject({ vehicleId: creta.id }),
    );
    expect(useActiveVehicleStore.getState().activeVehicleId).toBe(creta.id);

    const before = overviewCalls(calls).length;
    await user.click(screen.getByRole("button", { name: "Refresh dashboard" }));
    await waitFor(() => expect(overviewCalls(calls).length).toBe(before + 1));
  });

  it("never asks for an unusable custom range", async () => {
    const calls = api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /dashboard/overview": () => ok(overview()),
    });
    // No dates: this month's are filled in (nothing waits forever for them).
    renderApp("/dashboard?period=custom");
    const month = customWindow(undefined, undefined, new Date());
    await waitFor(() =>
      expect(paramsOf(overviewCalls(calls)[0])).toMatchObject({ period: "custom", ...month }),
    );
    expect(screen.getByLabelText("Start date")).toBeInTheDocument();
    expect(screen.getByLabelText("End date")).toBeInTheDocument();
  });

  it("turns a backwards range round", async () => {
    const calls = api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /dashboard/overview": () => ok(overview()),
    });
    renderApp("/dashboard?period=custom&from=2026-10-10&to=2026-10-01");
    await waitFor(() =>
      expect(paramsOf(overviewCalls(calls)[0])).toMatchObject({
        from: "2026-10-01",
        to: "2026-10-10",
      }),
    );
  });

  it("refreshes the garage when the vehicle is gone", async () => {
    const calls = api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /dashboard/overview": () => fail(404, "NOT_FOUND", "Vehicle not found"),
    });
    renderApp("/dashboard");
    await waitFor(() =>
      expect(calls.filter((call) => call.url === "/vehicles").length).toBeGreaterThan(1),
    );
  });

  it("shows the vehicle, its status and the period's figures, each linking to its source", async () => {
    api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /dashboard/overview": () => ok(overview()),
    });
    renderApp("/dashboard");
    const user = userEvent.setup();

    const hero = await screen.findByRole("region", { name: "Active vehicle" });
    expect(
      within(hero).getByRole("heading", { name: /Maruti Suzuki Victoris/ }),
    ).toBeInTheDocument();
    // Quick actions: each opens its form or the vehicle.
    for (const [name, href] of [
      ["Add fuel", "/fuel/new"],
      ["Add expense", "/expenses/new"],
      ["Add service record", "/maintenance/records/new"],
      ["Update odometer", `/garage/${victoris.id}/edit`],
      ["View in Garage", `/garage/${victoris.id}`],
    ]) {
      expect(within(hero).getByRole("link", { name })).toHaveAttribute("href", href);
    }

    const status = screen.getByRole("region", { name: "Attention required" });
    expect(
      within(status).getByText(/Maintenance and documents aren't tracked yet/),
    ).toBeInTheDocument();
    expect(
      within(status).getByRole("link", { name: /Insurance expires in 24 days/ }),
    ).toHaveAttribute("href", "/expenses/transactions/0190d4a2-0000-7000-8000-0000000e0001");

    const figures = screen.getByRole("region", { name: "Key figures" });
    expect(within(figures).getByText("₹11,840.00")).toBeInTheDocument();
    // Cost down is good, mileage up is good: like-for-like windows.
    expect(within(figures).getByText("−6% vs 1–27 Oct")).toHaveClass("text-success");
    expect(within(figures).getByText(/^\+0\.6 km\/L vs 1–27 Oct/)).toHaveClass("text-success");
    expect(within(figures).getByText(/^\+8% vs 1–27 Oct/)).toHaveClass("text-warning");
    expect(within(figures).getByRole("link", { name: "Average mileage" })).toHaveAttribute(
      "href",
      "/fuel",
    );
    // The next EMI, whatever the period, opening its loan.
    expect(within(figures).getByText("Overdue since 05/11/2026 · EMI 20 of 60")).toHaveClass(
      "text-destructive",
    );
    expect(within(figures).getByRole("link", { name: "Next EMI" })).toHaveAttribute(
      "href",
      "/expenses/loans/0190d4a2-0000-7000-8000-0000000e0300",
    );
    await user.click(within(figures).getByRole("button", { name: "How spent is worked out" }));
    expect(await screen.findByText(/Loan principal isn't counted/)).toBeInTheDocument();
  });

  it("shows where the money went and the period's fuel, each opening its records", async () => {
    api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /dashboard/overview": () => ok(overview()),
    });
    renderApp("/dashboard");

    expect(await screen.findByText("Monthly spending")).toBeInTheDocument();
    expect(
      screen.getByText(/₹11,840\.00 in 1–27 Nov · loan principal not included/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /^Spending per month from June 2026 to November 2026/ }),
    ).toBeInTheDocument();
    // A category opens its transactions for this vehicle and period.
    const fuelRow = screen.getByRole("link", { name: /^Fuel.*₹7,120\.00.*60%/ });
    expect(fuelRow).toHaveAttribute(
      "href",
      `/expenses/transactions?vehicle=${victoris.id}&category=${ID_FUEL}&from=2026-11-01&to=2026-11-27`,
    );

    expect(screen.getByText("₹104.32/L")).toBeInTheDocument();
    expect(screen.getByText("17.2 km/L")).toBeInTheDocument();
    expect(screen.getByText("2 full-tank cycles")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View fuel history" })).toHaveAttribute(
      "href",
      "/fuel",
    );
  });

  it("shows maintenance, expiry dates and driving, each opening its source", async () => {
    api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /dashboard/overview": () => ok(overview()),
    });
    renderApp("/dashboard");

    expect(await screen.findByText("1 overdue")).toHaveClass("text-destructive");
    expect(screen.getByText("2 due soon")).toHaveClass("text-warning");
    expect(screen.getByRole("link", { name: /Brake inspection/ })).toHaveAttribute(
      "href",
      `/maintenance/schedules/${brakes.id}`,
    );
    expect(screen.getByRole("link", { name: "Periodic service" })).toHaveAttribute(
      "href",
      `/maintenance/records/${victoris.id}/0190d4a2-0000-7000-8000-00000000d001`,
    );
    // The hero's quick action and the maintenance card's link: the same form.
    for (const link of screen.getAllByRole("link", { name: "Add service record" })) {
      expect(link).toHaveAttribute("href", "/maintenance/records/new");
    }

    expect(
      screen.getByRole("link", { name: /Insurance.*Expiring.*Expires in 24 days/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("PUC, registration and licence arrive with Documents."),
    ).toBeInTheDocument();

    expect(screen.getByText("~40.4 km")).toBeInTheDocument();
    expect(screen.getByText(/^8,412 km on 24 Nov/)).toBeInTheDocument();
    expect(screen.getByText("No trips logged yet")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Log trip" })[0]).toHaveAttribute(
      "href",
      `/trips/new?vehicle=${victoris.id}`,
    );
  });

  it("shows the next planned trip on the Driving card", async () => {
    const plan = {
      id: "0190d4a2-0000-7000-8000-0000000e0003",
      label: "Manali road trip",
      date: "2099-12-14",
      endDate: "2099-12-17",
      plannedDistanceKm: "540.0",
      budget: "9975.02",
    };
    api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /dashboard/overview": () =>
        ok(
          overview(victoris, {
            driving: {
              state: "ok",
              data: {
                ...driving,
                trips: {
                  count: 0,
                  distanceKm: "0.0",
                  averageKm: null,
                  longestKm: null,
                  byCategory: [],
                  nextPlan: plan,
                },
              },
            },
          }),
        ),
    });
    renderApp("/dashboard");

    expect(await screen.findByRole("link", { name: "Manali road trip" })).toHaveAttribute(
      "href",
      `/trips/planner/${plan.id}`,
    );
    expect(screen.getByText(/540 km planned · ₹9,975.02 estimated/)).toBeInTheDocument();
    expect(screen.getByText("No trips this period")).toBeInTheDocument();
  });

  it("invites a first maintenance schedule", async () => {
    api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /dashboard/overview": () => ok(overview(victoris, { maintenance: { state: "empty" } })),
    });
    renderApp("/dashboard");
    expect(await screen.findByRole("link", { name: "Add a schedule" })).toHaveAttribute(
      "href",
      "/maintenance/schedules/new",
    );
  });

  it("is the action centre: each item has its state, source and action", async () => {
    api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /dashboard/overview": () => ok(overview()),
    });
    renderApp("/dashboard");

    const status = await screen.findByRole("region", { name: "Attention required" });
    expect(within(status).getByText("Up next")).toBeInTheDocument();
    expect(within(status).getByText("Due soon")).toBeInTheDocument();
    expect(within(status).getAllByText("Insurance").length).toBeGreaterThan(0);
    expect(within(status).getByRole("link", { name: "Add renewal" })).toHaveAttribute(
      "href",
      "/expenses/new",
    );
    // An informational item has nothing to do: no action button.
    expect(within(status).getAllByRole("link", { name: /Add renewal|Log service/ })).toHaveLength(
      1,
    );
    // The hero's quick action and the maintenance card's link: the same form.
    for (const link of screen.getAllByRole("link", { name: "Add service record" })) {
      expect(link).toHaveAttribute("href", "/maintenance/records/new");
    }
  });

  it("lists recent activity a page at a time, each row opening its record", async () => {
    const calls = api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /dashboard/overview": () => ok(overview()),
      "GET /dashboard/activity": (config) =>
        paramsOf(config).page === 2
          ? okPage(
              [
                {
                  id: "service:s1",
                  kind: "service",
                  date: "2026-08-20",
                  title: "Periodic service",
                  detail: "Maruti Arena Service, Gurugram",
                  amount: "2650.00",
                  odometerKm: 5240,
                  href: `/maintenance/records/${victoris.id}/s1`,
                },
              ],
              { page: 2, pageSize: 8, total: 9, totalPages: 2 },
            )
          : okPage(
              [
                {
                  id: "expense:f1",
                  kind: "fuel",
                  date: "2026-11-24",
                  title: "IndianOil XP95",
                  detail: "32.4 L at ₹104.32/L",
                  amount: "3380.00",
                  odometerKm: 8412,
                  href: `/fuel/${victoris.id}/f1/edit`,
                },
                {
                  id: "expense:r1",
                  kind: "refund",
                  date: "2026-11-22",
                  title: "Refund · FASTag",
                  detail: "Daily usage · Toll",
                  amount: "140.00",
                  odometerKm: null,
                  href: "/expenses/transactions/t1",
                },
              ],
              { page: 1, pageSize: 8, total: 9, totalPages: 2 },
            ),
    });
    renderApp("/dashboard");
    const user = userEvent.setup();

    const table = await screen.findByRole("table");
    expect(within(table).getByRole("link", { name: /IndianOil XP95/ })).toHaveAttribute(
      "href",
      `/fuel/${victoris.id}/f1/edit`,
    );
    expect(within(table).getByText("−₹140.00")).toBeInTheDocument();
    expect(paramsOf(calls.find((call) => call.url === "/dashboard/activity"))).toMatchObject({
      vehicleId: victoris.id,
      page: 1,
      pageSize: 8,
    });
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(
      await within(table).findByRole("link", { name: /Periodic service/ }),
    ).toBeInTheDocument();
  });

  it("shows smart insights: why, against what, how sure, where to look, and what unlocks more", async () => {
    api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /dashboard/overview": () => ok(overview()),
    });
    renderApp("/dashboard");

    const card = within(await screen.findByRole("region", { name: "Smart insights" }));
    expect(card.getByText("From your own records · rules, not AI")).toBeInTheDocument();
    const [fuelTile, spendTile] = card.getAllByRole("listitem").map((item) => within(item));
    expect(fuelTile!.getByText("Fuel costs 16% more per km")).toBeInTheDocument();
    expect(fuelTile!.getByText("Medium confidence")).toBeInTheDocument();
    expect(fuelTile!.getByRole("link", { name: "View fuel" })).toHaveAttribute("href", "/fuel");
    expect(spendTile!.getByText(/Insurance & legal fell the most/)).toBeInTheDocument();
    expect(spendTile!.getByText("vs 1–27 Oct")).toBeInTheDocument();
    expect(spendTile!.getByRole("link", { name: "View transactions" })).toHaveAttribute(
      "href",
      insights.items[1]!.action.href,
    );
    expect(
      card.getByText("More insights once odometer readings cover both periods."),
    ).toBeInTheDocument();
  });

  it("says which records unlock insights", async () => {
    api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /dashboard/overview": () =>
        ok(
          overview(victoris, {
            insights: { state: "ok", data: { items: [], needs: ["expenses", "fuel_cycles"] } },
          }),
        ),
    });
    renderApp("/dashboard");
    const card = within(await screen.findByRole("region", { name: "Smart insights" }));
    expect(card.getByText("Insights compare this period with the one before.")).toBeInTheDocument();
    expect(
      card.getByText("They appear once expenses and full-tank fill-ups cover both periods."),
    ).toBeInTheDocument();
  });

  it("says when nothing stands out", async () => {
    api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /dashboard/overview": () =>
        ok(overview(victoris, { insights: { state: "ok", data: { items: [], needs: [] } } })),
    });
    renderApp("/dashboard");
    expect(await screen.findByText("Nothing stands out against 1–27 Oct.")).toBeInTheDocument();
  });

  it("shows the sections in the saved order, without hidden ones, and the chosen key figures", async () => {
    const saved: DashboardLayout = {
      widgets: [
        { id: "activity", visible: true },
        ...DEFAULT_DASHBOARD_LAYOUT.widgets
          .filter((widget) => widget.id !== "activity")
          .map((widget) => ({ ...widget, visible: widget.id !== "spending" })),
      ],
      metrics: ["spent", "distance"],
    };
    api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /dashboard/overview": () => ok(overview()),
      "GET /dashboard/layout": () => ok(saved),
    });
    renderApp("/dashboard");

    const figures = await screen.findByRole("region", { name: "Key figures" });
    expect(within(figures).getByRole("link", { name: "Spent" })).toBeInTheDocument();
    expect(within(figures).getByRole("link", { name: "Distance" })).toBeInTheDocument();
    expect(within(figures).queryByRole("link", { name: "Fuel spend" })).not.toBeInTheDocument();
    expect(screen.queryByText("Monthly spending")).not.toBeInTheDocument();
    const activity = screen.getByText("Recent activity");
    expect(
      activity.compareDocumentPosition(figures) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("customises the dashboard and saves it to the account", async () => {
    let saved: unknown;
    api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /dashboard/overview": () => ok(overview()),
      "PUT /dashboard/layout": (config) => {
        saved = JSON.parse(config.data as string);
        return ok(saved);
      },
    });
    renderApp("/dashboard");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Customise" }));
    const sheet = within(await screen.findByRole("dialog", { name: "Customise dashboard" }));
    expect(sheet.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(sheet.getByRole("button", { name: "Reset to default" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    await user.click(sheet.getByRole("switch", { name: "Spending" }));
    await user.click(sheet.getByRole("button", { name: "Move Recent activity up" }));
    expect(await sheet.findByText("Recent activity moved to position 7 of 8")).toBeInTheDocument();
    for (const name of ["Running cost / km", "Average mileage", "Distance", "Next EMI"]) {
      await user.click(sheet.getByRole("checkbox", { name }));
    }
    await user.click(sheet.getByRole("checkbox", { name: "Fuel spend" }));
    // The last key figure can't go.
    expect(sheet.getByRole("checkbox", { name: "Spent" })).toBeDisabled();
    await user.click(sheet.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(saved).toEqual({
        widgets: [
          { id: "metrics", visible: true },
          { id: "insights", visible: true },
          { id: "spending", visible: false },
          { id: "fuel", visible: true },
          { id: "maintenance", visible: true },
          { id: "expiries", visible: true },
          { id: "activity", visible: true },
          { id: "driving", visible: true },
        ],
        metrics: ["spent"],
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Customise dashboard" })).not.toBeInTheDocument(),
    );
    expect(screen.queryByText("Monthly spending")).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Key figures" })).queryByRole("link", {
        name: "Distance",
      }),
    ).not.toBeInTheDocument();

    // Reset puts the default back in the sheet (saved only with Save).
    await user.click(screen.getByRole("button", { name: "Customise" }));
    const again = within(await screen.findByRole("dialog", { name: "Customise dashboard" }));
    await user.click(again.getByRole("button", { name: "Reset to default" }));
    expect(again.getByRole("switch", { name: "Spending" })).toBeChecked();
    expect(again.getByRole("checkbox", { name: "Distance" })).toBeChecked();
  });

  it("keeps Customise off when the saved layout can't load, and shows the default", async () => {
    api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /dashboard/overview": () => ok(overview()),
      "GET /dashboard/layout": () => fail(500, "INTERNAL_ERROR", "Something went wrong"),
    });
    renderApp("/dashboard");
    expect(await screen.findByText("Monthly spending")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Customise" })).toBeDisabled();
  });

  it("keeps focus on the button that moved a section", async () => {
    api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /dashboard/overview": () => ok(overview()),
    });
    renderApp("/dashboard");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Customise" }));
    const sheet = within(await screen.findByRole("dialog", { name: "Customise dashboard" }));
    await user.click(sheet.getByRole("button", { name: "Move Key figures down" }));
    await waitFor(() =>
      expect(sheet.getByRole("button", { name: "Move Key figures down" })).toHaveFocus(),
    );
  });

  it("asks for fill-ups when there are expenses but no fuel", async () => {
    api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /dashboard/overview": () => ok(overview(victoris, { fuel: { state: "empty" } })),
    });
    renderApp("/dashboard");
    expect(await screen.findByText("No fill-ups yet")).toBeInTheDocument();
  });

  it("invites the first record, and shows a failed section on its own with a retry", async () => {
    let calls = 0;
    api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /dashboard/overview": () =>
        ok(
          ++calls === 1
            ? overview(victoris, {
                metrics: { state: "empty" },
                status: { state: "error", message: "Couldn't work out the vehicle status." },
              })
            : overview(),
        ),
    });
    renderApp("/dashboard");
    const user = userEvent.setup();

    expect(await screen.findByText("No figures yet")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Active vehicle" })).toBeInTheDocument();
    expect(screen.getByText("Couldn't work out the vehicle status.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("region", { name: "Key figures" })).toBeInTheDocument();
  });

  it("says it's loading while the figures are on their way", async () => {
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /dashboard/overview": async () => {
        await held;
        return ok(overview());
      },
    });
    renderApp("/dashboard");

    expect(await screen.findByText("Loading the dashboard…")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Key figures" })).not.toBeInTheDocument();
    release();
    expect(await screen.findByRole("region", { name: "Key figures" })).toBeInTheDocument();
    expect(screen.queryByText("Loading the dashboard…")).not.toBeInTheDocument();
  });

  it("shows an error with a retry when the overview can't load", async () => {
    let attempts = 0;
    api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /dashboard/overview": () =>
        ++attempts === 1 ? fail(400, "BAD_REQUEST", "Something went wrong") : ok(overview()),
    });
    renderApp("/dashboard");
    const user = userEvent.setup();

    expect(await screen.findByText("Couldn't load the dashboard")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Try again|Retry/ }));
    await waitFor(() => expect(screen.queryByText("Couldn't load the dashboard")).toBeNull());
  });
});
