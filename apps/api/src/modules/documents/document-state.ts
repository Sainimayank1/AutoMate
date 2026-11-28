import { addDays, DocumentState, EXPIRING_DAYS } from "@automate/shared";

const DAY_MS = 86_400_000;

/** Whole days from `today` to `date` (both IST calendar dates). */
export const daysBetween = (today: string, date: string) =>
  Math.round((Date.parse(date) - Date.parse(today)) / DAY_MS);

/** Expired before today, expiring within EXPIRING_DAYS (today included), else valid. */
export function documentState(
  expiryDate: string | null,
  today: string,
): { state: DocumentState; daysLeft: number | null } {
  if (!expiryDate) return { state: DocumentState.NO_EXPIRY, daysLeft: null };
  const daysLeft = daysBetween(today, expiryDate);
  return {
    state:
      daysLeft < 0
        ? DocumentState.EXPIRED
        : daysLeft <= EXPIRING_DAYS
          ? DocumentState.EXPIRING
          : DocumentState.VALID,
    daysLeft,
  };
}

/** The expiry window a state covers, for filtering in the database. */
export function stateWindow(
  state: DocumentState,
  today: string,
): Partial<Record<"lt" | "lte" | "gt" | "gte", string>> | null {
  const edge = addDays(today, EXPIRING_DAYS);
  switch (state) {
    case DocumentState.EXPIRED:
      return { lt: today };
    case DocumentState.EXPIRING:
      return { gte: today, lte: edge };
    case DocumentState.VALID:
      return { gt: edge };
    case DocumentState.NO_EXPIRY:
      return null;
  }
}
