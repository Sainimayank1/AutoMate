import { z } from "zod";

/**
 * Field helpers shared by the module schemas. Forms send "" for an empty input and "1,462" for a
 * number typed with grouping; these turn that into what the API stores.
 */

export const blankToNull = (value: unknown) =>
  (typeof value === "string" && value.trim() === "") ||
  (typeof value === "number" && Number.isNaN(value))
    ? null
    : value;

export const numeric = (value: unknown) => {
  const cleaned = blankToNull(value);
  return typeof cleaned === "string" ? cleaned.replace(/[,\s]/g, "") : cleaned;
};

/** ISO date of tomorrow: "not in the future" tolerates the IST/UTC day boundary. */
export const latestAllowedDate = () =>
  new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

export const optionalText = (max: number) =>
  z
    .preprocess(
      blankToNull,
      z.string().trim().max(max, `Use ${max} characters or fewer`).nullable(),
    )
    .optional();

export const optionalInt = (min: number, max: number, message: string) =>
  z
    .preprocess(
      numeric,
      z.coerce.number<number>().int(message).min(min, message).max(max, message).nullable(),
    )
    .optional();

export const requiredInt = (min: number, max: number, message: string) =>
  z.preprocess(
    (value) => numeric(value) ?? undefined,
    z.coerce.number<number>({ error: message }).int(message).min(min, message).max(max, message),
  );

/** A decimal kept as a string ("1499.5") so no precision is lost; numbers are accepted too. */
const decimalInput = (value: unknown) => {
  const cleaned = numeric(value);
  return typeof cleaned === "number" ? String(cleaned) : cleaned;
};

const decimalPattern = (intDigits: number, scale: number) =>
  new RegExp(`^\\d{1,${intDigits}}(\\.\\d{1,${scale}})?$`);

export const optionalDecimal = (intDigits: number, scale: number, message: string) =>
  z
    .preprocess(
      decimalInput,
      z.string().regex(decimalPattern(intDigits, scale), message).nullable(),
    )
    .optional();

/** Required and greater than zero. */
export const positiveDecimal = (intDigits: number, scale: number, message: string) =>
  z.preprocess(
    (value) => decimalInput(value) ?? undefined,
    z
      .string({ error: message })
      .regex(decimalPattern(intDigits, scale), { error: message, abort: true })
      .refine((value) => /[1-9]/.test(value), message),
  );

export const optionalDate = ({ pastOnly }: { pastOnly: boolean }) =>
  z
    .preprocess(
      blankToNull,
      z.iso
        .date("Enter a valid date")
        .refine((date) => !pastOnly || date <= latestAllowedDate(), "This date is in the future")
        .nullable(),
    )
    .optional();

export const optionalCode = (pattern: RegExp, message: string) =>
  z
    .preprocess((value) => {
      const cleaned = blankToNull(value);
      return typeof cleaned === "string" ? cleaned.toUpperCase().replace(/\s/g, "") : cleaned;
    }, z.string().regex(pattern, message).nullable())
    .optional();
