import {
  addDays,
  type FuelSummary,
  istToday,
  type Trip,
  type TripAnalytics,
  type TripAttachment,
  type TripCategory,
  type TripImportPreview,
  type TripOverview,
  type TripPlan,
} from "@automate/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSessionStore } from "@/stores/session-store";
import { useActiveVehicleStore } from "@/stores/vehicle-store";
import { fail, mockApi, type MockReply, ok, okPage, testUser, testVehicle } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";

const downloads = vi.hoisted(() => [] as { filename: string; csv: string }[]);
vi.mock("@/utils/csv", async (original) => ({
  ...(await original<typeof import("@/utils/csv")>()),
  downloadCsv: (filename: string, csv: string) => downloads.push({ filename, csv }),
}));

// Leaflet doesn't render in jsdom; the map's inputs are what matter here.
vi.mock("@/features/trips/components/trip-map", () => ({
  default: ({ places, geometry }: { places: { label: string }[]; geometry?: string | null }) => (
    <div data-testid="trip-map">
      {places.map((place) => place.label).join(" → ")}
      {geometry ? " (route)" : ""}
    </div>
  ),
}));

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
  originPoint: null,
  destinationPoint: null,
  stops: [],
  route: null,
  actualCost: null,
  plan: null,
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
  cost: { total: null, perKm: null },
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

describe("trip history", () => {
  it(
    "shows a timeline by month, filters and sorts through the API, and switches to a list",
    { timeout: 15_000 },
    async () => {
      const calls = api({
        "GET /vehicles": () => okPage([victoris]),
        "GET /trip-categories": () => okPage(types),
        "GET /trips": () => okPage([errand, jaipur]),
        "GET /trips/summary": () => ok({ trips: 2, distanceKm: "280.5" }),
      });
      renderApp("/trips/history");
      const user = userEvent.setup();

      expect(await screen.findByRole("heading", { name: "November 2026" })).toBeInTheDocument();
      expect(screen.getByText("2 trips · 280.5 km")).toBeInTheDocument();
      const last = () => calls.filter((call) => call.url === "/trips").at(-1)!.params;
      expect(last()).toMatchObject({ vehicleId: victoris.id, sort: "newest", page: 1 });

      await user.type(screen.getByRole("searchbox", { name: "Search trips" }), "jaipur");
      await waitFor(() => expect(last()).toMatchObject({ search: "jaipur" }));
      await user.click(screen.getByRole("combobox", { name: "Sort" }));
      await user.click(await screen.findByRole("option", { name: "Longest" }));
      await waitFor(() => expect(last()).toMatchObject({ sort: "longest" }));

      await user.click(screen.getByRole("button", { name: /Filters/ }));
      await user.type(await screen.findByLabelText("Over"), "50");
      await user.click(screen.getByRole("button", { name: "Apply" }));
      await waitFor(() => expect(last()).toMatchObject({ minKm: "50" }));
      expect(screen.getByRole("button", { name: "Remove filter: Over 50 km" })).toBeInTheDocument();

      await user.click(screen.getByRole("radio", { name: "List" }));
      expect(screen.queryByRole("heading", { name: "November 2026" })).not.toBeInTheDocument();
    },
  );

  it(
    "changes the type of selected trips and deletes them together",
    { timeout: 15_000 },
    async () => {
      const calls = api({
        "GET /vehicles": () => okPage([victoris]),
        "GET /trip-categories": () => okPage(types),
        "GET /trips": () => okPage([errand, jaipur]),
        "GET /trips/summary": () => ok({ trips: 2, distanceKm: "280.5" }),
        "POST /trips/bulk": (config) => ok({ count: (bodyOf(config).ids as string[]).length }),
      });
      renderApp("/trips/history");
      const user = userEvent.setup();

      await user.click(await screen.findByRole("checkbox", { name: "Select Gurugram → Jaipur" }));
      await user.click(screen.getByRole("checkbox", { name: "Select Sector 29 market" }));
      const bar = screen.getByRole("region", { name: "Selected trips" });
      expect(within(bar).getByText("2 selected")).toBeInTheDocument();
      await user.click(within(bar).getByRole("combobox", { name: "Change type" }));
      await user.click(await screen.findByRole("option", { name: "Commute" }));
      await waitFor(() =>
        expect(bodyOf(calls.find((call) => call.method === "post"))).toEqual({
          action: "category",
          ids: [jaipur.id, errand.id],
          categoryId: types[1]!.id,
        }),
      );

      await user.click(await screen.findByRole("checkbox", { name: "Select Gurugram → Jaipur" }));
      await user.click(
        within(screen.getByRole("region", { name: "Selected trips" })).getByRole("button", {
          name: "Delete",
        }),
      );
      const dialog = await screen.findByRole("alertdialog");
      expect(dialog).toHaveTextContent("Delete 1 trip?");
      await user.click(within(dialog).getByRole("button", { name: "Delete" }));
      await waitFor(() =>
        expect(bodyOf(calls.filter((call) => call.method === "post").at(-1))).toEqual({
          action: "delete",
          ids: [jaipur.id],
        }),
      );
    },
  );

  it("separates a filtered empty result from an empty history", async () => {
    api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /trip-categories": () => okPage(types),
      "GET /trips": () => okPage([]),
      "GET /trips/summary": () => ok({ trips: 0, distanceKm: "0.0" }),
    });
    renderApp("/trips/history?q=goa");
    expect(await screen.findByText("No trips match")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Clear filters" }));
    expect(await screen.findByText("No trips yet")).toBeInTheDocument();
  });
});

describe("trip costs", () => {
  const toll = {
    id: "0190d4a2-0000-7000-8000-0000000e0001",
    tripId: jaipur.id,
    vehicleId: victoris.id,
    category: "TOLL" as const,
    amount: "240.00",
    date: "2026-11-22",
    vendor: "Kherki Daula plaza",
    paymentMethod: "UPI" as const,
    notes: null,
    expenseId: "0190d4a2-0000-7000-8000-0000000f0001",
    trip: { id: jaipur.id, label: "Gurugram → Jaipur", date: "2026-11-22" },
    createdAt: "2026-11-22T05:00:00.000Z",
    updatedAt: "2026-11-22T05:00:00.000Z",
  };
  const food = {
    ...toll,
    id: "0190d4a2-0000-7000-8000-0000000e0002",
    category: "FOOD" as const,
    amount: "285.00",
    vendor: null,
    expenseId: null,
  };
  const spending = {
    actual: "1325.00",
    byCategory: [
      { category: "FUEL", amount: "800.00" },
      { category: "FOOD", amount: "285.00" },
      { category: "TOLL", amount: "240.00" },
    ],
    perKm: "4.94",
    fuelEntries: 1,
    estimate: {
      fuelType: "PETROL",
      quantity: "12.5",
      cost: "1304.00",
      mileage: "21.4",
      price: "104.32",
    },
  };
  const fill = {
    id: "0190d4a2-0000-7000-8000-0000000a0101",
    filledAt: "2026-11-22T03:30:00.000Z",
    station: "IndianOil, Behror",
    quantity: "7.60",
    totalAmount: "800.00",
  };

  it(
    "shows actual spending apart from the estimate and adds a toll",
    { timeout: 15_000 },
    async () => {
      const calls = api({
        "GET /vehicles": () => okPage([victoris]),
        [`GET /trips/${jaipur.id}`]: () => ok({ ...jaipur, actualCost: "1325.00" }),
        [`GET /trips/${jaipur.id}/spending`]: () => ok(spending),
        [`GET /trips/${jaipur.id}/costs`]: () => okPage([toll, food]),
        [`GET /trips/${jaipur.id}/fuel-entries`]: () => okPage([fill]),
        [`POST /trips/${jaipur.id}/costs`]: () => ok(toll, 201),
      });
      renderApp(`/trips/${jaipur.id}`);
      const user = userEvent.setup();

      expect(await screen.findByText("₹1,325.00")).toBeInTheDocument();
      expect(screen.getByText(/₹4.94 per km/)).toBeInTheDocument();
      expect(screen.getByText(/~12.5 L · ~₹1,304.00/)).toBeInTheDocument();
      expect(screen.getByText(/Not counted as spending/)).toBeInTheDocument();
      expect(await screen.findByText("In Expenses")).toBeInTheDocument();
      expect(screen.getByText("Trip only")).toBeInTheDocument();
      expect(screen.getByText(/IndianOil, Behror/)).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Add cost" }));
      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByText("Also added to your vehicle's expenses")).toBeInTheDocument();
      await user.type(within(dialog).getByLabelText("Amount"), "240");
      await user.type(within(dialog).getByLabelText(/Where/), "Kherki Daula plaza");
      await user.click(within(dialog).getByRole("button", { name: "Save cost" }));
      await waitFor(() => expect(calls.some((call) => call.method === "post")).toBe(true));
      const body = bodyOf(calls.find((call) => call.method === "post"));
      expect(body).toMatchObject({
        category: "TOLL",
        amount: "240",
        date: jaipur.date,
        vendor: "Kherki Daula plaza",
      });
      expect(body.id).toEqual(expect.any(String));
    },
  );

  it("totals the period's trip costs by category and opens each trip", async () => {
    const calls = api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /trip-costs/summary": () =>
        ok({
          ...(overview().period && { period: overview().period }),
          vehicleId: victoris.id,
          total: "1325.00",
          byCategory: spending.byCategory,
          perKm: "4.94",
        }),
      "GET /trip-costs": () => okPage([toll, food]),
    });
    renderApp("/trips/costs");
    const user = userEvent.setup();

    expect(await screen.findByText("₹1,325.00")).toBeInTheDocument();
    expect(screen.getByText(/₹4.94 per km/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Toll.*Kherki Daula plaza/ })).toHaveAttribute(
      "href",
      `/trips/${jaipur.id}`,
    );
    await user.click(screen.getByRole("button", { name: "Parking" }));
    await waitFor(() =>
      expect(calls.filter((call) => call.url === "/trip-costs").at(-1)!.params).toMatchObject({
        category: "PARKING",
      }),
    );
  });

  it("opens the trip of a cost from its expense link", async () => {
    api({
      "GET /vehicles": () => okPage([victoris]),
      [`GET /trip-costs/${toll.id}`]: () => ok(toll),
      [`GET /trips/${jaipur.id}`]: () => ok(jaipur),
    });
    renderApp(`/trips/costs/${toll.id}`);
    expect(await screen.findByRole("heading", { name: "Gurugram → Jaipur" })).toBeInTheDocument();
  });
});

describe("routes", () => {
  const place = (label: string, latitude: number, longitude: number) => ({
    label,
    latitude,
    longitude,
  });
  const hisar = place("Hisar, Haryana", 29.1492, 75.7217);
  const shimla = place("Shimla, Himachal Pradesh", 31.1048, 77.1734);
  const manali = place("Manali, Himachal Pradesh", 32.2432, 77.1892);

  it(
    "builds a route from searched places and stops, and saves the chosen option",
    { timeout: 20_000 },
    async () => {
      const calls = api({
        "GET /vehicles": () => okPage([victoris]),
        "GET /trip-categories": () => okPage(types),
        "POST /geocode/search": (config) => {
          const query = String(bodyOf(config).query).toLowerCase();
          return ok(
            query.startsWith("his") ? [hisar] : query.startsWith("shi") ? [shimla] : [manali],
          );
        },
        "POST /trips/routes/calculate": () =>
          ok({
            provider: "OpenStreetMap (OSRM)",
            routes: [
              { distanceKm: "512.4", durationMinutes: 640, geometry: "_p~iF~ps|U" },
              { distanceKm: "530.0", durationMinutes: 700, geometry: "_p~iF~ps|U" },
            ],
          }),
        "POST /trips": () => ok(jaipur, 201),
        [`GET /trips/${jaipur.id}`]: () => ok(jaipur),
      });
      renderApp("/trips/new");
      const user = userEvent.setup();

      await user.click(await screen.findByRole("radio", { name: "Route" }));
      await user.click(screen.getByRole("combobox", { name: "Trip type" }));
      await user.click(await screen.findByRole("option", { name: "Road trip" }));
      expect(screen.getByRole("button", { name: "Calculate route" })).toBeDisabled();

      const pick = async (input: HTMLElement, typed: string, label: string, chosen: string) => {
        await user.type(input, `${typed}{Enter}`);
        await user.click(
          await within(await screen.findByRole("list", { name: `Places for ${label}` })).findByRole(
            "button",
            { name: chosen },
          ),
        );
      };
      await pick(screen.getByLabelText(/^From/), "Hisar", "From", hisar.label);
      await user.click(screen.getByRole("button", { name: "Add stop" }));
      await pick(screen.getByPlaceholderText("e.g. Chandigarh"), "Shimla", "stop 1", shimla.label);
      await pick(screen.getByLabelText(/^To/), "Manali", "To", manali.label);
      expect(bodyOf(calls.filter((call) => call.url === "/geocode/search").at(-1)).query).toBe(
        "Manali",
      );

      await user.click(screen.getByRole("button", { name: "Calculate route" }));
      expect(await screen.findByTestId("trip-map")).toHaveTextContent(
        "Hisar, Haryana → Shimla, Himachal Pradesh → Manali, Himachal Pradesh (route)",
      );
      expect(calls.find((call) => call.url === "/trips/routes/calculate")?.data).toContain(
        "31.1048",
      );
      await user.click(screen.getByRole("radio", { name: /Alternative 1.*530 km/ }));

      await user.click(screen.getByRole("button", { name: "Save trip" }));
      await waitFor(() =>
        expect(calls.some((call) => call.url === "/trips" && call.method === "post")).toBe(true),
      );
      expect(
        bodyOf(calls.find((call) => call.url === "/trips" && call.method === "post")),
      ).toMatchObject({
        method: "ROUTE",
        origin: hisar.label,
        originLat: hisar.latitude,
        destinationLng: manali.longitude,
        stops: [{ label: shimla.label, latitude: shimla.latitude, longitude: shimla.longitude }],
        routeIndex: 1,
      });
    },
  );

  it("refuses a route without places chosen from the search", { timeout: 15_000 }, async () => {
    const calls = api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /trip-categories": () => okPage(types),
    });
    renderApp("/trips/new");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("radio", { name: "Route" }));
    await user.click(screen.getByRole("combobox", { name: "Trip type" }));
    await user.click(await screen.findByRole("option", { name: "Road trip" }));
    await user.type(screen.getByLabelText(/^From/), "My village");
    await user.click(screen.getByRole("button", { name: "Save trip" }));
    expect(
      await screen.findByText("Choose where from in the search to get a route"),
    ).toBeInTheDocument();
    expect(calls.some((call) => call.method === "post")).toBe(false);
  });

  it("shows a route trip on the map with its stops", async () => {
    const routed = {
      ...jaipur,
      method: "ROUTE" as const,
      startKm: null,
      endKm: null,
      origin: "Hisar",
      destination: "Manali",
      originPoint: { latitude: 29.1492, longitude: 75.7217 },
      destinationPoint: { latitude: 32.2432, longitude: 77.1892 },
      stops: [
        {
          id: "s1",
          label: "Shimla",
          latitude: 31.1048,
          longitude: 77.1734,
          arrivalTime: "13:10",
          departureTime: null,
          notes: null,
        },
      ],
      route: {
        provider: "OpenStreetMap (OSRM)",
        distanceKm: "512.4",
        durationMinutes: 640,
        geometry: "_p~iF~ps|U",
      },
      distanceKm: "512.4",
    };
    api({
      "GET /vehicles": () => okPage([victoris]),
      [`GET /trips/${jaipur.id}`]: () => ok(routed),
    });
    renderApp(`/trips/${jaipur.id}`);

    expect(await screen.findByTestId("trip-map")).toHaveTextContent(
      "Hisar → Shimla → Manali (route)",
    );
    expect(screen.getByText("1. Shimla")).toBeInTheDocument();
    expect(screen.getByText("arrived 13:10")).toBeInTheDocument();
    expect(screen.getByText(/From the route \(OpenStreetMap \(OSRM\)\)/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open in OpenStreetMap" })).toHaveAttribute(
      "href",
      expect.stringContaining("route=29.1492,75.7217;32.2432,77.1892"),
    );
  });
});

describe("planner", () => {
  const manali: TripPlan = {
    id: "0190d4a2-0000-7000-8000-0000000e0001",
    vehicleId: victoris.id,
    status: "PLANNED",
    category: { id: types[2]!.id, key: "ROAD_TRIP", name: "Road trip" },
    title: "Manali road trip",
    date: "2099-12-14",
    endDate: "2099-12-17",
    startTime: "06:00",
    method: "DISTANCE",
    plannedDistanceKm: "540.0",
    plannedDurationMinutes: null,
    origin: "Hisar",
    destination: "Manali",
    originPoint: null,
    destinationPoint: null,
    stops: [],
    route: null,
    estMileage: "18.00",
    estFuelPrice: "104.00",
    estToll: "1450.00",
    estParking: null,
    estAccommodation: "4800.00",
    estOther: "480.00",
    budget: { fuelQuantity: "30.0", fuelCost: "3120.00", total: "9850.00", perKm: "18.24" },
    notes: null,
    createdAt: "2026-11-28T05:00:00.000Z",
    updatedAt: "2026-11-28T05:00:00.000Z",
  };
  const fuelSummary = {
    fuelType: "PETROL",
    averageMileage: "18.50",
    averagePrice: "104.320",
  } as FuelSummary;

  it("lists upcoming plans with their budget, and the cancelled ones on the server", async () => {
    const calls = api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /trip-plans": (config) =>
        (config.params as { view?: string }).view === "cancelled"
          ? okPage([{ ...manali, status: "CANCELLED" }])
          : okPage([manali]),
    });
    renderApp("/trips/planner");
    const user = userEvent.setup();

    const plans = await screen.findByRole("list", { name: "Plans" });
    expect(within(plans).getByRole("link", { name: "Manali road trip" })).toHaveAttribute(
      "href",
      `/trips/planner/${manali.id}`,
    );
    expect(within(plans).getByText("Planned")).toBeInTheDocument();
    expect(within(plans).getByText("₹9,850.00")).toBeInTheDocument();
    expect(within(plans).getByText(/Hisar → Manali/)).toBeInTheDocument();
    expect(screen.getByText("Next trip")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Cancelled" }));
    await waitFor(() =>
      expect(calls.filter((call) => call.url === "/trip-plans").at(-1)!.params).toMatchObject({
        view: "cancelled",
      }),
    );
    expect(await screen.findByText("Cancelled", { selector: "span" })).toBeInTheDocument();
  });

  it(
    "plans a trip with a live budget from the vehicle's own fuel figures",
    { timeout: 15_000 },
    async () => {
      const calls = api({
        "GET /vehicles": () => okPage([victoris]),
        "GET /trip-categories": () => okPage(types),
        [`GET /vehicles/${victoris.id}/fuel-summary`]: () => ok(fuelSummary),
        "POST /trip-plans": () => ok({ ...manali, status: "DRAFT" }, 201),
        [`GET /trip-plans/${manali.id}`]: () => ok({ ...manali, status: "DRAFT" }),
      });
      renderApp("/trips/plan");
      const user = userEvent.setup();

      expect(await screen.findByLabelText(/Mileage/)).toHaveValue("18.50");
      expect(screen.getByLabelText(/Fuel price/)).toHaveValue("104.32");
      await user.click(await screen.findByRole("radio", { name: "Road trip" }));
      await user.type(screen.getByLabelText(/^Distance/), "540");
      await user.type(screen.getByLabelText(/Toll/), "1450");
      // 540 ÷ 18.5 × 104.32 = 3,045.02, plus the toll.
      expect(screen.getByText("₹4,495.02")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Save as draft" }));
      await waitFor(() =>
        expect(bodyOf(calls.find((call) => call.method === "post"))).toMatchObject({
          status: "DRAFT",
          method: "DISTANCE",
          plannedDistanceKm: "540",
          estMileage: "18.50",
          estToll: "1450",
        }),
      );
      expect(await screen.findByRole("heading", { name: "Manali road trip" })).toBeInTheDocument();
    },
  );

  it(
    "marks a plan done with what actually happened, then shows planned vs actual",
    { timeout: 15_000 },
    async () => {
      const done: Trip = {
        ...jaipur,
        id: manali.id,
        title: "Manali road trip",
        startKm: 8732,
        endKm: 9300,
        distanceKm: "568.0",
        actualCost: "10250.00",
        plan: { distanceKm: "540.0", durationMinutes: null, budget: "9850.00" },
      };
      const calls = api({
        "GET /vehicles": () => okPage([victoris]),
        [`GET /vehicles/${victoris.id}/fuel-summary`]: () => ok(fuelSummary),
        [`GET /trip-plans/${manali.id}`]: () => ok(manali),
        [`POST /trip-plans/${manali.id}/complete`]: () => ok(done),
        [`GET /trips/${manali.id}`]: () => ok(done),
        [`GET /trips/${manali.id}/costs`]: () => okPage([]),
        [`GET /trips/${manali.id}/fuel-entries`]: () => okPage([]),
        [`GET /trips/${manali.id}/spending`]: () => fail(404, "NOT_FOUND", "Not found"),
      });
      renderApp(`/trips/planner/${manali.id}`);
      const user = userEvent.setup();

      expect(await screen.findByText("₹9,850.00")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Mark as done" }));
      const dialog = await screen.findByRole("dialog", { name: "Mark trip as done" });
      expect(within(dialog).getByLabelText(/Starting odometer/)).toHaveValue("8,732");
      await user.type(within(dialog).getByLabelText(/Ending odometer/), "9300");
      expect(within(dialog).getByText("568 km")).toBeInTheDocument();
      await user.click(within(dialog).getByRole("button", { name: "Mark as done" }));

      await waitFor(() =>
        expect(bodyOf(calls.find((call) => call.url?.endsWith("/complete")))).toMatchObject({
          method: "ODOMETER",
          startKm: 8732,
          endKm: 9300,
        }),
      );
      expect(await screen.findByText("Planned vs actual")).toBeInTheDocument();
      expect(screen.getByText("+28 km")).toBeInTheDocument();
      expect(screen.getByText("+₹400.00")).toBeInTheDocument();
    },
  );
});

describe("road trips", () => {
  const today = istToday(new Date());
  const stop = (label: string, extra: object = {}) => ({
    id: `0190d4a2-0000-7000-8000-${label.charCodeAt(0).toString(16).padStart(12, "0")}`,
    label,
    latitude: null,
    longitude: null,
    arrivalTime: null,
    departureTime: null,
    notes: null,
    day: null,
    overnight: false,
    ...extra,
  });
  const roadPlan = (overrides: Partial<TripPlan> = {}): TripPlan => ({
    id: "0190d4a2-0000-7000-8000-0000000e0002",
    vehicleId: victoris.id,
    status: "PLANNED",
    category: { id: types[2]!.id, key: "ROAD_TRIP", name: "Road trip" },
    title: "Himachal loop",
    date: addDays(today, -1),
    endDate: addDays(today, 1),
    startTime: "06:00",
    method: "DISTANCE",
    plannedDistanceKm: "900.0",
    plannedDurationMinutes: null,
    origin: "Hisar",
    destination: "Hisar",
    originPoint: null,
    destinationPoint: null,
    stops: [stop("Chandigarh"), stop("Manali, HP")],
    route: null,
    estMileage: null,
    estFuelPrice: null,
    estToll: null,
    estParking: null,
    estAccommodation: null,
    estOther: null,
    budget: { fuelQuantity: null, fuelCost: null, total: null, perKm: null },
    notes: null,
    createdAt: "2026-11-28T05:00:00.000Z",
    updatedAt: "2026-11-28T05:00:00.000Z",
    ...overrides,
  });

  it(
    "lays out a plan's days and nights, and shows which day of it is today",
    { timeout: 15_000 },
    async () => {
      const plan = roadPlan();
      const saved = roadPlan({
        stops: [stop("Chandigarh", { day: 1, overnight: true }), stop("Manali, HP", { day: 2 })],
      });
      let current = plan;
      const calls = api({
        "GET /vehicles": () => okPage([victoris]),
        [`GET /vehicles/${victoris.id}/fuel-summary`]: () => fail(404, "NOT_FOUND", "Not found"),
        [`GET /trip-plans/${plan.id}`]: () => ok(current),
        [`PATCH /trip-plans/${plan.id}`]: () => {
          current = saved;
          return ok(saved);
        },
      });
      renderApp(`/trips/planner/${plan.id}/itinerary`);
      const user = userEvent.setup();

      const day1 = await screen.findByRole("region", { name: "Day 1" });
      expect(within(day1).getByText("Chandigarh")).toBeInTheDocument();
      expect(screen.getByRole("region", { name: "Day 3" })).toHaveTextContent("Ends at Hisar");
      await user.click(within(day1).getAllByRole("switch")[0]!);
      // Manali still on day 1 after Chandigarh's night: refused until it moves on.
      await user.click(screen.getByRole("button", { name: "Save itinerary" }));
      expect(
        await screen.findByText("The night is spent at the last stop of the day"),
      ).toBeInTheDocument();
      await user.click(screen.getByRole("combobox", { name: "Day for Manali, HP" }));
      await user.click(await screen.findByRole("option", { name: "Day 2" }));
      expect(within(day1).getByText("Night at Chandigarh")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Save itinerary" }));

      await waitFor(() =>
        expect(bodyOf(calls.find((call) => call.method === "patch"))).toEqual({
          stops: [
            expect.objectContaining({ label: "Chandigarh", day: 1, overnight: true }),
            expect.objectContaining({ label: "Manali, HP", day: 2, overnight: false }),
          ],
        }),
      );
      const itinerary = await screen.findByRole("list", { name: "Itinerary" });
      expect(within(itinerary).getByText("Night at Chandigarh")).toBeInTheDocument();
      expect(screen.getByText("Day 2 of 3")).toBeInTheDocument();
    },
  );

  it("sums a done road trip up per day", async () => {
    const done: Trip = {
      ...jaipur,
      title: "Himachal loop",
      date: "2026-11-20",
      endDate: "2026-11-23",
      distanceKm: "1081.0",
      actualCost: "10250.00",
      stops: [
        stop("Kullu", { day: 1, overnight: true }),
        stop("Manali, HP", { day: 2, overnight: true }),
      ],
    };
    api({
      "GET /vehicles": () => okPage([victoris]),
      [`GET /trips/${jaipur.id}`]: () => ok(done),
      [`GET /trips/${jaipur.id}/costs`]: () => okPage([]),
      [`GET /trips/${jaipur.id}/fuel-entries`]: () => okPage([]),
      [`GET /trips/${jaipur.id}/spending`]: () => fail(404, "NOT_FOUND", "Not found"),
    });
    renderApp(`/trips/${jaipur.id}`);

    expect(await screen.findByText("Road trip summary")).toBeInTheDocument();
    expect(screen.getByText("270.3 km")).toBeInTheDocument();
    expect(screen.getByText("₹2,562.50")).toBeInTheDocument();
    expect(screen.getByText("Night at Manali, HP")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit itinerary" })).toHaveAttribute(
      "href",
      `/trips/${jaipur.id}/itinerary`,
    );
  });
});

describe("trip analytics", () => {
  const analytics = (overrides: Partial<TripAnalytics> = {}): TripAnalytics => ({
    period: overview().period,
    vehicleId: null,
    current: { trips: 18, distanceKm: "720.0", actualCost: "3040.00" },
    previous: { trips: 15, distanceKm: "626.0", actualCost: null },
    change: { distance: 15, trips: 20, cost: null },
    distance: {
      averageKm: "40.0",
      perDayKm: "26.7",
      shortest: { id: errand.id, label: "Sector 29 market", distanceKm: "3.4" },
      longest: { id: jaipur.id, label: "Gurugram → Jaipur", distanceKm: "268.0" },
      bands: [
        { band: "UNDER_10", trips: 6, distanceKm: "30.0" },
        { band: "10_50", trips: 9, distanceKm: "280.0" },
        { band: "50_100", trips: 0, distanceKm: "0.0" },
        { band: "100_300", trips: 3, distanceKm: "410.0" },
        { band: "300_PLUS", trips: 0, distanceKm: "0.0" },
      ],
    },
    time: {
      averageMinutes: 52,
      longest: { id: jaipur.id, label: "Gurugram → Jaipur", minutes: 252 },
      byWeekday: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
        weekday,
        trips: 2,
        distanceKm: "80.0",
      })),
      byTimeOfDay: [
        { slot: "MORNING", trips: 8 },
        { slot: "AFTERNOON", trips: 2 },
        { slot: "EVENING", trips: 5 },
        { slot: "NIGHT", trips: 1 },
      ],
      untimedTrips: 2,
    },
    cost: {
      actual: "3040.00",
      perKm: "4.22",
      perTrip: "405.33",
      tripsWithCost: 7,
      fuelEstimate: "6120.00",
    },
    byVehicle: [
      { vehicleId: victoris.id, trips: 18, distanceKm: "720.0", actualCost: "3040.00" },
      {
        vehicleId: "0190d4a2-0000-7000-8000-00000000a0ff",
        trips: 0,
        distanceKm: "0.0",
        actualCost: null,
      },
    ],
    topDestinations: [{ destination: "Jaipur", trips: 4 }],
    insights: [
      {
        key: "long_trips",
        title: "3 trips of 100 km or more",
        detail: "They covered 410 km, 57% of your distance.",
        link: "/trips/history?minKm=100&vehicle=all&from=2026-11-01&to=2026-11-27",
      },
    ],
    ...overrides,
  });

  it(
    "compares the period, keeps the fuel estimate apart and links insights to the trips",
    { timeout: 15_000 },
    async () => {
      const calls = api({
        "GET /vehicles": () => okPage([victoris]),
        "GET /trips/analytics": () => ok(analytics()),
      });
      renderApp("/trips/analytics?vehicle=all");
      const user = userEvent.setup();

      const tiles = await screen.findByRole("region", { name: "Against the period before" });
      expect(within(tiles).getByText("720 km")).toBeInTheDocument();
      expect(within(tiles).getByText("vs 626 km")).toBeInTheDocument();
      expect(within(tiles).getByText(/15%/)).toBeInTheDocument();
      // No previous cost: no percentage, no "vs".
      expect(within(tiles).queryByText(/vs ₹/)).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: /3 trips of 100 km or more/ })).toHaveAttribute(
        "href",
        "/trips/history?minKm=100&vehicle=all&from=2026-11-01&to=2026-11-27",
      );
      expect(screen.getByText("₹6,120.00")).toBeInTheDocument();
      expect(screen.getByText(/not counted as spending/)).toBeInTheDocument();
      expect(screen.getByText("Frequent destinations")).toBeInTheDocument();
      expect(calls.at(-1)!.params).toEqual({ period: "this_month" });

      await user.click(screen.getByRole("combobox", { name: "Period" }));
      await user.click(await screen.findByRole("option", { name: "This year" }));
      await waitFor(() =>
        expect(calls.filter((call) => call.url === "/trips/analytics").at(-1)!.params).toEqual({
          period: "this_year",
        }),
      );
    },
  );

  it("explains what's needed when the period has no trips", async () => {
    api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /trips/analytics": () =>
        ok(analytics({ current: { trips: 0, distanceKm: "0.0", actualCost: null }, insights: [] })),
    });
    renderApp("/trips/analytics");
    expect(await screen.findByText("No trips in this period")).toBeInTheDocument();
  });
});

describe("trip import, export and report", () => {
  it("exports the filtered history as CSV, every page", async () => {
    const calls = api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /trip-categories": () => okPage(types),
      "GET /trips": () => okPage([jaipur, errand], { total: 2 }),
      "GET /trips/summary": () => ok({ trips: 2, distanceKm: "280.5" }),
    });
    renderApp("/trips/history?vehicle=all&type=" + types[2]!.id);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Export CSV" }));
    await waitFor(() => expect(downloads).toHaveLength(1));
    const [header, first] = downloads[0]!.csv.split("\r\n");
    expect(header).toBe(
      "Date,End date,Start time,End time,Vehicle,Type,Title,From,To,Stops,Method,Start km,End km,Distance (km),Duration (min),Actual cost (INR),Notes",
    );
    expect(first).toContain("2026-11-22,,06:10,10:22,");
    expect(first).toContain(
      ",Road trip,,Gurugram,Jaipur,,Odometer readings,8464,8732,268.0,252,,Breakfast stop near Behror.",
    );
    // The export asked for the history's filters, a full page at a time.
    expect(calls.filter((call) => call.url === "/trips").at(-1)!.params).toMatchObject({
      categoryId: types[2]!.id,
      pageSize: 100,
    });
  });

  it(
    "maps a CSV's columns, previews it and imports the ready rows",
    { timeout: 15_000 },
    async () => {
      const preview: TripImportPreview = {
        counts: { ready: 1, duplicate: 0, skipped: 0, error: 1 },
        rows: [
          {
            line: 3,
            date: "2026-11-21",
            label: "Home → Moon",
            distanceKm: null,
            status: "error",
            message: "Enter the distance in km, e.g. 268.5",
          },
          {
            line: 2,
            date: "2026-11-20",
            label: "Home → Office",
            distanceKm: "20",
            status: "ready",
            message: null,
          },
        ],
      };
      const calls = api({
        "GET /vehicles": () => okPage([victoris]),
        "GET /trip-categories": () => okPage(types),
        "GET /trips": () => okPage([]),
        "GET /trips/summary": () => ok({ trips: 0, distanceKm: "0.0" }),
        "POST /trips/import/preview": () => ok(preview),
        "POST /trips/import": () => ok({ imported: 1, notImported: 1, failed: [] }, 201),
      });
      renderApp("/trips/history");
      const user = userEvent.setup();

      await user.click(await screen.findByRole("button", { name: "Import" }));
      const dialog = within(await screen.findByRole("dialog", { name: "Import trips" }));
      const csv = "When,KM,From,To\n20/11/2026,20,Home,Office\n21/11/2026,far,Home,Moon";
      await user.upload(
        dialog.getByLabelText("CSV file"),
        new File([csv], "trips.csv", { type: "text/csv" }),
      );
      // Guessed from the headers; "When" isn't a known name, so the date is matched by hand.
      expect(await dialog.findByText(/Match columns · trips.csv · 2 rows/)).toBeInTheDocument();
      await user.click(dialog.getByRole("combobox", { name: /^Date/ }));
      await user.click(await screen.findByRole("option", { name: "When" }));
      await user.click(dialog.getByRole("button", { name: "Check file" }));

      expect(await dialog.findByText("Enter the distance in km, e.g. 268.5")).toBeInTheDocument();
      expect(bodyOf(calls.find((call) => call.url === "/trips/import/preview"))).toEqual({
        vehicleId: victoris.id,
        csv,
        columns: { date: "When", distanceKm: "KM", origin: "From", destination: "To" },
        includeDuplicates: false,
      });
      await user.click(dialog.getByRole("button", { name: "Import 1 trip" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(await screen.findByText("1 trip imported.")).toBeInTheDocument();
    },
  );

  it("prints a light report of the period with every trip", async () => {
    const analytics = {
      period: { ...overview().period, period: "this_year", from: "2026-01-01" },
      vehicleId: victoris.id,
      current: { trips: 2, distanceKm: "280.5", actualCost: "1520.00" },
      previous: { trips: 0, distanceKm: "0.0", actualCost: null },
      change: { distance: null, trips: null, cost: null },
      distance: {
        averageKm: "140.3",
        perDayKm: "0.9",
        shortest: null,
        longest: null,
        bands: [
          { band: "UNDER_10", trips: 0, distanceKm: "0.0" },
          { band: "10_50", trips: 1, distanceKm: "12.5" },
          { band: "50_100", trips: 0, distanceKm: "0.0" },
          { band: "100_300", trips: 1, distanceKm: "268.0" },
          { band: "300_PLUS", trips: 0, distanceKm: "0.0" },
        ],
      },
      time: {
        averageMinutes: null,
        longest: null,
        byWeekday: [],
        byTimeOfDay: [],
        untimedTrips: 1,
      },
      cost: {
        actual: "1520.00",
        perKm: "5.67",
        perTrip: "1520.00",
        tripsWithCost: 1,
        fuelEstimate: "2900.00",
      },
      byVehicle: [],
      topDestinations: [],
      insights: [],
    } satisfies TripAnalytics;
    const calls = api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /trips/analytics": () => ok(analytics),
      "GET /trips": () => okPage([{ ...jaipur, actualCost: "1520.00" }, errand]),
    });
    renderApp(`/trips/report?vehicle=${victoris.id}&period=this_year`);

    expect(await screen.findByRole("heading", { name: "Trips report" })).toBeInTheDocument();
    expect(document.documentElement).not.toHaveClass("dark");
    expect(await screen.findByText("2 trips · 280.5 km")).toBeInTheDocument();
    expect(screen.getByText("Estimate, not spending")).toBeInTheDocument();
    expect(screen.getByText("Gurugram → Jaipur")).toBeInTheDocument();
    expect(calls.filter((call) => call.url === "/trips").at(-1)!.params).toMatchObject({
      vehicleId: victoris.id,
      from: "2026-01-01",
      sort: "oldest",
    });
    expect(screen.getByRole("button", { name: "Print or save as PDF" })).toBeEnabled();
  });
});

describe("trip photos and receipts", () => {
  it(
    "uploads straight to storage, confirms, and labels a cost's receipt",
    { timeout: 15_000 },
    async () => {
      const toll = {
        id: "0190d4a2-0000-7000-8000-0000000c1001",
        tripId: jaipur.id,
        vehicleId: victoris.id,
        category: "TOLL",
        amount: "320.00",
        date: jaipur.date,
        vendor: "Kherki Daula",
        paymentMethod: null,
        notes: null,
        expenseId: null,
      };
      const receipt: TripAttachment = {
        id: "0190d4a2-0000-7000-8000-0000000c2001",
        tripId: jaipur.id,
        costId: toll.id,
        fileName: "toll.pdf",
        contentType: "application/pdf",
        size: 188416,
        createdAt: "2026-11-22T06:00:00.000Z",
      };
      let files = [receipt];
      const put = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(null, { status: 200 }));
      const calls = api({
        "GET /vehicles": () => okPage([victoris]),
        [`GET /trips/${jaipur.id}`]: () => ok(jaipur),
        [`GET /trips/${jaipur.id}/costs`]: () => okPage([toll]),
        [`GET /trips/${jaipur.id}/fuel-entries`]: () => okPage([]),
        [`GET /trips/${jaipur.id}/spending`]: () => fail(404, "NOT_FOUND", "Not found"),
        [`GET /trips/${jaipur.id}/attachments`]: () => okPage(files),
        [`POST /trips/${jaipur.id}/attachments/uploads`]: () =>
          ok(
            {
              fileId: "f2",
              url: "http://storage.test/put/f2",
              headers: { "content-type": "image/png" },
              expiresAt: "",
            },
            201,
          ),
        [`POST /trips/${jaipur.id}/attachments/f2/confirm`]: () => {
          const photo: TripAttachment = {
            ...receipt,
            id: "f2",
            costId: null,
            fileName: "pass.png",
            contentType: "image/png",
          };
          files = [...files, photo];
          return ok(photo);
        },
        [`GET /trips/${jaipur.id}/attachments/f2/link`]: () =>
          ok({ url: "http://storage.test/get/f2", expiresAt: "" }),
      });
      renderApp(`/trips/${jaipur.id}`);
      const user = userEvent.setup();

      const panel = within(
        (await screen.findByText("Photos & receipts")).closest("[data-slot=card]") as HTMLElement,
      );
      expect(await panel.findByText("toll.pdf")).toBeInTheDocument();
      expect(panel.getByText("Receipt for Toll · ₹320.00")).toBeInTheDocument();
      expect(panel.getByText("1 of 20")).toBeInTheDocument();

      // A wrong type is refused before anything is sent.
      // As a browser's "All files" choice would: past the picker's own filter.
      await userEvent
        .setup({ applyAccept: false })
        .upload(
          panel.getByLabelText("Upload photos & receipts"),
          new File(["x"], "notes.txt", { type: "text/plain" }),
        );
      expect(await panel.findByText("Use a PDF, JPEG, PNG, WebP or HEIC file")).toBeInTheDocument();

      await user.upload(
        panel.getByLabelText("Upload photos & receipts"),
        new File(["png"], "pass.png", { type: "image/png" }),
      );
      expect(await panel.findByText("pass.png")).toBeInTheDocument();
      expect(bodyOf(calls.find((call) => call.url?.endsWith("/attachments/uploads")))).toEqual({
        fileName: "pass.png",
        contentType: "image/png",
        size: 3,
      });
      expect(put).toHaveBeenCalledWith(
        "http://storage.test/put/f2",
        expect.objectContaining({ method: "PUT" }),
      );
      expect(await panel.findByText("2 of 20")).toBeInTheDocument();
      put.mockRestore();
    },
  );
});
