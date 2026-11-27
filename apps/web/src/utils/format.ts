import { format, isValid } from "date-fns";

/** Indian locale defaults. Change here, not in components. */
export const LOCALE = "en-IN";
export const CURRENCY = "INR";
export const DATE_FORMAT = "dd/MM/yyyy";
export const DATE_TIME_FORMAT = "dd/MM/yyyy, h:mm a";
export const EMPTY_VALUE = "—";

export const UNITS = {
  distance: "km",
  volume: "L",
  efficiency: "km/L",
} as const;

/** Numbers from the API may be decimal strings (money, fuel); Intl formats those without float rounding. */
export type NumericValue = number | string;
export type DateValue = Date | string | number;

const currencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatters = new Map<string, Intl.NumberFormat>();

function getNumberFormatter(minFractionDigits: number, maxFractionDigits: number) {
  const key = `${minFractionDigits}-${maxFractionDigits}`;
  let formatter = numberFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(LOCALE, {
      minimumFractionDigits: minFractionDigits,
      maximumFractionDigits: maxFractionDigits,
    });
    numberFormatters.set(key, formatter);
  }
  return formatter;
}

function isFiniteValue(value: NumericValue | null | undefined): value is NumericValue {
  if (value === null || value === undefined || value === "") return false;
  return Number.isFinite(typeof value === "number" ? value : Number(value));
}

function formatWith(formatter: Intl.NumberFormat, value: NumericValue | null | undefined) {
  if (!isFiniteValue(value)) return null;
  return formatter.format(value as number | Intl.StringNumericLiteral);
}

/** ₹1,25,000.00 */
export function formatCurrency(value: NumericValue | null | undefined): string {
  return formatWith(currencyFormatter, value) ?? EMPTY_VALUE;
}

/** 1,25,000 (Indian digit grouping) */
export function formatNumber(
  value: NumericValue | null | undefined,
  { minFractionDigits = 0, maxFractionDigits = 2 } = {},
): string {
  return formatWith(getNumberFormatter(minFractionDigits, maxFractionDigits), value) ?? EMPTY_VALUE;
}

function withUnit(formatted: string | null, unit: string) {
  return formatted === null ? EMPTY_VALUE : `${formatted} ${unit}`;
}

/** 12,500 km */
export function formatDistance(km: NumericValue | null | undefined): string {
  return withUnit(formatWith(getNumberFormatter(0, 1), km), UNITS.distance);
}

/** 35.42 L */
export function formatVolume(litres: NumericValue | null | undefined): string {
  return withUnit(formatWith(getNumberFormatter(0, 2), litres), UNITS.volume);
}

/** 15.5 km/L */
export function formatEfficiency(kmPerLitre: NumericValue | null | undefined): string {
  return withUnit(formatWith(getNumberFormatter(1, 1), kmPerLitre), UNITS.efficiency);
}

function toDate(value: DateValue | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return isValid(date) ? date : null;
}

/** 27/11/2026 */
export function formatDate(value: DateValue | null | undefined): string {
  const date = toDate(value);
  return date ? format(date, DATE_FORMAT) : EMPTY_VALUE;
}

/** 27/11/2026, 9:30 AM */
export function formatDateTime(value: DateValue | null | undefined): string {
  const date = toDate(value);
  return date ? format(date, DATE_TIME_FORMAT) : EMPTY_VALUE;
}
