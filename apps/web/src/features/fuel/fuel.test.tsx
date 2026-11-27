import type { FuelEntry, FuelSummary } from "@automate/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useSessionStore } from "@/stores/session-store";
import { useActiveVehicleStore } from "@/stores/vehicle-store";
import { fail, mockApi, type MockReply, ok, okPage, testUser, testVehicle } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";

const victoris = testVehicle();
const ENTRIES = `/vehicles/${victoris.id}/fuel-entries`;
const SUMMARY = `/vehicles/${victoris.id}/fuel-summary`;

const entry = (overrides: Partial<FuelEntry> = {}): FuelEntry => ({
  id: "0190d4a2-0000-7000-8000-00000000f001",
  vehicleId: victoris.id,
  filledAt: "2026-11-24T08:30:00.000Z",
  odometerKm: 8412,
  fuelType: "PETROL",
  quantity: "32.400",
  pricePerUnit: "104.320",
  totalAmount: "3380.00",
  isFullTank: true,
  missedPrevious: false,
  stationName: "IndianOil XP95",
  latitude: null,
  longitude: null,
  location: null,
  paymentMethod: "UPI",
  notes: null,
  distanceKm: 548,
  mileage: "16.91",
  mileageStatus: "CALCULATED",
  createdAt: "2026-11-24T08:31:00.000Z",
  updatedAt: "2026-11-24T08:31:00.000Z",
  ...overrides,
});

const history = [
  entry(),
  entry({
    id: "0190d4a2-0000-7000-8000-00000000f002",
    filledAt: "2026-11-09T08:30:00.000Z",
    odometerKm: 8100,
    quantity: "14.200",
    totalAmount: "1481.34",
    isFullTank: false,
    stationName: "Shell V-Power",
    paymentMethod: "CARD",
    mileage: null,
    mileageStatus: "ROLLED_IN",
  }),
  entry({
    id: "0190d4a2-0000-7000-8000-00000000f003",
    filledAt: "2026-10-26T08:30:00.000Z",
    odometerKm: 7864,
    stationName: "HP Power95",
    distanceKm: null,
    mileage: null,
    mileageStatus: "BASELINE",
  }),
];

const summary = (overrides: Partial<FuelSummary> = {}): FuelSummary => ({
  fuelType: "PETROL",
  fillCount: 3,
  totalSpend: "8241.34",
  totalQuantity: "79.000",
  averagePrice: "104.32",
  averageMileage: "16.84",
  mileageSequences: 1,
  lastMileage: { date: "2026-11-24T08:30:00.000Z", mileage: "16.91" },
  bestMileage: { date: "2026-11-24T08:30:00.000Z", mileage: "16.91" },
  worstMileage: { date: "2026-11-24T08:30:00.000Z", mileage: "16.91" },
  costPerKm: "6.25",
  thisMonth: { spend: "4861.34", fillCount: 2, quantity: "46.600" },
  trend: [{ date: "2026-11-24T08:30:00.000Z", mileage: "16.91" }],
  ...overrides,
});

type Routes = Record<
  string,
  (config: InternalAxiosRequestConfig) => MockReply | Promise<MockReply>
>;

/** Answers by "METHOD url"; everything else is a 404. */
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

/** jsdom has no geolocation; give the test a device that answers (or refuses). */
function stubGeolocation(answer: { latitude: number; longitude: number } | "denied") {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (
        success: (position: { coords: { latitude: number; longitude: number } }) => void,
        failure: (error: { code: number; PERMISSION_DENIED: number }) => void,
      ) =>
        answer === "denied"
          ? failure({ code: 1, PERMISSION_DENIED: 1 })
          : success({ coords: answer }),
    },
  });
}
afterEach(() => {
  Reflect.deleteProperty(navigator, "geolocation");
});

describe("fuel page", () => {
  it("asks for a vehicle first", async () => {
    api({ "GET /vehicles": () => okPage([]) });
    renderApp("/fuel");
    expect(await screen.findByText("Add a vehicle first")).toBeInTheDocument();
  });

  it("invites the first fill-up", async () => {
    api({
      "GET /vehicles": () => okPage([victoris]),
      [`GET ${ENTRIES}`]: () => okPage([]),
      [`GET ${SUMMARY}`]: () => ok(summary({ fillCount: 0, averageMileage: null })),
    });
    renderApp("/fuel");
    expect(await screen.findByRole("heading", { name: "No fill-ups yet" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("main")).getAllByRole("link", { name: "Add fuel" })[0],
    ).toHaveAttribute("href", "/fuel/new");
  });

  it("shows the API's figures, explains missing mileage, filters and deletes", async () => {
    const calls = api({
      "GET /vehicles": () => okPage([victoris]),
      // The API filters: answer like it does for `tank`.
      [`GET ${ENTRIES}`]: (config) => {
        const tank = (config.params as { tank?: string }).tank;
        return okPage(tank ? history.filter((e) => e.isFullTank === (tank === "full")) : history);
      },
      [`GET ${SUMMARY}`]: () => ok(summary()),
      [`DELETE ${ENTRIES}/${history[1]!.id}`]: () => ({ status: 204 }),
    });
    renderApp("/fuel");
    const user = userEvent.setup();

    expect(await screen.findByText("16.8 km/L")).toBeInTheDocument();
    expect(screen.getByText("From 1 full-tank sequence")).toBeInTheDocument();
    expect(screen.getByText("₹4,861.34")).toBeInTheDocument();
    expect(screen.getByText("₹6.25")).toBeInTheDocument();
    // One sequence: no best-vs-lowest comparison, no single-point trend line.
    expect(screen.getByText(/Best and lowest appear once/)).toBeInTheDocument();
    expect(screen.getByText(/The trend appears after three full-tank fills/)).toBeInTheDocument();

    // Mileage only on the full tank that closes a sequence; the others say why.
    const table = screen.getByRole("table");
    expect(await within(table).findByText("16.9 km/L")).toBeInTheDocument();
    expect(within(table).getByText("In next full tank")).toBeInTheDocument();
    expect(within(table).getByText("Baseline")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Partial tank" }));
    await waitFor(() =>
      expect(within(table).queryByText(/IndianOil XP95/)).not.toBeInTheDocument(),
    );
    expect(calls.at(-1)?.params).toMatchObject({ page: 1, tank: "partial" });
    expect(within(table).getByText("Shell V-Power · Partial")).toBeInTheDocument();

    await user.click(within(table).getByRole("button", { name: "Actions for 09/11/2026 fill-up" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete this fill-up?" });
    expect(within(dialog).getByText(/14.2 L \(₹1,481.34\)/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(calls.some((call) => call.method === "delete")).toBe(true));
    expect(await screen.findByText("Fill-up deleted.")).toBeInTheDocument();
  });
});

describe("fuel history paging", () => {
  it("asks the API for the next page and for a search, from page 1", async () => {
    const calls = api({
      "GET /vehicles": () => okPage([victoris]),
      [`GET ${SUMMARY}`]: () => ok(summary({ fillCount: 25 })),
      [`GET ${ENTRIES}`]: (config) => {
        const { page = 1, search } = config.params as { page?: number; search?: string };
        if (search) return okPage([history[1]!], { total: 1 });
        return okPage(page === 1 ? [history[0]!] : [history[2]!], {
          page,
          total: 25,
          totalPages: 2,
        });
      },
    });
    renderApp("/fuel");
    const user = userEvent.setup();

    const table = await screen.findByRole("table");
    expect(await within(table).findByText("IndianOil XP95 · Full")).toBeInTheDocument();
    expect(screen.getByText("25 fill-ups")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(await within(table).findByText("HP Power95 · Full")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Search fill-ups" }), "shell");
    expect(await within(table).findByText("Shell V-Power · Partial")).toBeInTheDocument();
    const searched = calls.filter((call) => call.url === ENTRIES).at(-1);
    expect(searched?.params).toMatchObject({ page: 1, search: "shell" });
    expect(screen.queryByText(/^Page \d/)).not.toBeInTheDocument();
  });
});

describe("fuel history range", () => {
  it("moves back to the last page when the list shrinks under it", async () => {
    let shrunk = false;
    const calls = api({
      "GET /vehicles": () => okPage([victoris]),
      [`GET ${SUMMARY}`]: () => ok(summary({ fillCount: 21 })),
      [`GET ${ENTRIES}`]: (config) => {
        const { page = 1 } = config.params as { page?: number };
        if (page === 2) {
          shrunk = true; // e.g. deleted in another tab: page 2 no longer exists
          return okPage([], { page: 2, total: 20, totalPages: 1 });
        }
        return okPage([history[0]!], { total: shrunk ? 20 : 21, totalPages: shrunk ? 1 : 2 });
      },
    });
    renderApp("/fuel");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Next page" }));
    expect(
      await within(screen.getByRole("table")).findByText("IndianOil XP95 · Full"),
    ).toBeInTheDocument();
    // Page 2 was asked for, came back past the end, and page 1 (cached) is shown instead.
    expect(calls.filter((call) => call.url === ENTRIES).at(-1)?.params).toMatchObject({ page: 2 });
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
  });
});

describe("add fuel", () => {
  it("fills the total from quantity × price, shows the API's odometer error, then saves", async () => {
    let attempts = 0;
    const calls = api({
      "GET /vehicles": () => okPage([victoris]),
      [`GET ${ENTRIES}`]: () => okPage(history),
      [`GET ${SUMMARY}`]: () => ok(summary()),
      [`POST ${ENTRIES}`]: () =>
        ++attempts === 1
          ? fail(409, "CONFLICT", "Lower than 8,412 km", [
              { field: "odometerKm", message: "Lower than 8,412 km, recorded on 24/11/2026." },
            ])
          : ok(entry({ id: "0190d4a2-0000-7000-8000-00000000f009" }), 201),
    });
    const router = renderApp("/fuel/new");
    const user = userEvent.setup();

    // The last price and payment method are carried over.
    const price = await screen.findByLabelText("Price per L");
    expect(price).toHaveValue("104.32");
    expect(screen.getByText("Last reading: 8,412 km on 24/11/2026")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Odometer reading"), "8000");
    await user.type(screen.getByLabelText("Quantity (L)"), "32.4");
    expect(screen.getByLabelText("Total amount")).toHaveValue("3,379.97");

    await user.click(screen.getByRole("button", { name: "Save fuel log" }));
    expect(
      await screen.findByText("Lower than 8,412 km, recorded on 24/11/2026."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Odometer reading")).toHaveFocus();

    // What was actually paid wins over the computed amount.
    await user.clear(screen.getByLabelText("Odometer reading"));
    await user.type(screen.getByLabelText("Odometer reading"), "8960");
    await user.clear(screen.getByLabelText("Total amount"));
    await user.type(screen.getByLabelText("Total amount"), "3380");
    await user.click(screen.getByRole("button", { name: "Save fuel log" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/fuel"));
    const body = bodyOf(
      calls.filter((call) => call.method === "post" && call.url === ENTRIES).at(-1),
    );
    expect(body).toMatchObject({
      odometerKm: 8960,
      fuelType: "PETROL",
      quantity: "32.4",
      pricePerUnit: "104.32",
      totalAmount: "3380",
      isFullTank: true,
      missedPrevious: false,
      paymentMethod: "UPI",
      stationName: null,
    });
    expect(body).not.toHaveProperty("vehicleId");
    expect(Date.parse(String(body.filledAt))).not.toBeNaN();
    expect(useActiveVehicleStore.getState().activeVehicleId).toBe(victoris.id);
  });

  it("warns (without blocking) when a new reading is below the vehicle's odometer", async () => {
    api({ "GET /vehicles": () => okPage([victoris]), [`GET ${ENTRIES}`]: () => okPage([]) });
    renderApp("/fuel/new");
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Odometer reading"), "845");
    expect(screen.getByText(/Lower than the vehicle's odometer \(8,450 km\)/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Odometer reading"), "00");
    expect(screen.queryByText(/Lower than the vehicle's odometer/)).not.toBeInTheDocument();
  });

  it("blocks a total that doesn't match quantity × price", async () => {
    api({ "GET /vehicles": () => okPage([victoris]), [`GET ${ENTRIES}`]: () => okPage([]) });
    renderApp("/fuel/new");
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Odometer reading"), "8500");
    await user.type(screen.getByLabelText("Quantity (L)"), "10");
    await user.type(screen.getByLabelText("Price per L"), "100");
    await user.clear(screen.getByLabelText("Total amount"));
    await user.type(screen.getByLabelText("Total amount"), "1500");
    await user.click(screen.getByRole("button", { name: "Save fuel log" }));

    expect(
      await screen.findByText("Doesn't match quantity × price (₹1,000.00)"),
    ).toBeInTheDocument();
  });
});

describe("fill-up location", () => {
  it("records the device's position and its address, read-only, and saves both", async () => {
    stubGeolocation({ latitude: 28.45950123, longitude: 77.07260456 });
    const calls = api({
      "GET /vehicles": () => okPage([victoris]),
      [`GET ${ENTRIES}`]: () => okPage([]),
      "POST /geocode/reverse": () =>
        ok({ address: "IndianOil COCO, Sector 29, Gurugram, Haryana" }),
      [`POST ${ENTRIES}`]: () => ok(entry(), 201),
    });
    const router = renderApp("/fuel/new");
    const user = userEvent.setup();

    const location = await screen.findByLabelText(/Location/);
    await waitFor(() =>
      expect(location).toHaveValue("IndianOil COCO, Sector 29, Gurugram, Haryana"),
    );
    expect(location).toHaveAttribute("readonly");
    expect(bodyOf(calls.find((call) => call.url === "/geocode/reverse"))).toEqual({
      latitude: 28.459501,
      longitude: 77.072605,
    });

    await user.type(screen.getByLabelText("Odometer reading"), "8500");
    await user.type(screen.getByLabelText("Quantity (L)"), "10");
    await user.type(screen.getByLabelText("Price per L"), "100");
    await user.click(screen.getByRole("button", { name: "Save fuel log" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/fuel"));
    expect(
      bodyOf(calls.find((call) => call.method === "post" && call.url === ENTRIES)),
    ).toMatchObject({
      latitude: 28.459501,
      longitude: 77.072605,
      location: "IndianOil COCO, Sector 29, Gurugram, Haryana",
    });
  });

  it("keeps a location removed while its address was still loading", async () => {
    stubGeolocation({ latitude: 28.4595, longitude: 77.0726 });
    let answer: (reply: MockReply) => void = () => {};
    const calls = api({
      "GET /vehicles": () => okPage([victoris]),
      [`GET ${ENTRIES}`]: () => okPage([]),
      "POST /geocode/reverse": () => new Promise<MockReply>((resolve) => (answer = resolve)),
      [`POST ${ENTRIES}`]: () => ok(entry(), 201),
    });
    const router = renderApp("/fuel/new");
    const user = userEvent.setup();

    expect(await screen.findByLabelText(/Location/)).toHaveValue("Looking up the address…");
    await user.click(screen.getByRole("button", { name: "Remove location" }));
    answer(ok({ address: "Sector 29, Gurugram, Haryana" }));
    await waitFor(() => expect(screen.getByLabelText(/Location/)).toHaveValue("Not recorded"));

    await user.type(screen.getByLabelText("Odometer reading"), "8500");
    await user.type(screen.getByLabelText("Quantity (L)"), "10");
    await user.type(screen.getByLabelText("Price per L"), "100");
    await user.click(screen.getByRole("button", { name: "Save fuel log" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/fuel"));
    expect(
      bodyOf(calls.find((call) => call.method === "post" && call.url === ENTRIES)),
    ).toMatchObject({ latitude: null, longitude: null, location: null });
  });

  it("saves without a location when access is blocked, and can leave a found one out", async () => {
    stubGeolocation("denied");
    const calls = api({
      "GET /vehicles": () => okPage([victoris]),
      [`GET ${ENTRIES}`]: () => okPage([]),
      "POST /geocode/reverse": () => ok({ address: null }),
      [`POST ${ENTRIES}`]: () => ok(entry(), 201),
    });
    const router = renderApp("/fuel/new");
    const user = userEvent.setup();

    expect(await screen.findByLabelText(/Location/)).toHaveValue(
      "Location access is blocked for this site",
    );

    // Allowed on retry; no address found, so the coordinates show.
    stubGeolocation({ latitude: 28.4595, longitude: 77.0726 });
    await user.click(screen.getByRole("button", { name: "Refresh location" }));
    await waitFor(() =>
      expect(screen.getByLabelText(/Location/)).toHaveValue("28.45950, 77.07260"),
    );

    await user.click(screen.getByRole("button", { name: "Remove location" }));
    expect(screen.getByLabelText(/Location/)).toHaveValue("Not recorded");

    await user.type(screen.getByLabelText("Odometer reading"), "8500");
    await user.type(screen.getByLabelText("Quantity (L)"), "10");
    await user.type(screen.getByLabelText("Price per L"), "100");
    await user.click(screen.getByRole("button", { name: "Save fuel log" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/fuel"));
    expect(
      bodyOf(calls.find((call) => call.method === "post" && call.url === ENTRIES)),
    ).toMatchObject({
      latitude: null,
      longitude: null,
      location: null,
    });
  });
});

describe("edit fuel", () => {
  it("loads the fill-up and sends only what changed, keeping the amount paid", async () => {
    const target = history[1]!;
    const calls = api({
      [`GET /vehicles/${victoris.id}`]: () => ok(victoris),
      "GET /vehicles": () => okPage([victoris]),
      [`GET ${ENTRIES}`]: () => okPage(history),
      [`GET ${SUMMARY}`]: () => ok(summary()),
      [`GET ${ENTRIES}/${target.id}`]: () => ok(target),
      [`PATCH ${ENTRIES}/${target.id}`]: (config) => ok({ ...target, ...bodyOf(config) }),
    });
    const router = renderApp(`/fuel/${victoris.id}/${target.id}/edit`);
    const user = userEvent.setup();

    expect(await screen.findByLabelText("Quantity (L)")).toHaveValue("14.2");
    expect(screen.getByRole("radio", { name: /Partial tank/ })).toBeChecked();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    // The vehicle can't change on edit.
    expect(screen.queryByLabelText("Vehicle")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Notes (optional)"), "Highway run");
    // Correcting the price doesn't rewrite what was paid.
    await user.clear(screen.getByLabelText("Price per L"));
    await user.type(screen.getByLabelText("Price per L"), "104.4");
    expect(screen.getByLabelText("Total amount")).toHaveValue("1,481.34");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/fuel"));
    expect(bodyOf(calls.find((call) => call.method === "patch"))).toEqual({
      notes: "Highway run",
      pricePerUnit: "104.4",
    });
  });
});
