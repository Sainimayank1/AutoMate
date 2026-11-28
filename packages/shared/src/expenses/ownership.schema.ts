import { z } from "zod";

import { type DateWindow, ReportingPeriod } from "../common/periods.js";
import type { ExpenseCategoryRef } from "./expense.schema.js";

/**
 * Ownership cost (Expenses phase 6, docs/architecture/expenses.md §8): the three money views of one
 * vehicle over a period, and depreciation as a labelled estimate.
 */

/** The periods the Ownership tab offers; "all time" starts at the purchase date. */
export const OWNERSHIP_PERIODS = [
  ReportingPeriod.THIS_MONTH,
  ReportingPeriod.THIS_YEAR,
  ReportingPeriod.ALL_TIME,
] as const;
export type OwnershipPeriod = (typeof OWNERSHIP_PERIODS)[number];

export const ownershipQuerySchema = z.object({
  vehicleId: z.uuid("Choose a vehicle"),
  period: z.enum(OWNERSHIP_PERIODS).default(ReportingPeriod.THIS_YEAR),
});
export type OwnershipQuery = z.output<typeof ownershipQuerySchema>;

export interface OwnershipCost {
  period: OwnershipPeriod;
  /** "All time" runs from the purchase date (or the first record) to today. */
  window: DateWindow;
  /** Running the vehicle (OPERATING): cost per km uses only this. */
  operating: string;
  /** Insurance, PUC, registration, road tax, permits, fines (OWNERSHIP). */
  ownership: string;
  /** Loan interest, processing and prepayment fees (FINANCING without principal). */
  financingCharges: string;
  /** Accessories and upgrades (CAPITAL). */
  capital: string;
  /** null without a purchase price and date. */
  depreciation: {
    amount: string;
    purchasePrice: string;
    purchaseDate: string;
    /** Whole months owned today. */
    ageMonths: number;
    /** Of the purchase price lost by today, on the schedule. */
    percent: string;
    /** Purchase price less depreciation today. */
    estimatedValue: string;
    /** Older than the 5-year schedule: nothing more is estimated. */
    beyondSchedule: boolean;
  } | null;
  /** operating + ownership + financing charges + capital + depreciation. */
  economic: string;
  /** Everything paid, the full EMI included; refunds subtracted. */
  cashOutflow: string;
  /** Loan principal repaid: in cash outflow, never a cost. */
  principal: string;
  /** Km in the period from odometer readings; null with fewer than two. */
  distanceKm: number | null;
  /** economic ÷ km. */
  economicPerKm: string | null;
  /** Calendar months the period spans (to one decimal), for the monthly average. */
  months: string;
  /** economic ÷ months. */
  perMonth: string;
}

/**
 * The printable report (Expenses phase 8): the ownership figures, spending by category and by
 * month for the same period (net of refunds, loan principal left out). Its transactions come from
 * the expense list with the report's window.
 */
export interface ExpenseReport {
  ownership: OwnershipCost;
  categories: { category: ExpenseCategoryRef; amount: string; percent: number }[];
  months: { month: string; total: string }[];
}
