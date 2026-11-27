import type {
  ExpenseCategory,
  LoanScheduleRow,
  RecurringExpense,
  RecurringPayment,
  VehicleLoan,
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
const ID = (n: number) => `0190d4a2-0000-7000-8000-0000000d${String(n).padStart(4, "0")}`;
const category = (
  id: string,
  key: string,
  name: string,
  costClass: ExpenseCategory["costClass"],
  subs: [string, string, string][] = [],
): ExpenseCategory => ({
  id,
  key,
  name,
  icon: "route",
  costClass,
  parentId: null,
  custom: false,
  active: true,
  usage: 0,
  subcategories: subs.map(([subId, subKey, subName]) => ({
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
});
const daily = category(ID(1), "DAILY_USAGE", "Daily usage", "OPERATING", [
  [ID(11), "DAILY_USAGE.PARKING", "Parking"],
]);
const finance = category(ID(2), "FINANCE", "Finance", "FINANCING", [
  [ID(21), "FINANCE.EMI", "Vehicle EMI"],
]);
const ref = (c: ExpenseCategory) => ({
  id: c.id,
  key: c.key,
  name: c.name,
  icon: c.icon,
  costClass: c.costClass,
});

const emi: RecurringPayment = {
  recurringId: ID(100),
  vehicleId: victoris.id,
  title: "HDFC Bank EMI",
  category: ref(finance),
  dueDate: "2026-11-05",
  date: "2026-11-05",
  amount: "16607.00",
  state: "OVERDUE",
  postponed: false,
  expenseId: null,
  loan: { loanId: ID(300), number: 20, of: 60, principal: "12129.00", interest: "4478.00" },
};
const parking: RecurringPayment = {
  ...emi,
  recurringId: ID(101),
  title: "Society parking pass",
  category: ref(daily),
  dueDate: "2026-11-29",
  date: "2026-11-29",
  amount: "1500.00",
  state: "DUE",
  loan: null,
};
const schedule: RecurringExpense = {
  id: ID(101),
  vehicleId: victoris.id,
  title: "Society parking pass",
  amount: "1500.00",
  category: ref(daily),
  subcategory: null,
  paymentMethod: null,
  vendor: null,
  notes: null,
  every: 1,
  unit: "MONTH",
  startDate: "2026-01-29",
  endDate: null,
  reminderDays: 3,
  status: "ACTIVE",
  loanId: null,
  next: parking,
  overdue: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const loan: VehicleLoan = {
  id: ID(300),
  vehicleId: victoris.id,
  lender: "HDFC Bank",
  accountNumber: "AL-0042",
  principal: "800000.00",
  annualRate: "9.00",
  tenureMonths: 60,
  firstEmiDate: "2025-04-05",
  method: "REDUCING",
  processingFee: null,
  emi: "16607.00",
  outstanding: "563204.00",
  paid: { principal: "236796.00", interest: "95345.00", charges: "0.00", emis: 19 },
  emisTotal: 60,
  endDate: "2030-03-05",
  totalInterest: "196412.00",
  next: { date: "2026-11-05", amount: "16607.00", principal: "12129.00", interest: "4478.00" },
  recurringId: ID(100),
  rateChanges: [],
  createdAt: "2025-04-01T00:00:00.000Z",
  updatedAt: "2025-04-01T00:00:00.000Z",
};

type Routes = Record<string, (config: InternalAxiosRequestConfig) => MockReply>;
function api(routes: Routes) {
  return mockApi((config) => {
    const key = `${(config.method ?? "get").toUpperCase()} ${config.url}`;
    return routes[key]?.(config) ?? fail(404, "NOT_FOUND", "Not found");
  });
}
const base: Routes = {
  "GET /vehicles": () => okPage([victoris]),
  "GET /expense-categories": () => okPage([daily, finance]),
  "GET /recurring-expenses/payments": () => okPage([emi, parking]),
  "GET /vehicle-loans": () => okPage([loan]),
  "GET /recurring-expenses": () => okPage([schedule]),
};
const bodyOf = (config: InternalAxiosRequestConfig | undefined) =>
  JSON.parse(String(config?.data)) as Record<string, unknown>;

beforeEach(() => {
  useSessionStore.getState().setSession({ user: testUser, accessToken: "t" });
  useActiveVehicleStore.setState({ activeVehicleId: null });
});

describe("recurring payments", () => {
  it("lists what's due, the loan and the schedules, and records a payment from the dashboard's link", async () => {
    const calls = api({
      ...base,
      [`POST /recurring-expenses/${parking.recurringId}/payments/${parking.dueDate}/pay`]: () =>
        ok({ ...parking, state: "PAID", expenseId: ID(900) }),
    });
    renderApp(`/expenses/recurring?pay=${parking.recurringId}&due=${parking.dueDate}`);
    const user = userEvent.setup();

    // The link opens the record dialog for that payment, its amount filled in.
    const dialog = within(await screen.findByRole("dialog", { name: "Record payment" }));
    expect(dialog.getByText(/Society parking pass, due 29\/11\/2026/)).toBeInTheDocument();
    expect(dialog.getByRole("textbox", { name: "Amount paid" })).toHaveValue("1,500");
    await user.click(dialog.getByRole("button", { name: "Record payment" }));
    await waitFor(() =>
      expect(
        bodyOf(calls.find((call) => call.method === "post" && call.url?.endsWith("/pay"))),
      ).toMatchObject({ amount: "1500" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    // Upcoming payments: state, the EMI's split, and the actions.
    const upcoming = within(
      screen.getByRole("heading", { name: "Upcoming payments" }).closest("[data-slot=card]")!,
    );
    expect(upcoming.getAllByText("Overdue").length).toBeGreaterThan(0);
    expect(upcoming.getByText(/EMI 20 of 60 · ₹12,129.00 principal/)).toBeInTheDocument();
    expect(upcoming.getAllByRole("button", { name: "Record payment" })).toHaveLength(2);

    // The loan's position, opening its schedule.
    expect(screen.getByText("₹5,63,204.00")).toBeInTheDocument();
    expect(screen.getByText("19 of 60 EMIs paid")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View schedule →" })).toHaveAttribute(
      "href",
      `/expenses/loans/${loan.id}`,
    );
    // Schedules with their frequency and status.
    const table = within(screen.getByRole("table"));
    expect(table.getByText("Monthly")).toBeInTheDocument();
    expect(table.getByText("Active")).toBeInTheDocument();
  });

  it("asks before skipping nothing: skip goes straight to the API", async () => {
    const calls = api({
      ...base,
      [`POST /recurring-expenses/${emi.recurringId}/payments/${emi.dueDate}/skip`]: () =>
        ok({ ...emi, state: "SKIPPED" }),
    });
    renderApp("/expenses/recurring");
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "More for HDFC Bank EMI, due 05/11/2026" }),
    );
    await user.click(await screen.findByRole("menuitem", { name: "Skip this one" }));
    await waitFor(() =>
      expect(calls.some((call) => call.url?.endsWith(`/${emi.dueDate}/skip`))).toBe(true),
    );
  });

  it("adds a quarterly payment; a loan's EMIs aren't added here", async () => {
    const calls = api({
      ...base,
      "POST /recurring-expenses": (config) => ok({ ...schedule, ...bodyOf(config) }, 201),
    });
    renderApp("/expenses/recurring/new");
    const user = userEvent.setup();

    await user.type(await screen.findByRole("textbox", { name: "Title" }), "FASTag top-up");
    await user.type(screen.getByRole("textbox", { name: "Amount" }), "500");
    expect(screen.queryByRole("radio", { name: "Finance" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Daily usage" }));
    await user.click(screen.getByRole("radio", { name: "Quarterly" }));
    await user.click(screen.getByRole("button", { name: "Save recurring payment" }));

    await waitFor(() =>
      expect(
        bodyOf(calls.find((call) => call.method === "post" && call.url === "/recurring-expenses")),
      ).toMatchObject({
        vehicleId: victoris.id,
        title: "FASTag top-up",
        amount: "500",
        categoryId: daily.id,
        every: 3,
        unit: "MONTH",
        reminderDays: 3,
      }),
    );
  });
});

describe("loan details", () => {
  it("shows the position, and the schedule a page at a time with each EMI's state", async () => {
    const row = (number: number, state: LoanScheduleRow["state"]): LoanScheduleRow => ({
      number,
      date: `2026-${String(number - 8).padStart(2, "0")}-05`,
      annualRate: "9.00",
      openingBalance: "600000.00",
      emi: "16607.00",
      interest: "4500.00",
      principal: "12107.00",
      prepayment: "0.00",
      closingBalance: "587893.00",
      state,
      expenseId: null,
    });
    api({
      ...base,
      [`GET /vehicle-loans/${loan.id}`]: () => ok(loan),
      [`GET /vehicle-loans/${loan.id}/schedule`]: () =>
        okPage([row(19, "PAID"), row(20, "OVERDUE")], { totalPages: 5, total: 60 }),
    });
    renderApp(`/expenses/loans/${loan.id}`);

    expect(
      await screen.findByRole("heading", { level: 1, name: "HDFC Bank · AL-0042" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Reducing balance · ₹8,00,000.00 at 9.00% for 60 months/),
    ).toBeInTheDocument();
    const position = within(screen.getByRole("region", { name: "Loan position" }));
    expect(position.getByText("₹5,63,204.00")).toBeInTheDocument();
    expect(position.getByText("41 EMIs to go")).toBeInTheDocument();
    const table = within(await screen.findByRole("table"));
    expect(table.getByText("Paid")).toBeInTheDocument();
    expect(table.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 5")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit loan" })).toHaveAttribute(
      "href",
      `/expenses/loans/${loan.id}/edit`,
    );
  });
});
