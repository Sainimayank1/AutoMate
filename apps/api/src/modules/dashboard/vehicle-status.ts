import {
  type ActionItem,
  DocumentState,
  DocumentType,
  type ExpiryItem,
  PaymentState,
  type RecurringPayment,
  type Reminder,
  ReminderState,
  type StatusItem,
  type StatusSeverity,
  type UntrackedArea,
  type Vehicle,
  type VehicleDocument,
  type VehicleStatus,
} from "@automate/shared";

import { day, km, rupees } from "@/common/format";
import { Prisma } from "@/generated/prisma/client";

/** Expiring soon (design skill: documents ≤ 30 days are a warning). */
export const EXPIRING_DAYS = 30;
/** A warranty this close to its km limit is worth a warning. */
export const WARRANTY_KM_NOTICE = 1_000;

const DAY_MS = 24 * 60 * 60 * 1000;
const daysUntil = (today: string, date: string) =>
  Math.round((Date.parse(date) - Date.parse(today)) / DAY_MS);
const inDays = (days: number) =>
  days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
const RANK: Record<StatusSeverity, number> = { critical: 0, warning: 1, info: 2 };

/** The latest insurance policy on record, from its payment (Expenses). */
export type InsuranceOnRecord = { expenseId: string; paidOn: string; policyEnd: string };

/**
 * The status panel (docs/architecture/dashboard.md §1): only facts from records the user keeps.
 * Maintenance counts as tracked only while the vehicle has an active schedule, documents once it
 * has one. While anything is untracked the vehicle is never called healthy. The insurance payment
 * and the vehicle's warranty stand in until the vehicle has that document.
 */
export function vehicleStatus({
  vehicle,
  insurance,
  maintenance,
  payments = [],
  documents = [],
  reminders = [],
  dismissed = [],
  today,
}: {
  vehicle: Vehicle;
  insurance: InsuranceOnRecord | null;
  /** The vehicle's documents (Documents): expired and expiring ones become items. */
  documents?: VehicleDocument[];
  /** Recurring payments and EMIs (Expenses): only due and overdue ones become items. */
  payments?: RecurringPayment[];
  /** The user's own reminders for this vehicle (Notifications): due and overdue ones become items. */
  reminders?: Reminder[];
  /** Ids of information-only items the user dismissed for this vehicle. */
  dismissed?: string[];
  /** From MaintenanceService.snapshot().status: due and overdue schedules; tracked = has an active one. */
  maintenance: { items: StatusItem[]; tracked: boolean };
  today: string;
}): VehicleStatus {
  const has = (type: DocumentType) => documents.some((document) => document.type === type);
  const items = [
    ...documents.map(documentItem),
    has(DocumentType.INSURANCE) ? null : insuranceItem(insurance, today),
    has(DocumentType.WARRANTY) ? null : warrantyItem(vehicle, today),
    ...maintenance.items.map(maintenanceItem),
    ...payments.map((payment) => paymentItem(payment, today)),
    ...reminders.map(reminderItem),
  ]
    .filter((item): item is ActionItem => item !== null)
    // Only information can be dismissed; anything to do stays until it's done.
    .filter((item) => item.severity !== "info" || !dismissed.includes(item.id))
    .sort((a, b) => RANK[a.severity] - RANK[b.severity]);
  const untracked: UntrackedArea[] = [
    ...(maintenance.tracked ? [] : ["maintenance" as const]),
    ...(documents.length ? [] : ["documents" as const]),
  ];
  const level = items.some((item) => item.severity !== "info")
    ? "attention"
    : untracked.length
      ? "incomplete"
      : "no_issues";
  return { level, items, untracked };
}

type Expiry = { state: ExpiryItem["state"]; summary: string; detail: string | null; href: string };

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const SEVERITY: Record<Exclude<ExpiryItem["state"], "not_added">, StatusSeverity> = {
  expired: "critical",
  expiring: "warning",
  valid: "info",
};

/** The insurance policy's expiry, from the payment that carries its dates. */
function insuranceExpiry(insurance: InsuranceOnRecord, today: string): Expiry {
  const left = daysUntil(today, insurance.policyEnd);
  return {
    state: left < 0 ? "expired" : left <= EXPIRING_DAYS ? "expiring" : "valid",
    summary:
      left < 0
        ? `Expired on ${day(insurance.policyEnd)}`
        : left <= EXPIRING_DAYS
          ? `Expires ${inDays(left)}`
          : `Valid until ${day(insurance.policyEnd)}`,
    detail: `From your insurance payment of ${day(insurance.paidOn)}`,
    href: `/expenses/transactions/${insurance.expenseId}`,
  };
}

/** Warranty from the vehicle record: whichever of date or km comes first. */
function warrantyExpiry(vehicle: Vehicle, today: string): Expiry | null {
  const { warrantyExpiryDate: date, warrantyKmLimit: limit } = vehicle;
  if (!date && limit === null) return null;
  const daysLeft = date ? daysUntil(today, date) : null;
  const kmLeft = limit !== null ? limit - vehicle.odometerKm : null;
  const href = `/garage/${vehicle.id}`;
  const expiry = (state: Expiry["state"], summary: string, detail: string | null = null) => ({
    state,
    summary,
    detail,
    href,
  });
  if (daysLeft !== null && daysLeft < 0) return expiry("expired", `Ended on ${day(date!)}`);
  if (kmLeft !== null && kmLeft <= 0) return expiry("expired", `Ended at ${km(limit!)}`);
  const both =
    date && limit !== null ? `${day(date)} or ${km(limit)}, whichever comes first` : null;
  if (daysLeft !== null && daysLeft <= EXPIRING_DAYS) {
    return expiry("expiring", `Ends ${inDays(daysLeft)}`, both);
  }
  if (kmLeft !== null && kmLeft <= WARRANTY_KM_NOTICE) {
    return expiry("expiring", `Ends in ${km(kmLeft)}`, both);
  }
  return expiry(
    "valid",
    date && limit !== null
      ? `Valid until ${day(date)} or ${km(limit)}`
      : date
        ? `Valid until ${day(date)}`
        : `Valid up to ${km(limit!)}`,
  );
}

/** Insurance: renewing is the action while it's expiring or expired. */
function insuranceItem(insurance: InsuranceOnRecord | null, today: string): ActionItem | null {
  if (!insurance) return null;
  const expiry = insuranceExpiry(insurance, today);
  const left = daysUntil(today, insurance.policyEnd);
  return {
    id: "insurance",
    severity: SEVERITY[expiry.state as keyof typeof SEVERITY],
    title: `Insurance ${lowerFirst(expiry.summary)}`,
    detail: expiry.detail,
    href: expiry.href,
    source: "insurance",
    state:
      expiry.state === "expired"
        ? "overdue"
        : expiry.state === "expiring"
          ? left === 0
            ? "due_today"
            : "due_soon"
          : "info",
    action: expiry.state === "valid" ? null : { label: "Add renewal", href: "/expenses/new" },
  };
}

/**
 * A Maintenance status item in the action centre: overdue or due (soon); logging the service is
 * the action, and the row opens the schedule.
 */
function maintenanceItem(item: StatusItem): ActionItem {
  return {
    ...item,
    source: "maintenance",
    state:
      item.severity === "critical" ? "overdue" : item.severity === "warning" ? "due_soon" : "info",
    // The record form completes that schedule (`?schedule=`, Maintenance's own param).
    action: {
      label: "Log service",
      href: `/maintenance/records/new?schedule=${item.id.replace(/^maintenance:/, "")}`,
    },
  };
}

/**
 * A recurring payment or EMI that's due (within its reminder window) or overdue; one scheduled
 * further out isn't an item. Recording it is the action (the Recurring tab opens its dialog).
 */
function paymentItem(payment: RecurringPayment, today: string): ActionItem | null {
  const overdue = payment.state === PaymentState.OVERDUE;
  if (!overdue && payment.state !== PaymentState.DUE) return null;
  const left = daysUntil(today, payment.date);
  const amount = rupees(new Prisma.Decimal(payment.amount));
  return {
    id: `payment:${payment.recurringId}:${payment.dueDate}`,
    severity: overdue ? "critical" : "warning",
    title: overdue
      ? `${payment.title} is overdue`
      : left === 0
        ? `${payment.title} is due today`
        : `${payment.title} is due ${inDays(left)}`,
    detail:
      (payment.loan ? `${amount} · EMI ${payment.loan.number} of ${payment.loan.of}` : amount) +
      (overdue ? ` · was due ${day(payment.date)}` : ""),
    href: "/expenses/recurring",
    source: "payment",
    state: overdue ? "overdue" : left === 0 ? "due_today" : "due_soon",
    action: {
      label: "Record payment",
      href: `/expenses/recurring?${new URLSearchParams({ pay: payment.recurringId, due: payment.dueDate }).toString()}`,
    },
  };
}

/** An expired or expiring document; renewing (new dates, new copy) is the action. */
function documentItem(document: VehicleDocument): ActionItem | null {
  const expired = document.state === DocumentState.EXPIRED;
  if (!expired && document.state !== DocumentState.EXPIRING) return null;
  const left = document.daysLeft!;
  return {
    id: `document:${document.id}`,
    severity: expired ? "critical" : "warning",
    title: expired
      ? `${document.name} expired on ${day(document.expiryDate!)}`
      : `${document.name} expires ${inDays(left)}`,
    detail: document.issuer ?? document.number,
    href: `/documents/${document.id}`,
    source: "document",
    state: expired ? "overdue" : left === 0 ? "due_today" : "due_soon",
    action: { label: "Renew", href: `/documents/${document.id}/edit?renew=1` },
  };
}

/** One of the user's own reminders in its window (a warning) or overdue (critical). */
function reminderItem(reminder: Reminder): ActionItem | null {
  const overdue = reminder.state === ReminderState.OVERDUE;
  if (!overdue && reminder.state !== ReminderState.DUE) return null;
  const left = reminder.daysLeft;
  const href = `/notifications/reminders?reminder=${reminder.id}`;
  return {
    id: `reminder:${reminder.id}`,
    severity: overdue ? "critical" : "warning",
    title: overdue
      ? `${reminder.title} was due on ${day(reminder.dueDate)}`
      : `${reminder.title} is due ${inDays(left)}`,
    detail: reminder.notes,
    href,
    source: "reminder",
    state: overdue ? "overdue" : left === 0 ? "due_today" : "due_soon",
    action: { label: "Open reminder", href },
  };
}

/** An ended warranty is worth knowing, not an alarm: it's information. */
function warrantyItem(vehicle: Vehicle, today: string): ActionItem | null {
  const expiry = warrantyExpiry(vehicle, today);
  if (!expiry) return null;
  return {
    id: "warranty",
    severity: expiry.state === "expiring" ? "warning" : "info",
    title: `Warranty ${lowerFirst(expiry.summary)}`,
    detail: expiry.detail,
    href: expiry.href,
    source: "warranty",
    state: expiry.state === "expiring" ? "due_soon" : "info",
    // Nothing to log: the warranty is on the vehicle record (the row opens it).
    action: null,
  };
}

/**
 * The expiry-dates card: the vehicle's documents with an expiry, soonest first, each opening its
 * document. Until the vehicle has an insurance document, the policy on its insurance payment
 * stands in (or a nudge to add one, since a car needs it); the vehicle record's warranty likewise.
 */
export function expiryDates({
  vehicle,
  insurance,
  documents = [],
  today,
}: {
  vehicle: Vehicle;
  insurance: InsuranceOnRecord | null;
  documents?: VehicleDocument[];
  today: string;
}): ExpiryItem[] {
  const has = (type: DocumentType) => documents.some((document) => document.type === type);
  const warranty = has(DocumentType.WARRANTY) ? null : warrantyExpiry(vehicle, today);
  return [
    ...documents.filter((document) => document.expiryDate).map(documentExpiry),
    ...(has(DocumentType.INSURANCE)
      ? []
      : [
          insurance
            ? { id: "insurance", label: "Insurance", ...insuranceExpiry(insurance, today) }
            : {
                id: "insurance",
                label: "Insurance",
                state: "not_added" as const,
                summary: "No policy on record",
                detail: "Add the policy in Documents.",
                href: "/documents/new?type=INSURANCE",
              },
        ]),
    ...(warranty ? [{ id: "warranty", label: "Warranty", ...warranty }] : []),
  ];
}

const EXPIRY_STATE: Record<DocumentState, ExpiryItem["state"]> = {
  [DocumentState.EXPIRED]: "expired",
  [DocumentState.EXPIRING]: "expiring",
  [DocumentState.VALID]: "valid",
  [DocumentState.NO_EXPIRY]: "valid",
};

function documentExpiry(document: VehicleDocument): ExpiryItem {
  const left = document.daysLeft!;
  return {
    id: `document:${document.id}`,
    label: document.name,
    state: EXPIRY_STATE[document.state],
    summary:
      document.state === DocumentState.EXPIRED
        ? `Expired on ${day(document.expiryDate!)}`
        : document.state === DocumentState.EXPIRING
          ? `Expires ${inDays(left)}`
          : `Valid until ${day(document.expiryDate!)}`,
    detail: document.issuer ?? document.number,
    href: `/documents/${document.id}`,
  };
}
