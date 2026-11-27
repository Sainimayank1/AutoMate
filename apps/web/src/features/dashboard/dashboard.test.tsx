import {
  customWindow,
  type DashboardMaintenance,
  type DashboardMetrics,
  type DashboardOverview,
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
        },
        {
          id: "warranty",
          severity: "info",
          title: "Warranty valid until 14 Mar 2028 or 1,00,000 km",
          detail: null,
          href: `/garage/${vehicle.id}`,
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
  ...overrides,
});

type Routes = Record<string, (config: InternalAxiosRequestConfig) => MockReply>;
function api(routes: Routes) {
  return mockApi((config) => {
    const key = `${(config.method ?? "get").toUpperCase()} ${config.url}`;
    const archived = (config.params as { archived?: boolean } | undefined)?.archived;
    return (
      routes[archived ? `${key}?archived` : key]?.(config) ?? fail(404, "NOT_FOUND", "Not found")
    );
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
    expect(within(hero).getByRole("link", { name: "Add fuel" })).toHaveAttribute(
      "href",
      "/fuel/new",
    );

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
    expect(screen.getByRole("link", { name: "Add service record" })).toHaveAttribute(
      "href",
      "/maintenance/records/new",
    );

    expect(
      screen.getByRole("link", { name: /Insurance.*Expiring.*Expires in 24 days/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("PUC, registration and licence arrive with Documents."),
    ).toBeInTheDocument();

    expect(screen.getByText("~40.4 km")).toBeInTheDocument();
    expect(screen.getByText(/^8,412 km on 24 Nov/)).toBeInTheDocument();
    expect(screen.getByText("Trips aren't tracked yet.")).toBeInTheDocument();
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
