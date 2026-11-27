import type { Trip, TripCategory, TripOverview } from "@automate/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it } from "vitest";

import { useSessionStore } from "@/stores/session-store";
import { useActiveVehicleStore } from "@/stores/vehicle-store";
import { fail, mockApi, type MockReply, ok, okPage, testUser, testVehicle } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";

const victoris = testVehicle({ odometerKm: 8732 });
const types: TripCategory[] = [
  ["0190d4a2-0000-7000-8000-0000000c0001", "PERSONAL", "Personal"],
  ["0190d4a2-0000-7000-8000-0000000c0002", "COMMUTE", "Commute"],
  ["0190d4a2-0000-7000-8000-0000000c0003", "ROAD_TRIP", "Road trip"],
].map(([id, key, name]) => ({
  id: id!,
  key: key as TripCategory["key"],
  name: name!,
  archivedAt: null,
}));

const jaipur: Trip = {
  id: "0190d4a2-0000-7000-8000-0000000d0001",
  vehicleId: victoris.id,
  method: "ODOMETER",
  category: { id: types[2]!.id, key: "ROAD_TRIP", name: "Road trip" },
  title: null,
  date: "2026-11-22",
  endDate: null,
  startTime: "06:10",
  endTime: "10:22",
  startKm: 8464,
  endKm: 8732,
  distanceKm: "268.0",
  durationMinutes: 252,
  origin: "Gurugram",
  destination: "Jaipur",
  notes: "Breakfast stop near Behror.",
  createdAt: "2026-11-22T05:00:00.000Z",
  updatedAt: "2026-11-22T05:00:00.000Z",
};
const errand: Trip = {
  ...jaipur,
  id: "0190d4a2-0000-7000-8000-0000000d0002",
  method: "DISTANCE",
  category: { id: types[0]!.id, key: "PERSONAL", name: "Personal" },
  date: "2026-11-25",
  startTime: null,
  endTime: null,
  startKm: null,
  endKm: null,
  distanceKm: "12.5",
  durationMinutes: null,
  origin: null,
  destination: "Sector 29 market",
  notes: null,
};

const overview = (overrides: Partial<TripOverview> = {}): TripOverview => ({
  period: {
    period: "this_month",
    from: "2026-11-01",
    to: "2026-11-27",
    previous: { from: "2026-10-01", to: "2026-10-27" },
    endsToday: true,
  },
  vehicleId: victoris.id,
  trips: 2,
  distanceKm: "280.5",
  averageKm: "140.3",
  longest: { id: jaipur.id, distanceKm: "268.0", label: "Gurugram → Jaipur" },
  drivingMinutes: 252,
  timedTrips: 1,
  perWeek: "0.5",
  byCategory: [
    {
      categoryId: types[2]!.id,
      key: "ROAD_TRIP",
      name: "Road trip",
      trips: 1,
      distanceKm: "268.0",
    },
    { categoryId: types[0]!.id, key: "PERSONAL", name: "Personal", trips: 1, distanceKm: "12.5" },
  ],
  series: {
    granularity: "day",
    points: [
      { start: "2026-11-22", distanceKm: "268.0", trips: 1 },
      { start: "2026-11-25", distanceKm: "12.5", trips: 1 },
    ],
  },
  recent: [errand, jaipur],
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

describe("trips overview", () => {
  it("shows the period's figures, types and recent trips, and filters on the server", async () => {
    const calls = api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /trips/overview": () => ok(overview()),
      "GET /trips": () => okPage([jaipur], { total: 2 }),
    });
    renderApp("/trips");
    const user = userEvent.setup();

    expect(await screen.findByText("280.5 km")).toBeInTheDocument();
    expect(screen.getByText("Longest 268 km")).toBeInTheDocument();
    const figures = screen.getByRole("region", { name: "Key figures" });
    expect(within(figures).getByText("4h 12m")).toBeInTheDocument();
    expect(within(figures).getByText("from 1 trip with times")).toBeInTheDocument();
    expect(screen.getByText(/268 km · 1 trip · 96%/)).toBeInTheDocument();
    const recent = screen.getByRole("link", { name: /Gurugram → Jaipur/ });
    expect(recent).toHaveAttribute("href", `/trips/${jaipur.id}`);
    expect(
      within(screen.getByRole("link", { name: /Sector 29 market/ })).getByText("Distance entered"),
    ).toBeInTheDocument();
    const overviewCall = () => calls.filter((call) => call.url === "/trips/overview").at(-1)!;
    expect(overviewCall().params).toMatchObject({ vehicleId: victoris.id, period: "this_month" });

    await user.click(screen.getByRole("combobox", { name: "Period" }));
    await user.click(await screen.findByRole("option", { name: "All time" }));
    await waitFor(() => expect(overviewCall().params).toMatchObject({ period: "all_time" }));

    await user.click(screen.getByRole("combobox", { name: "Vehicle" }));
    await user.click(await screen.findByRole("option", { name: "All vehicles" }));
    await waitFor(() => expect(overviewCall().params).not.toHaveProperty("vehicleId"));
  });

  it("invites the first trip when there are none", async () => {
    api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /trips/overview": () =>
        ok(overview({ trips: 0, distanceKm: "0.0", averageKm: null, longest: null, recent: [] })),
      "GET /trips": () => okPage([]),
    });
    renderApp("/trips");
    expect(await screen.findByText("No trips yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log your first trip" })).toHaveAttribute(
      "href",
      `/trips/new?vehicle=${victoris.id}`,
    );
  });
});

describe("logging a trip", () => {
  it(
    "computes the distance from the readings, refusing an end below the start",
    { timeout: 15_000 },
    async () => {
      const calls = api({
        "GET /vehicles": () => okPage([victoris]),
        "GET /trip-categories": () => okPage(types),
        "POST /trips": () => ok(jaipur, 201),
        [`GET /trips/${jaipur.id}`]: () => ok(jaipur),
      });
      renderApp("/trips/new");
      const user = userEvent.setup();

      const start = await screen.findByLabelText(/Starting odometer/);
      expect(start).toHaveValue("8,732");
      await user.click(screen.getByRole("combobox", { name: "Trip type" }));
      await user.click(await screen.findByRole("option", { name: "Road trip" }));
      await user.type(screen.getByLabelText(/Ending odometer/), "8700");
      await user.click(screen.getByRole("button", { name: "Save trip" }));
      expect(
        await screen.findByText("Must be more than the starting odometer"),
      ).toBeInTheDocument();
      expect(calls.some((call) => call.method === "post")).toBe(false);

      await user.clear(screen.getByLabelText(/Ending odometer/));
      await user.type(screen.getByLabelText(/Ending odometer/), "9000");
      expect(screen.getAllByText("268 km").length).toBeGreaterThan(0);
      await user.type(screen.getByLabelText(/^From/), "Gurugram");
      await user.type(screen.getByLabelText(/^To/), "Jaipur");
      await user.click(screen.getByRole("button", { name: "Save trip" }));
      await waitFor(() => expect(calls.some((call) => call.method === "post")).toBe(true));
      const body = bodyOf(calls.find((call) => call.method === "post"));
      expect(body).toMatchObject({
        vehicleId: victoris.id,
        method: "ODOMETER",
        categoryId: types[2]!.id,
        startKm: 8732,
        endKm: 9000,
        origin: "Gurugram",
        destination: "Jaipur",
      });
      expect(body.id).toEqual(expect.any(String));
      expect(await screen.findByRole("heading", { name: "Gurugram → Jaipur" })).toBeInTheDocument();
    },
  );

  it("logs an entered distance, warning about an unusual day", { timeout: 15_000 }, async () => {
    const calls = api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /trip-categories": () => okPage(types),
      "POST /trips": () => ok(errand, 201),
      [`GET /trips/${errand.id}`]: () => ok(errand),
    });
    renderApp("/trips/new");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("radio", { name: "Distance" }));
    await user.click(screen.getByRole("combobox", { name: "Trip type" }));
    await user.click(await screen.findByRole("option", { name: "Personal" }));
    await user.type(screen.getByLabelText(/^Distance/), "1600");
    expect(screen.getByText(/more than 1,500 km in a day/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/^Distance/));
    await user.type(screen.getByLabelText(/^Distance/), "12.5");
    await user.click(screen.getByRole("button", { name: "Save trip" }));
    await waitFor(() => expect(calls.some((call) => call.method === "post")).toBe(true));
    expect(bodyOf(calls.find((call) => call.method === "post"))).toMatchObject({
      method: "DISTANCE",
      distanceKm: "12.5",
    });
  });

  it("adds a trip type of your own", async () => {
    const calls = api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /trip-categories": () => okPage(types),
      "POST /trip-categories": () =>
        ok(
          {
            id: "0190d4a2-0000-7000-8000-0000000c0009",
            key: null,
            name: "Temple visits",
            archivedAt: null,
          },
          201,
        ),
    });
    renderApp("/trips/new");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Manage trip types" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getAllByText("Default")).toHaveLength(3);
    await user.type(within(dialog).getByLabelText("New trip type"), "Temple visits");
    await user.click(within(dialog).getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(bodyOf(calls.find((call) => call.method === "post"))).toEqual({
        name: "Temple visits",
      }),
    );
  });
});

describe("trip details", () => {
  it("shows the figures it can and deletes the trip", async () => {
    const calls = api({
      "GET /vehicles": () => okPage([victoris]),
      [`GET /trips/${errand.id}`]: () => ok(errand),
      [`DELETE /trips/${errand.id}`]: () => ({ status: 204 }),
      "GET /trips/overview": () => ok(overview()),
      "GET /trips": () => okPage([jaipur]),
    });
    renderApp(`/trips/${errand.id}`);
    const user = userEvent.setup();

    expect(await screen.findByRole("heading", { name: "Sector 29 market" })).toBeInTheDocument();
    expect(screen.getAllByText("Distance entered").length).toBeGreaterThan(0);
    expect(screen.getByText("Needs start and end times")).toBeInTheDocument();
    expect(screen.getByText("No readings")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "More actions" }));
    expect(await screen.findByRole("menuitem", { name: "Duplicate" })).toHaveAttribute(
      "href",
      `/trips/new?duplicate=${errand.id}`,
    );
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("odometer stays at its highest remaining reading");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(calls.some((call) => call.method === "delete")).toBe(true));
  });
});
