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

/** 35.42 L (or kg for CNG, kWh for electric) */
export function formatVolume(
  quantity: NumericValue | null | undefined,
  unit: string = UNITS.volume,
): string {
  return withUnit(formatWith(getNumberFormatter(0, 2), quantity), unit);
}

/** 15.5 km/L (or km/kg, km/kWh) */
export function formatEfficiency(
  value: NumericValue | null | undefined,
  unit: string = UNITS.efficiency,
): string {
  return withUnit(formatWith(getNumberFormatter(1, 1), value), unit);
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

/**
 * A period in prose: "1–27 Oct", "28 Feb – 27 Mar", "1 Dec 2025 – 27 Jan 2026". The year shows
 * when the ends are in different years or not this year. `from` and `to` are "YYYY-MM-DD".
 */
export function formatDateRange(
  { from, to }: { from: string; to: string },
  now: Date = new Date(),
): string {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const sameYear = start.getFullYear() === end.getFullYear();
  const year = !sameYear || end.getFullYear() !== now.getFullYear() ? " yyyy" : "";
  if (from === to) return format(end, `d MMM${year}`);
  if (sameYear && start.getMonth() === end.getMonth()) {
    return `${format(start, "d")}–${format(end, `d MMM${year}`)}`;
  }
  return `${format(start, sameYear ? "d MMM" : "d MMM yyyy")} – ${format(end, `d MMM${year}`)}`;
}

const STANDARD_PLATE = /^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/;
const BHARAT_PLATE = /^(\d{2})(BH)(\d{4})([A-Z]{1,2})$/;

/** HR26EV4821 → HR-26-EV-4821, 22BH1234AA → 22-BH-1234-AA (Stitch plate style). Unknown formats pass through. */
export function formatRegistration(value: string | null | undefined): string {
  if (!value) return EMPTY_VALUE;
  const plate = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const parts = STANDARD_PLATE.exec(plate) ?? BHARAT_PLATE.exec(plate);
  return parts ? parts.slice(1).filter(Boolean).join("-") : plate;
}
