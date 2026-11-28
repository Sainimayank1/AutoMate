import type { Trip, TripCategory, TripOverview } from "@automate/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSessionStore } from "@/stores/session-store";
import { useActiveVehicleStore } from "@/stores/vehicle-store";
import { fail, mockApi, type MockReply, ok, okPage, testUser, testVehicle } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";

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
