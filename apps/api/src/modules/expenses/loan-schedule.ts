import { addMonths, LoanMethod } from "@automate/shared";

import { Prisma } from "@/generated/prisma/client";

type Decimal = Prisma.Decimal;

const ZERO = new Prisma.Decimal(0);
const toPaise = (value: Decimal) => value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
const toRupee = (value: Decimal) => value.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
const monthlyRate = (annualRate: Decimal) => annualRate.div(1200);

/** A schedule never runs past this many EMIs (a rate rise kept on the same EMI can stretch it). */
const MAX_EMIS = 600;

export type LoanTerms = {
  principal: Decimal;
  annualRate: Decimal;
  tenureMonths: number;
  /** YYYY-MM-DD; later EMIs fall on the same day of each month (clamped to its length). */
  firstEmiDate: string;
  method: LoanMethod;
  rateChanges: { effectiveFrom: string; annualRate: Decimal; keepEmi: boolean }[];
  /** Part-prepayments of principal. */
  prepayments: { date: string; amount: Decimal }[];
};

export type ScheduleEntry = {
  number: number;
  date: string;
  annualRate: Decimal;
  openingBalance: Decimal;
  emi: Decimal;
  interest: Decimal;
  principal: Decimal;
  prepayment: Decimal;
  closingBalance: Decimal;
};

/**
 * The EMI that repays `balance` over `months` at a monthly rate (the annuity formula), to the
 * rupee as lenders quote it; the last EMI absorbs the rounding.
 */
export function emiFor(balance: Decimal, rate: Decimal, months: number): Decimal {
  if (months <= 1) return toPaise(balance.plus(balance.times(rate)));
  if (rate.isZero()) return toRupee(balance.div(months));
  const growth = rate.plus(1).pow(months);
  return toRupee(balance.times(rate).times(growth).div(growth.minus(1)));
}

/** How many EMIs of `emi` repay `balance` at a monthly rate (inverse of the annuity formula). */
export function monthsFor(balance: Decimal, rate: Decimal, emi: Decimal): number {
  if (balance.lessThanOrEqualTo(0)) return 0;
  if (rate.isZero()) return balance.div(emi).ceil().toNumber();
  const interest = balance.times(rate);
  if (emi.lessThanOrEqualTo(interest)) return Number.POSITIVE_INFINITY;
  return emi
    .div(emi.minus(interest))
    .ln()
    .div(rate.plus(1).ln())
    .toDecimalPlaces(6)
    .ceil()
    .toNumber();
}

/**
 * The amortisation schedule (docs/architecture/expenses.md §6), in exact decimals:
 * - Reducing balance: each EMI pays the month's interest on the balance, the rest is principal.
 * - Flat: interest on the original principal for the whole tenure, spread evenly.
 * - A rate change applies from the first EMI on or after it: the EMI stays and the tenure moves
 *   (or, when asked or when the EMI would no longer cover the interest, the tenure stays).
 * - A prepayment counts from the next EMI: it lowers the balance after the last EMI on or before
 *   its date, and the EMI stays, so the loan ends sooner.
 */
export function amortise(terms: LoanTerms): ScheduleEntry[] {
  const changes = [...terms.rateChanges].sort((a, b) =>
    a.effectiveFrom.localeCompare(b.effectiveFrom),
  );
  const prepayments = [...terms.prepayments].sort((a, b) => a.date.localeCompare(b.date));
  const flat = terms.method === LoanMethod.FLAT;
  let annualRate = terms.annualRate;
  let balance = terms.principal;
  // Paid before the first EMI: it lowers what the EMIs repay.
  balance = balance.minus(take(prepayments, (date) => date < terms.firstEmiDate));
  const flatInterest = toPaise(
    terms.principal.times(annualRate).times(terms.tenureMonths).div(1200),
  );
  let emi = flat
    ? toRupee(terms.principal.plus(flatInterest).div(terms.tenureMonths))
    : emiFor(balance, monthlyRate(annualRate), terms.tenureMonths);
  // The contracted tenure: its last EMI absorbs the rupee rounding.
  let remaining = terms.tenureMonths;
  let flatInterestLeft = flatInterest;

  const rows: ScheduleEntry[] = [];
  for (let k = 0; balance.greaterThan(0) && k < MAX_EMIS; k++) {
    const date = addMonths(terms.firstEmiDate, k);
    const next = addMonths(terms.firstEmiDate, k + 1);
    if (!flat) {
      while (changes.length && changes[0]!.effectiveFrom <= date) {
        const change = changes.shift()!;
        annualRate = change.annualRate;
        const rate = monthlyRate(annualRate);
        const stretched = monthsFor(balance, rate, emi);
        if (!change.keepEmi || !Number.isFinite(stretched) || stretched > MAX_EMIS) {
          emi = emiFor(balance, rate, Math.max(remaining, 1));
          remaining = Math.max(remaining, 1);
        } else {
          remaining = stretched;
        }
      }
    }
    const interest = flat
      ? remaining <= 1
        ? flatInterestLeft
        : toPaise(flatInterest.div(terms.tenureMonths))
      : toPaise(balance.times(monthlyRate(annualRate)));
    let principal = emi.minus(interest);
    // The last EMI (or one that would overpay) repays exactly what's left.
    if (remaining <= 1 || principal.greaterThanOrEqualTo(balance)) principal = balance;
    const opening = balance;
    balance = balance.minus(principal);
    const prepayment = Prisma.Decimal.min(
      take(prepayments, (day) => day >= date && day < next),
      balance,
    );
    balance = balance.minus(prepayment);
    rows.push({
      number: k + 1,
      date,
      annualRate,
      openingBalance: opening,
      emi: principal.plus(interest),
      interest,
      principal,
      prepayment,
      closingBalance: balance,
    });
    flatInterestLeft = flatInterestLeft.minus(interest);
    remaining -= 1;
    if (prepayment.greaterThan(0) && !flat) {
      remaining = monthsFor(balance, monthlyRate(annualRate), emi);
    } else if (prepayment.greaterThan(0)) {
      remaining = balance.div(emi.minus(interest)).ceil().toNumber();
    }
  }
  return rows;
}

/** Removes and totals the prepayments whose date matches. */
function take(prepayments: LoanTerms["prepayments"], when: (date: string) => boolean): Decimal {
  let total = ZERO;
  for (let i = prepayments.length - 1; i >= 0; i--) {
    if (!when(prepayments[i]!.date)) continue;
    total = total.plus(prepayments[i]!.amount);
    prepayments.splice(i, 1);
  }
  return total;
}
