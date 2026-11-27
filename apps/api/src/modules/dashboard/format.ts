import { Prisma } from "@/generated/prisma/client";

/** The web's short months (ICU's en-IN says "Sept"). */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const number = new Intl.NumberFormat("en-IN");
const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "18 Aug 2026" for "2026-08-18". */
export function day(date: string) {
  const [year, month, dayOfMonth] = date.split("-").map(Number) as [number, number, number];
  return `${dayOfMonth} ${MONTHS[month - 1]} ${year}`;
}

/** "Aug" for "2026-08". */
export const monthName = (month: string) => MONTHS[Number(month.slice(5, 7)) - 1]!;

/** "1,00,000 km" */
export const km = (value: number) => `${number.format(value)} km`;

/** "₹10,718.21", formatted from the decimal string, never through a float. */
export const rupees = (value: Prisma.Decimal) => currency.format(value.toFixed(2) as `${number}`);
