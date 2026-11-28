import type {
  Expense,
  ExpenseCategory,
  ExpenseDetail,
  ExpenseSummary,
  ExpenseTrend,
  RecurringPayment,
} from "@automate/shared";
import { act, screen, waitFor, within } from "@testing-library/react";
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
  registrationNumber: "DL8CAB5678",
});

const category = (
  id: string,
  key: string | null,
  name: string,
  costClass: ExpenseCategory["costClass"],
  subcategories: [string, string, string][] = [],
  overrides: Partial<ExpenseCategory> = {},
): ExpenseCategory => ({
  id,
  key,
  name,
  icon: "route",
  costClass,
  parentId: null,
  custom: key === null,
  active: true,
  usage: 0,
  subcategories: subcategories.map(([subId, subKey, subName]) => ({
    id: subId,
    key: subKey,
    name: subName,
    icon: "route",
    costClass,
    parentId: id,
    custom: false,
    active: true,
    usage: 0,
    subcategories: [],
  })),
  ...overrides,
});
const ID = (n: number) => `0190d4a2-0000-7000-8000-0000000c${String(n).padStart(4, "0")}`;
const categories: ExpenseCategory[] = [
  category(ID(1), "FUEL", "Fuel", "OPERATING", [[ID(11), "FUEL.PETROL", "Petrol"]]),
  category(ID(2), "DAILY_USAGE", "Daily usage", "OPERATING", [
    [ID(21), "DAILY_USAGE.TOLL", "Toll"],
    [ID(22), "DAILY_USAGE.PARKING", "Parking"],
  ]),
  category(ID(3), "FINANCE", "Finance", "FINANCING", [
    [ID(31), "FINANCE.EMI", "Vehicle EMI"],
    [ID(32), "FINANCE.INTEREST", "Loan interest"],
  ]),
  category(ID(4), null, "Driver salary", "OPERATING", [], { usage: 3 }),
];
const ref = (c: ExpenseCategory) => ({
  id: c.id,
  key: c.key,
  name: c.name,
  icon: c.icon,
  costClass: c.costClass,
});
const daily = categories[1]!;
const toll = daily.subcategories[0]!;

const expense = (overrides: Partial<Expense> = {}): Expense => ({
  id: "0190d4a2-0000-7000-8000-0000000e0001",
  vehicleId: victoris.id,
  kind: "EXPENSE",
  title: "Delhi–Jaipur Expressway",
  amount: "640.00",
  date: "2026-11-21",
  category: ref(daily),
  subcategory: ref(toll),
  paymentMethod: "UPI",
  vendor: null,
  odometerKm: null,
  description: null,
  notes: null,
  source: "MANUAL",
  sourceId: null,
  editable: true,
  refundOfId: null,
  refundReason: null,
  refundedAmount: "0.00",
  shared: null,
  finance: null,
  details: {
    serviceType: null,
    partsReplaced: null,
    partsAmount: null,
    labourAmount: null,
    warrantyUntil: null,
    provider: null,
    policyNumber: null,
    policyStart: null,
    policyEnd: null,
  },
  createdAt: "2026-11-21T08:00:00.000Z",
  updatedAt: "2026-11-21T08:00:00.000Z",
  ...overrides,
});
const detail = (base: Expense, overrides: Partial<ExpenseDetail> = {}): ExpenseDetail => ({
  ...base,
  refunds: [],
  group: [],
  ...overrides,
});

const fuelRow = expense({
  id: "0190d4a2-0000-7000-8000-0000000e0002",
  title: "IndianOil XP95",
  amount: "3070.55",
  date: "2026-11-24",
  category: ref(categories[0]!),
  subcategory: ref(categories[0]!.subcategories[0]!),
  source: "FUEL",
  sourceId: "0190d4a2-0000-7000-8000-00000000f001",
  editable: false,
});
const emiRow = expense({
  id: "0190d4a2-0000-7000-8000-0000000e0003",
  title: "HDFC Auto Loan",
  amount: "16684.00",
  date: "2026-11-05",
  category: ref(categories[2]!),
  subcategory: ref(categories[2]!.subcategories[0]!),
  finance: {
    principal: "10950.00",
    interest: "5734.00",
    charges: null,
    loanReference: null,
    loanOutstanding: "713295.00",
    loanId: null,
  },
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
const base: Routes = {
  "GET /vehicles": () => okPage([victoris, creta]),
  "GET /vehicles?archived": () => okPage([]),
  "GET /expense-categories": () => okPage(categories),
};
const bodyOf = (config: InternalAxiosRequestConfig | undefined) =>
  JSON.parse(String(config?.data)) as Record<string, unknown>;
const paramsOf = (config: InternalAxiosRequestConfig | undefined) =>
  (config?.params ?? {}) as Record<string, unknown>;

beforeEach(() => {
  useSessionStore.getState().setSession({ user: testUser, accessToken: "t" });
  useActiveVehicleStore.setState({ activeVehicleId: null });
});

const summary = (overrides: Partial<ExpenseSummary> = {}): ExpenseSummary => ({
  month: "2026-11",
  operating: {
    thisMonth: "11840.00",
    lastMonth: "12590.00",
    lastMonthWindow: { from: "2026-10-01", to: "2026-10-27" },
    changePercent: -6,
    thisYear: "87710.00",
    monthsCovered: 9,
    monthlyAverage: "9745.56",
  },
  costPerKm: "10.38",
  distanceKm: 8438,
  loanOutflowThisMonth: "16684.00",
  cashOutflowThisMonth: "28524.00",
  categories: [
    { category: ref(categories[0]!), amount: "7120.00", percent: 60.1 },
    { category: ref(daily), amount: "4720.00", percent: 39.9 },
  ],
  ...overrides,
});

describe("overview", () => {
  it("invites the first expense", async () => {
    api({
      ...base,
      "GET /expenses": () => okPage([]),
      "GET /expenses/summary": () =>
        ok(
          summary({
            operating: {
              thisMonth: "0.00",
              lastMonth: "0.00",
              lastMonthWindow: { from: "2026-10-01", to: "2026-10-27" },
              changePercent: null,
              thisYear: "0.00",
              monthsCovered: 0,
              monthlyAverage: null,
            },
            costPerKm: null,
            distanceKm: null,
            categories: [],
          }),
        ),
    });
    renderApp("/expenses");
    expect(await screen.findByText("No expenses yet")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
  });

  it("shows this month's figures, the breakdown and the latest expenses", async () => {
    const calls = api({
      ...base,
      "GET /expense-categories": () =>
        okPage(categories.map((c) => (c.key === "FUEL" ? { ...c, usage: 12 } : c))),
      "GET /expenses/summary": () => ok(summary()),
      "GET /expenses": () => okPage([fuelRow, expense(), emiRow], { total: 42, totalPages: 9 }),
    });
    renderApp("/expenses");
    const user = userEvent.setup();

    expect(await screen.findByText("₹11,840.00")).toBeInTheDocument();
    expect(paramsOf(calls.find((call) => call.url === "/expenses/summary"))).toEqual({
      vehicleId: victoris.id,
    });
    expect(screen.getByText("November 2026")).toBeInTheDocument();
    // Like for like: this month so far vs the same days of last month.
    expect(screen.getByText(/^-6% vs 1–27 Oct/)).toHaveClass("text-success");
    expect(screen.getByText("9 months")).toBeInTheDocument();
    expect(screen.getByText("₹10.38")).toBeInTheDocument();
    expect(screen.getByText("Over 8,438 km in 2026")).toBeInTheDocument();
    const kpis = screen.getByRole("region", { name: "This month and year" });
    expect(within(kpis).getByText("₹16,684.00")).toBeInTheDocument();
    expect(within(kpis).getByText("Of ₹28,524.00 paid this month")).toBeInTheDocument();
    expect(within(kpis).getByText("Operating (Nov)")).toBeInTheDocument();

    const breakdown = screen.getByRole("region", { name: "Category breakdown" });
    expect(within(breakdown).getByRole("progressbar", { name: /Fuel, 60%/ })).toBeInTheDocument();
    expect(within(breakdown).getByText("₹7,120.00")).toBeInTheDocument();

    const recent = screen.getByRole("region", { name: "Recent expenses" });
    expect(await within(recent).findByText("Showing 3 of 42")).toBeInTheDocument();
    expect(paramsOf(calls.find((call) => call.url === "/expenses"))).toMatchObject({
      pageSize: 5,
      vehicleId: victoris.id,
    });
    // Chips are the most used categories; one narrows the list and "View all".
    await user.click(within(recent).getByRole("button", { name: "Driver salary" }));
    await waitFor(() =>
      expect(paramsOf(calls.filter((call) => call.url === "/expenses").at(-1))).toMatchObject({
        categoryId: ID(4),
      }),
    );
    expect(within(recent).getByRole("link", { name: "View all" })).toHaveAttribute(
      "href",
      `/expenses/transactions?category=${ID(4)}`,
    );
  });

  it("charts the last 12 months beside last year, and lists what's due next", async () => {
    const groups = (fuel: string) => ({
      fuel,
      maintenance: "0.00",
      insurance: "0.00",
      loan: "0.00",
      other: "0.00",
    });
    const trend: ExpenseTrend = {
      months: [
        { month: "2026-10", total: "9000.00", groups: groups("9000.00"), lastYear: "8000.00" },
        { month: "2026-11", total: "7120.00", groups: groups("7120.00"), lastYear: null },
      ],
      total: "16120.00",
      previousTotal: null,
    };
    const payment: RecurringPayment = {
      recurringId: ID(100),
      vehicleId: victoris.id,
      title: "Society parking pass",
      category: ref(daily),
      dueDate: "2026-11-29",
      date: "2026-11-29",
      amount: "1500.00",
      state: "DUE",
      postponed: false,
      expenseId: null,
      loan: null,
    };
    const calls = api({
      ...base,
      "GET /expenses/summary": () => ok(summary()),
      "GET /expenses": () => okPage([expense()]),
      "GET /expenses/trend": () => ok(trend),
      "GET /recurring-expenses/payments": () => okPage([payment]),
    });
    renderApp("/expenses");

    // The chart re-renders once it's measured, so look it up again each time.
    await waitFor(() =>
      expect(
        screen.getByRole("img", { name: "Spending per month: Oct ₹9,000.00, Nov ₹7,120.00" }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/₹16,120.00 in the last 12 months · loan principal/),
    ).toBeInTheDocument();
    // Only once the vehicle scope is known: no unscoped request first.
    expect(calls.filter((call) => call.url === "/expenses/trend").map(paramsOf)).toEqual([
      { vehicleId: victoris.id },
    ]);

    const upcoming = within(
      screen.getByRole("heading", { name: "Upcoming payments" }).closest("[data-slot=card]")!,
    );
    expect(await upcoming.findByText("Society parking pass")).toBeInTheDocument();
    expect(upcoming.getByText("29/11/2026")).toBeInTheDocument();
    expect(upcoming.getByText("₹1,500.00")).toBeInTheDocument();
    expect(upcoming.getByRole("link", { name: "View all →" })).toHaveAttribute(
      "href",
      "/expenses/recurring",
    );
    expect(
      paramsOf(calls.find((call) => call.url === "/recurring-expenses/payments")),
    ).toMatchObject({ view: "upcoming", pageSize: 4, vehicleId: victoris.id });
  });
});

describe("transactions", () => {
  it("invites the first expense", async () => {
    api({ ...base, "GET /expenses": () => okPage([]) });
    renderApp("/expenses/transactions");
    expect(await screen.findByText("No expenses yet")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Transactions" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("lists the active vehicle's expenses, filters through the API and bulk-deletes", async () => {
    const calls = api({
      ...base,
      "GET /expenses": () =>
        okPage(
          [
            fuelRow,
            expense(),
            emiRow,
            expense({
              id: "0190d4a2-0000-7000-8000-0000000e0004",
              kind: "REFUND",
              title: "Refund · Parking",
              amount: "200.00",
              refundOfId: fuelRow.id,
              refundReason: "REFUND",
            }),
          ],
          { total: 42, totalPages: 3 },
        ),
      "POST /expenses/bulk/delete": () => ok({ affected: 1, skipped: 1 }),
    });
    renderApp("/expenses/transactions");
    const user = userEvent.setup();

    const table = await screen.findByRole("table");
    expect(await within(table).findByText("Delhi–Jaipur Expressway")).toBeInTheDocument();
    expect(paramsOf(calls.find((call) => call.url === "/expenses"))).toMatchObject({
      page: 1,
      vehicleId: victoris.id,
    });
    expect(screen.getByText("42 expenses")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    // Fuel rows link to their fill-up; EMIs show the split; refunds are negative.
    expect(within(table).getByRole("link", { name: "Fuel entry" })).toHaveAttribute(
      "href",
      `/fuel/${victoris.id}/${fuelRow.sourceId}/edit`,
    );
    expect(
      within(table).getByText(/Principal ₹10,950.00 · Interest ₹5,734.00/),
    ).toBeInTheDocument();
    expect(within(table).getByText("−₹200.00")).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Search expenses" }), "jaipur");
    await waitFor(() =>
      expect(paramsOf(calls.filter((call) => call.url === "/expenses").at(-1))).toMatchObject({
        search: "jaipur",
        page: 1,
      }),
    );

    await user.click(within(table).getByRole("checkbox", { name: "Select IndianOil XP95" }));
    await user.click(
      within(table).getByRole("checkbox", { name: "Select Delhi–Jaipur Expressway" }),
    );
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }),
    );
    await waitFor(() =>
      expect(bodyOf(calls.find((call) => call.url === "/expenses/bulk/delete"))).toEqual({
        ids: [fuelRow.id, expense().id],
      }),
    );
    expect(await screen.findByText(/1 expense deleted\. 1 skipped/)).toBeInTheDocument();
  });

  it("empties the search with Clear filters and steps back from an emptied last page", async () => {
    const calls = api({
      ...base,
      "GET /expenses": (config) =>
        paramsOf(config).page === 3
          ? okPage([], { page: 3, total: 40, totalPages: 2 })
          : okPage([expense()], { page: Number(paramsOf(config).page), total: 40, totalPages: 2 }),
    });
    const router = renderApp("/expenses/transactions?page=3");
    const user = userEvent.setup();

    await waitFor(() => expect(router.state.location.search).toBe("?page=2"));
    const search = await screen.findByRole("searchbox", { name: "Search expenses" });
    await user.type(search, "jaipur");
    await waitFor(() =>
      expect(paramsOf(calls.filter((call) => call.url === "/expenses").at(-1))).toMatchObject({
        search: "jaipur",
      }),
    );
    await user.click(screen.getAllByRole("button", { name: "Clear filters" })[0]!);
    await waitFor(() => expect(search).toHaveValue(""));
  });

  it("opens the details sheet with the loan split and records a refund", async () => {
    const wash = expense({ title: "3M Car Care", amount: "850.00" });
    const calls = api({
      ...base,
      "GET /expenses": () => okPage([wash, emiRow]),
      [`GET /expenses/${emiRow.id}`]: () => ok(detail(emiRow)),
      [`GET /expenses/${wash.id}`]: () => ok(detail(wash)),
      [`POST /expenses/${wash.id}/refunds`]: () =>
        ok(detail(wash, { refundedAmount: "300.00" }), 201),
    });
    const router = renderApp(`/expenses/transactions/${emiRow.id}`);
    const user = userEvent.setup();

    const sheet = await screen.findByRole("dialog");
    expect(await within(sheet).findByText("₹16,684.00")).toBeInTheDocument();
    expect(within(sheet).getByText("Loan split")).toBeInTheDocument();
    expect(within(sheet).getByText("₹7,13,295.00")).toBeInTheDocument();
    // Loan payments can't be refunded.
    expect(within(sheet).queryByRole("button", { name: "Add refund" })).not.toBeInTheDocument();

    await act(() => router.navigate(`/expenses/transactions/${wash.id}`));
    const washSheet = await screen.findByRole("dialog");
    expect(await within(washSheet).findByText("3M Car Care")).toBeInTheDocument();
    await user.click(await within(washSheet).findByRole("button", { name: "Add refund" }));
    const dialog = await screen.findByRole("dialog", { name: "Record a refund" });
    expect(within(dialog).getByText("Up to ₹850.00 not yet refunded")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Amount"), "300");
    await user.click(within(dialog).getByRole("button", { name: "Save refund" }));
    await waitFor(() =>
      expect(bodyOf(calls.find((call) => call.method === "post"))).toMatchObject({
        amount: "300",
        reason: "REFUND",
      }),
    );
  });
});

describe("add expense", () => {
  const saved = (body: Record<string, unknown>) =>
    ok(detail(expense({ id: String(body.id) })), 201);

  it("saves a single-vehicle expense with its category and a client id", async () => {
    const calls = api({
      ...base,
      "GET /expenses": () => okPage([expense()]),
      "POST /expenses": (config) => saved(bodyOf(config)),
      "GET /expenses/0190d4a2-0000-7000-8000-0000000e0001": () => ok(detail(expense())),
    });
    const router = renderApp("/expenses/new");
    const user = userEvent.setup();

    // Fuel isn't typed here: it links to the Fuel form.
    expect(await screen.findByRole("link", { name: /Fuel.*Log in Fuel/ })).toHaveAttribute(
      "href",
      "/fuel/new",
    );
    await user.click(screen.getByRole("button", { name: "Save expense" }));
    expect(await screen.findByText("Choose a category")).toBeInTheDocument();

    // "Recent" offers the last used category.
    await user.click(screen.getByRole("button", { name: "Toll" }));
    await user.type(screen.getByLabelText("Title"), "Delhi–Jaipur Expressway");
    await user.type(screen.getByLabelText("Amount"), "640");
    expect(within(screen.getByLabelText("Summary")).getByText("₹640.00")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save expense" }));

    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(/^\/expenses\/transactions\//),
    );
    const body = bodyOf(calls.find((call) => call.method === "post"));
    expect(body).toMatchObject({
      allocation: { mode: "single", vehicleId: victoris.id },
      categoryId: daily.id,
      subcategoryId: toll.id,
      title: "Delhi–Jaipur Expressway",
      amount: "640",
      principalAmount: null,
    });
    expect(String(body.id)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("keeps one client id when a failed save is retried", async () => {
    let attempts = 0;
    const calls = api({
      ...base,
      "GET /expenses": () => okPage([expense()]),
      "POST /expenses": (config) =>
        ++attempts === 1
          ? fail(503, "SERVICE_UNAVAILABLE", "Try again in a moment")
          : saved(bodyOf(config)),
      "GET /expenses/0190d4a2-0000-7000-8000-0000000e0001": () => ok(detail(expense())),
    });
    renderApp("/expenses/new");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Toll" }));
    await user.type(screen.getByLabelText("Title"), "Delhi–Jaipur Expressway");
    await user.type(screen.getByLabelText("Amount"), "640");
    await user.click(screen.getByRole("button", { name: "Save expense" }));
    await waitFor(() => expect(attempts).toBe(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save expense" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Save expense" }));
    await waitFor(() => expect(attempts).toBe(2));
    const [first, second] = calls.filter((call) => call.method === "post").map(bodyOf);
    expect(second!.id).toBe(first!.id);
  });

  it("edits a loan-interest payment's amount (its split follows the amount)", async () => {
    const interest = expense({
      id: "0190d4a2-0000-7000-8000-0000000e0009",
      title: "HDFC Auto Loan interest",
      amount: "5734.00",
      category: ref(categories[2]!),
      subcategory: ref(categories[2]!.subcategories[1]!),
      finance: {
        principal: null,
        interest: "5734.00",
        charges: null,
        loanReference: null,
        loanOutstanding: null,
        loanId: null,
      },
    });
    const calls = api({
      ...base,
      "GET /expenses": () => okPage([interest]),
      [`GET /expenses/${interest.id}`]: () => ok(detail(interest)),
      [`PATCH /expenses/${interest.id}`]: () => ok(detail(interest)),
    });
    const router = renderApp(`/expenses/${interest.id}/edit`);
    const user = userEvent.setup();

    const amount = await screen.findByLabelText("Amount");
    await user.clear(amount);
    await user.type(amount, "6000");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/expenses/transactions/${interest.id}`),
    );
    expect(bodyOf(calls.find((call) => call.method === "patch"))).toMatchObject({
      amount: "6000",
      principalAmount: null,
      interestAmount: "6000",
      chargesAmount: null,
    });
  });

  it("shares an expense equally and fills a preset loan component", async () => {
    const calls = api({
      ...base,
      "GET /expenses": () => okPage([]),
      "POST /expenses": (config) => saved(bodyOf(config)),
      "GET /expenses/0190d4a2-0000-7000-8000-0000000e0001": () => ok(detail(expense())),
    });
    renderApp("/expenses/new");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("radio", { name: "Shared" }));
    await user.click(screen.getByRole("checkbox", { name: /Maruti Suzuki Victoris/ }));
    await user.click(screen.getByRole("checkbox", { name: /Hyundai Creta/ }));
    await user.click(screen.getByRole("radio", { name: "Daily usage" }));
    await user.type(screen.getByLabelText("Title"), "FASTag annual");
    await user.type(screen.getByLabelText("Amount"), "1000.01");
    const summary = screen.getByLabelText("Summary");
    expect(within(summary).getByText("₹500.01")).toBeInTheDocument();
    expect(within(summary).getByText("₹500.00")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save expense" }));
    await waitFor(() =>
      expect(bodyOf(calls.find((call) => call.method === "post"))).toMatchObject({
        allocation: {
          mode: "shared",
          split: "equal",
          vehicles: [{ vehicleId: victoris.id }, { vehicleId: creta.id }],
        },
        amount: "1000.01",
      }),
    );
  });

  it("puts a loan-interest payment entirely in interest", async () => {
    const calls = api({
      ...base,
      "GET /expenses": () => okPage([]),
      "POST /expenses": (config) => saved(bodyOf(config)),
      "GET /expenses/0190d4a2-0000-7000-8000-0000000e0001": () => ok(detail(expense())),
    });
    renderApp("/expenses/new");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("radio", { name: "Finance" }));
    await user.click(screen.getByRole("combobox", { name: /Subcategory/ }));
    await user.click(await screen.findByRole("option", { name: "Loan interest" }));
    expect(screen.getByText(/The whole amount counts as interest/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Title"), "Interest for November");
    await user.type(screen.getByLabelText("Amount"), "5734");
    await user.click(screen.getByRole("button", { name: "Save expense" }));
    await waitFor(() =>
      expect(bodyOf(calls.find((call) => call.method === "post"))).toMatchObject({
        categoryId: categories[2]!.id,
        interestAmount: "5734",
        principalAmount: null,
        chargesAmount: null,
      }),
    );
  });
});

describe("categories", () => {
  it("shows built-in and custom categories, and adds one", async () => {
    const calls = api({
      ...base,
      "POST /expense-categories": (config) =>
        ok({ ...categories[3]!, id: ID(5), name: String(bodyOf(config).name), usage: 0 }, 201),
    });
    renderApp("/expenses/categories");
    const user = userEvent.setup();

    expect(await screen.findByText("Built-in categories")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Daily usage" })).not.toBeInTheDocument();
    // Used custom categories can't be deleted, only disabled.
    expect(screen.getByRole("button", { name: "Delete Driver salary" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Disable Driver salary" })).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Add category" }));
    const dialog = await screen.findByRole("dialog", { name: "Add category" });
    await user.type(within(dialog).getByLabelText("Name"), "Chauffeur");
    await user.click(within(dialog).getByRole("button", { name: "Add category" }));
    expect(await within(dialog).findByText("Choose what kind of cost this is")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("combobox", { name: "Cost type" }));
    await user.click(await screen.findByRole("option", { name: "Running cost" }));
    await user.click(within(dialog).getByRole("radio", { name: "car" }));
    await user.click(within(dialog).getByRole("button", { name: "Add category" }));
    await waitFor(() =>
      expect(bodyOf(calls.find((call) => call.method === "post"))).toEqual({
        name: "Chauffeur",
        icon: "car",
        costClass: "OPERATING",
      }),
    );
  });
});

describe("receipts", () => {
  it("shows an expense's receipts and deletes one after confirming", async () => {
    const wash = expense({ title: "3M Car Care", amount: "850.00" });
    const receipt = {
      id: "0190d4a2-0000-7000-8000-0000000a0001",
      fileName: "car-care-invoice.pdf",
      contentType: "application/pdf",
      size: 182_000,
      createdAt: "2026-11-21T08:05:00.000Z",
    };
    const calls = api({
      ...base,
      "GET /expenses": () => okPage([wash]),
      [`GET /expenses/${wash.id}`]: () => ok(detail(wash)),
      "GET /attachments": () => okPage([receipt]),
      [`DELETE /attachments/${receipt.id}`]: () => ok(null, 204),
    });
    renderApp(`/expenses/transactions/${wash.id}`);
    const user = userEvent.setup();

    const sheet = within(await screen.findByRole("dialog"));
    const files = within(await sheet.findByRole("list", { name: "Receipts" }));
    expect(files.getByText("car-care-invoice.pdf")).toBeInTheDocument();
    expect(calls.find((call) => call.url === "/attachments")?.params).toMatchObject({
      owner: "expense",
      ownerId: wash.id,
    });

    await user.click(files.getByRole("button", { name: "Actions for car-care-invoice.pdf" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    const confirm = within(await screen.findByRole("alertdialog"));
    await user.click(confirm.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(calls.some((call) => call.method === "delete" && call.url?.endsWith(receipt.id))).toBe(
        true,
      ),
    );
  });
});
