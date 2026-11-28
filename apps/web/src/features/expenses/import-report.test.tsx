import type { ExpenseImportPreview, ExpenseReport, OwnershipCost } from "@automate/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it } from "vitest";

import { useSessionStore } from "@/stores/session-store";
import { useActiveVehicleStore } from "@/stores/vehicle-store";
import { fail, mockApi, type MockReply, ok, okPage, testUser, testVehicle } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";

const victoris = testVehicle();

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
  "GET /vehicles": () => okPage([victoris]),
  "GET /vehicles?archived": () => okPage([]),
  "GET /expense-categories": () => okPage([]),
  "GET /expenses": () => okPage([]),
};
const bodyOf = (config: InternalAxiosRequestConfig | undefined) =>
  JSON.parse(String(config?.data)) as Record<string, unknown>;

beforeEach(() => {
  useSessionStore.getState().setSession({ user: testUser, accessToken: "t" });
  useActiveVehicleStore.setState({ activeVehicleId: null });
});

describe("CSV import", () => {
  it("checks the file first, then imports the ready rows and the duplicates when asked", async () => {
    const preview: ExpenseImportPreview = {
      counts: { ready: 2, duplicate: 1, skipped: 1, error: 0 },
      rows: [
        {
          line: 3,
          date: "2026-11-21",
          title: "NH-48 FASTag",
          amount: "640.00",
          category: "Daily usage",
          status: "duplicate",
          message: "Looks like an expense already recorded (same day, amount and category).",
        },
        {
          line: 4,
          date: "2026-11-24",
          title: "IndianOil XP95",
          amount: "3379.97",
          category: "Fuel",
          status: "skipped",
          message: "From Fuel: it's linked there, so it isn't imported again.",
        },
      ],
    };
    const calls = api({
      ...base,
      "POST /expenses/import/preview": () => ok(preview),
      "POST /expenses/import": () => ok({ imported: 3, notImported: 1 }, 201),
    });
    renderApp("/expenses/transactions");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Import CSV" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Import expenses" }));
    const csv = "Date,Title,Category,Amount (INR)\n2026-11-21,NH-48 FASTag,Daily usage,640";
    await user.upload(
      dialog.getByLabelText("CSV file"),
      new File([csv], "expenses.csv", { type: "text/csv" }),
    );

    expect(
      await dialog.findByText("From Fuel: it's linked there, so it isn't imported again."),
    ).toBeInTheDocument();
    expect(bodyOf(calls.find((call) => call.url === "/expenses/import/preview"))).toMatchObject({
      vehicleId: victoris.id,
      csv,
    });
    const counts = within(dialog.getByLabelText("Rows by status"));
    expect(counts.getByText("Ready").nextSibling).toHaveTextContent("2");
    expect(dialog.getByRole("button", { name: "Import 2 expenses" })).toBeEnabled();

    await user.click(dialog.getByRole("checkbox", { name: /Also import the 1/ }));
    await user.click(dialog.getByRole("button", { name: "Import 3 expenses" }));
    await waitFor(() =>
      expect(bodyOf(calls.find((call) => call.url === "/expenses/import"))).toEqual({
        vehicleId: victoris.id,
        csv,
        includeDuplicates: true,
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("3 expenses imported.")).toBeInTheDocument();
  });

  it("shows the API's reason when the file can't be read", async () => {
    api({
      ...base,
      "POST /expenses/import/preview": () =>
        fail(400, "VALIDATION_ERROR", "The file needs these columns: category, amount (inr).", [
          { field: "csv", message: "The file needs these columns: category, amount (inr)." },
        ]),
    });
    renderApp("/expenses/transactions");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Import CSV" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Import expenses" }));
    await user.upload(
      dialog.getByLabelText("CSV file"),
      new File(["Date,Title"], "bad.csv", { type: "text/csv" }),
    );
    expect(
      await dialog.findByText("The file needs these columns: category, amount (inr)."),
    ).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Import" })).toBeDisabled();
  });
});

describe("printable report", () => {
  it("prints the three views, by category, by month and every transaction with the total", async () => {
    const ownership: OwnershipCost = {
      period: "all_time",
      window: { from: "2025-04-10", to: "2026-11-28" },
      operating: "500.00",
      ownership: "12000.00",
      financingCharges: "4478.00",
      capital: "6500.00",
      depreciation: null,
      economic: "23478.00",
      cashOutflow: "35607.00",
      principal: "12129.00",
      distanceKm: null,
      economicPerKm: null,
      months: "19.6",
      perMonth: "1197.86",
    };
    const report: ExpenseReport = {
      ownership,
      categories: [
        {
          category: {
            id: "c1",
            key: "INSURANCE_LEGAL",
            name: "Insurance & legal",
            icon: "shield-check",
            costClass: "OWNERSHIP",
          },
          amount: "12000.00",
          percent: 51.1,
        },
      ],
      months: [{ month: "2026-11", total: "23478.00" }],
    };
    const calls = api({
      ...base,
      "GET /expenses/report": () => ok(report),
    });
    renderApp(`/expenses/report?vehicle=${victoris.id}&period=all_time`);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Expense report" }),
    ).toBeInTheDocument();
    expect(screen.getByText("₹35,607.00")).toBeInTheDocument();
    expect(screen.getByText("Incl. ₹12,129.00 loan principal")).toBeInTheDocument();
    expect(screen.getByText("No depreciation without a purchase price")).toBeInTheDocument();
    expect(screen.getByText("51.1%")).toBeInTheDocument();
    expect(screen.getByText("November 2026")).toBeInTheDocument();
    expect(calls.find((call) => call.url === "/expenses/report")?.params).toEqual({
      vehicleId: victoris.id,
      period: "all_time",
    });
    // Transactions for the report's window, oldest first.
    await waitFor(() =>
      expect(calls.find((call) => call.url === "/expenses")?.params).toMatchObject({
        vehicleId: victoris.id,
        from: "2025-04-10",
        to: "2026-11-28",
        sort: "date_asc",
      }),
    );
    expect(await screen.findByText("No transactions in this period.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Print or save as PDF" })).toBeEnabled();
  });
});
