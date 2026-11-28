import type { Vehicle, VehicleTransfer } from "@automate/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it } from "vitest";

import { useSessionStore } from "@/stores/session-store";
import { useActiveVehicleStore } from "@/stores/vehicle-store";
import { fail, mockApi, type MockReply, ok, okPage, testUser, testVehicle } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";

const victoris = testVehicle();
const creta = testVehicle({
  id: "0190d4a2-0000-7000-8000-00000000a002",
  make: "Hyundai",
  model: "Creta",
  variant: "SX(O)",
  registrationNumber: "DL8CAB5678",
  fuelType: "DIESEL",
  transmission: "AUTOMATIC",
  ownershipType: "FINANCED",
  odometerKm: 42180,
});

type Routes = Record<string, (config: InternalAxiosRequestConfig) => MockReply>;

/** Answers by "METHOD url" (query string ignored); everything else is a 404. */
function api(routes: Routes) {
  return mockApi((config) => {
    const key = `${(config.method ?? "get").toUpperCase()} ${config.url}`;
    const archived = (config.params as { archived?: boolean } | undefined)?.archived;
    return (
      routes[archived ? `${key}?archived` : key]?.(config) ?? fail(404, "NOT_FOUND", "Not found")
    );
  });
}
const garage = (inUse: Vehicle[], archived: Vehicle[] = []): Routes => ({
  "GET /vehicles": () => okPage(inUse),
  "GET /vehicles?archived": () => okPage(archived),
});
const bodyOf = (config: InternalAxiosRequestConfig | undefined) =>
  JSON.parse(String(config?.data)) as Record<string, unknown>;

beforeEach(() => {
  useSessionStore.getState().setSession({ user: testUser, accessToken: "t" });
  useActiveVehicleStore.setState({ activeVehicleId: null });
});

describe("garage", () => {
  it("welcomes a first-time user with one way forward", async () => {
    api(garage([]));
    renderApp("/garage");

    expect(await screen.findByRole("heading", { name: "No vehicles yet" })).toBeInTheDocument();
    const main = screen.getByRole("main");
    expect(within(main).getAllByRole("link", { name: "Add vehicle" })[0]).toHaveAttribute(
      "href",
      "/garage/new",
    );
    // The sidebar switcher offers the same next step.
    expect(screen.getByRole("link", { name: "Add your first vehicle" })).toBeInTheDocument();
  });

  it("lists vehicles with the active one marked, filters them and switches the active vehicle", async () => {
    api(garage([victoris, creta]));
    renderApp("/garage");
    const user = userEvent.setup();

    const victorisCard = await screen.findByRole("article", { name: "Maruti Suzuki Victoris" });
    const cretaCard = screen.getByRole("article", { name: "Hyundai Creta" });
    expect(within(victorisCard).getByText("Active vehicle")).toBeInTheDocument();
    expect(within(victorisCard).getByText("HR-26-EV-4821")).toBeInTheDocument();
    expect(within(victorisCard).getByText("8,450 km")).toBeInTheDocument();
    expect(within(cretaCard).getByText("Standby")).toBeInTheDocument();
    expect(screen.getByText(/2 vehicles · 50,630 km on the clock/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Diesel (1)" }));
    expect(
      screen.queryByRole("article", { name: "Maruti Suzuki Victoris" }),
    ).not.toBeInTheDocument();

    await user.click(within(cretaCard).getByRole("button", { name: "Set active" }));
    expect(useActiveVehicleStore.getState().activeVehicleId).toBe(creta.id);
    expect(within(cretaCard).getByText("Active vehicle")).toBeInTheDocument();
  });
});

describe("add vehicle wizard", () => {
  async function fillStepOne(user: ReturnType<typeof userEvent.setup>) {
    await user.type(await screen.findByLabelText("Manufacturer"), "Maruti Suzuki");
    await user.type(screen.getByLabelText("Model"), "Victoris");
    await user.type(screen.getByLabelText("Variant (optional)"), "LXI");
    await user.type(screen.getByLabelText("Manufacturing year"), "2025");
    await user.type(screen.getByLabelText("Registration number"), "hr-26-ev-4821");
    await user.click(screen.getByRole("radio", { name: "SUV" }));
  }
  const next = (user: ReturnType<typeof userEvent.setup>, label: string) =>
    user.click(screen.getByRole("button", { name: label }));

  it("validates each step, reviews, creates the vehicle and opens it as the active vehicle", async () => {
    const calls = api({
      ...garage([]),
      "POST /vehicles": () => ok(victoris, 201),
      [`GET /vehicles/${victoris.id}`]: () => ok(victoris),
    });
    const router = renderApp("/garage/new");
    const user = userEvent.setup();

    // Required fields block the step.
    await user.click(await screen.findByRole("button", { name: "Next: Specifications" }));
    expect(await screen.findByText("Choose the manufacturer")).toBeInTheDocument();
    expect(screen.getByText("Choose a category")).toBeInTheDocument();

    await fillStepOne(user);
    // Errors clear as soon as the field is fixed, including choice cards.
    await waitFor(() => expect(screen.queryByText("Choose a category")).not.toBeInTheDocument());
    expect(screen.queryByText("Choose the manufacturer")).not.toBeInTheDocument();
    await next(user, "Next: Specifications");
    expect(await screen.findByRole("radio", { name: "Petrol" })).toBeChecked();
    await user.type(screen.getByLabelText("Engine displacement (optional)"), "1462");
    await next(user, "Next: Ownership");

    await user.type(await screen.findByLabelText("Current odometer"), "8450");
    await user.type(screen.getByLabelText("Purchase price (optional)"), "1145000");
    expect(screen.getByLabelText("Purchase price (optional)")).toHaveValue("11,45,000");
    await next(user, "Next: Vehicle info");
    await next(user, "Next: Review");

    expect(await screen.findByText("HR-26-EV-4821")).toBeInTheDocument();
    expect(screen.getByText("₹11,45,000.00")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add vehicle to garage" }));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/garage/${victoris.id}`));
    const posted = bodyOf(calls.find((call) => call.method === "post"));
    expect(posted).toMatchObject({
      make: "Maruti Suzuki",
      model: "Victoris",
      manufacturingYear: 2025,
      registrationNumber: "HR26EV4821",
      category: "SUV",
      fuelType: "PETROL",
      engineCapacityCc: 1462,
      purchasePrice: "1145000",
      odometerKm: 8450,
      ownershipType: "OWNED",
      colour: null,
    });
    expect(useActiveVehicleStore.getState().activeVehicleId).toBe(victoris.id);
  });

  it("sends the user back to step 1 when the registration is already in the garage", async () => {
    api({
      ...garage([]),
      "POST /vehicles": () =>
        fail(409, "CONFLICT", "A vehicle in your garage already has this registration.", [
          {
            field: "registrationNumber",
            message: "A vehicle in your garage already has this registration.",
          },
        ]),
    });
    renderApp("/garage/new");
    const user = userEvent.setup();

    await fillStepOne(user);
    await next(user, "Next: Specifications");
    await next(user, "Next: Ownership");
    await user.type(await screen.findByLabelText("Current odometer"), "8450");
    await next(user, "Next: Vehicle info");
    await next(user, "Next: Review");
    await user.click(await screen.findByRole("button", { name: "Add vehicle to garage" }));

    expect(await screen.findByLabelText("Registration number")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(
      screen.getAllByText("A vehicle in your garage already has this registration.").length,
    ).toBeGreaterThan(0);
  });
});

describe("vehicle details", () => {
  it("shows the profile and lists missing details with a way to add them", async () => {
    api({ ...garage([victoris]), [`GET /vehicles/${victoris.id}`]: () => ok(victoris) });
    renderApp(`/garage/${victoris.id}`);
    const user = userEvent.setup();

    expect(await screen.findByText("Profile 63% complete")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Maruti Suzuki Victoris" }),
    ).toBeInTheDocument();
    expect(screen.getByText("₹11,45,000")).toBeInTheDocument();
    expect(screen.getByText("LXI · 1,462 cc Petrol · Manual · Pearl Silver")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Specifications" }));
    const engineOil = await screen.findByText("Engine oil");
    expect(engineOil.nextElementSibling).toHaveTextContent("Not added · Add");

    // "Add" opens the edit page on that exact field, focused.
    await user.click(screen.getByRole("link", { name: "Add engine oil" }));
    expect(await screen.findByLabelText("Engine oil (optional)")).toHaveFocus();
  });

  it("deletes only after the registration is typed, then returns to the garage", async () => {
    const calls = api({
      ...garage([victoris]),
      [`GET /vehicles/${victoris.id}`]: () => ok(victoris),
      [`DELETE /vehicles/${victoris.id}`]: () => ({ status: 204 }),
    });
    const router = renderApp(`/garage/${victoris.id}`);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete vehicle" }));
    const dialog = await screen.findByRole("alertdialog");
    const confirm = within(dialog).getByRole("button", { name: "Delete vehicle" });
    expect(confirm).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/to confirm/), "hr 26 ev 4821");
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    await waitFor(() => expect(router.state.location.pathname).toBe("/garage"));
    expect(calls.some((call) => call.method === "delete")).toBe(true);
  });
});

describe("edit vehicle", () => {
  it("focuses the field named in the link, including date pickers", async () => {
    api({ ...garage([victoris]), [`GET /vehicles/${victoris.id}`]: () => ok(victoris) });
    renderApp(`/garage/${victoris.id}/edit#warrantyExpiryDate`);

    expect(await screen.findByLabelText("Warranty expires (optional)")).toHaveFocus();
  });

  it("warns when the odometer goes down and saves the changes", async () => {
    const calls = api({
      ...garage([victoris]),
      [`GET /vehicles/${victoris.id}`]: () => ok(victoris),
      [`PATCH /vehicles/${victoris.id}`]: (config) => ok({ ...victoris, ...bodyOf(config) }),
    });
    const router = renderApp(`/garage/${victoris.id}/edit`);
    const user = userEvent.setup();

    const odometer = await screen.findByLabelText("Current odometer");
    expect(odometer).toHaveValue("8,450");
    expect(screen.getByLabelText("Registration number")).toHaveValue("HR-26-EV-4821");
    await user.clear(odometer);
    await user.type(odometer, "8200");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Lower than the saved reading of 8,450 km",
    );

    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/garage/${victoris.id}`));
    expect(bodyOf(calls.find((call) => call.method === "patch"))).toMatchObject({
      odometerKm: 8200,
      registrationNumber: "HR26EV4821",
    });
  });
});

describe("vehicle transfer", () => {
  const transfer = (overrides: Partial<VehicleTransfer> = {}): VehicleTransfer => ({
    id: "0190d4a2-0000-7000-8000-00000000f001",
    direction: "incoming",
    vehicleName: "Maruti Suzuki Victoris LXI",
    registrationNumber: "HR26EV4821",
    otherParty: { name: "Arjun Mehta", email: "arjun@example.test" },
    status: "PENDING",
    expiresAt: "2026-12-05T18:29:59.999Z",
    decidedAt: null,
    createdAt: "2026-11-28T06:00:00.000Z",
    vehicleId: null,
    ...overrides,
  });

  it("accepts a vehicle offered by another account and opens it", async () => {
    const calls = api({
      ...garage([creta]),
      "GET /vehicle-transfers": () => okPage([transfer()]),
      [`POST /vehicle-transfers/${transfer().id}/accept`]: () =>
        ok(transfer({ status: "ACCEPTED", vehicleId: victoris.id })),
      [`GET /vehicles/${victoris.id}`]: () => ok(victoris),
    });
    const router = renderApp("/garage");
    const user = userEvent.setup();

    const card = within(
      await screen.findByRole("region", {
        name: /Arjun Mehta \(arjun@example\.test\) wants to move Maruti Suzuki Victoris LXI/,
      }),
    );
    expect(card.getByText("Expires 05/12/2026")).toBeInTheDocument();
    await user.click(card.getByRole("button", { name: "Accept vehicle" }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/garage/${victoris.id}`));
    expect(calls.some((call) => call.url?.endsWith("/accept"))).toBe(true);
  });

  it("shows why a transfer can't be accepted", async () => {
    api({
      ...garage([creta]),
      "GET /vehicle-transfers": () => okPage([transfer()]),
      [`POST /vehicle-transfers/${transfer().id}/accept`]: () =>
        fail(409, "CONFLICT", "A vehicle with this registration is already in your garage."),
    });
    renderApp("/garage");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Accept vehicle" }));
    expect(
      await screen.findByText("A vehicle with this registration is already in your garage."),
    ).toBeInTheDocument();
  });

  it("sends a transfer request from the vehicle and shows it waiting", async () => {
    let sent: VehicleTransfer[] = [];
    const calls = api({
      ...garage([victoris]),
      [`GET /vehicles/${victoris.id}`]: () => ok(victoris),
      "GET /vehicle-transfers": () => okPage(sent),
      "POST /vehicle-transfers": () => {
        sent = [
          transfer({
            direction: "outgoing",
            otherParty: { name: null, email: "priya@example.test" },
          }),
        ];
        return ok(sent[0], 201);
      },
    });
    renderApp(`/garage/${victoris.id}`);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Transfer vehicle" }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.type(dialog.getByLabelText("Their account email"), "priya@example.test");
    await user.click(dialog.getByRole("button", { name: "Send transfer request" }));
    await waitFor(() =>
      expect(bodyOf(calls.find((call) => call.method === "post"))).toEqual({
        vehicleId: victoris.id,
        email: "priya@example.test",
      }),
    );
    expect(
      await screen.findByText(/Transfer to priya@example\.test waiting since 28\/11\/2026/),
    ).toBeInTheDocument();
  });
});
