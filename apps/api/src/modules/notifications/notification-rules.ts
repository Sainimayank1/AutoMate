import {
  daysBetween,
  DocumentType,
  FUEL_UNIT,
  type FuelSummary,
  type MaintenanceSchedule,
  NotificationCategory,
  type NotificationItem,
  NotificationPriority,
  PaymentState,
  type RecurringPayment,
  type Reminder,
  ReminderState,
  ScheduleStatus,
  type TripReminder,
  type VehicleDocument,
} from "@automate/shared";

import { day, km, monthName, rupees } from "@/common/format";
import { Prisma } from "@/generated/prisma/client";

/**
 * What the inbox should hold right now, worked out from each module's records (pure, tested in
 * notification-rules.spec.ts). Text uses absolute dates so a stored notification stays true.
 * Each candidate's dedupe key names its source and the stage it's at, so a new stage (due soon →
 * overdue, a renewed document, the next service) is a new notification.
 */
export interface Candidate {
  dedupeKey: string;
  category: NotificationCategory;
  kind: string;
  priority: NotificationPriority;
  title: string;
  body: string | null;
  href: string | null;
  vehicleId: string | null;
}

/** Events stay in the inbox; everything else goes once it no longer applies (done, renewed). */
export const EVENT_PREFIXES = ["fuel:", "summary:"] as const;

/** A fall at least this big against the vehicle's average raises "Mileage dropped". */
export const MILEAGE_DROP_PERCENT = 15;
/** Full-tank cycles needed before an average means anything. */
export const MILEAGE_MIN_CYCLES = 3;
/** A drop older than this isn't news. */
export const MILEAGE_RECENT_DAYS = 30;

const { HIGH, MEDIUM, LOW } = NotificationPriority;

/** The nearest reminder day reached for an expiring document, or the remind-on date. */
export function documentCandidates(documents: VehicleDocument[], today: string): Candidate[] {
  return documents.flatMap((document) => {
    const out: Candidate[] = [];
    const base = { category: NotificationCategory.DOCUMENTS, vehicleId: document.vehicleId };
    const href = `/documents/${document.id}`;
    const detail = document.number ?? document.issuer;
    const renew =
      document.type === DocumentType.INSURANCE
        ? "Insurance renewal"
        : document.type === DocumentType.PUC
          ? "PUC renewal"
          : null;
    if (document.expiryDate) {
      const left = daysBetween(today, document.expiryDate);
      const stage =
        left < 0
          ? "expired"
          : [...document.reminderDays].sort((a, b) => a - b).find((days) => left <= days);
      if (stage !== undefined) {
        const expired = stage === "expired";
        out.push({
          ...base,
          dedupeKey: `document:${document.id}:${document.expiryDate}:${stage}`,
          kind: expired ? "document.expired" : "document.expiring",
          priority: expired ? HIGH : left <= 7 ? MEDIUM : LOW,
          title: `${document.name} ${expired ? "expired" : "expires"} on ${day(document.expiryDate)}`,
          body: [renew, detail].filter(Boolean).join(" · ") || null,
          href,
        });
      }
    }
    if (document.remindOn && document.remindOn <= today) {
      out.push({
        ...base,
        dedupeKey: `document:${document.id}:remind:${document.remindOn}`,
        kind: "document.reminder",
        priority: MEDIUM,
        title: `Reminder: ${document.name}`,
        body: document.expiryDate ? `Expires on ${day(document.expiryDate)}` : detail,
        href,
      });
    }
    return out;
  });
}

const MAINTENANCE_STAGE = {
  [ScheduleStatus.OVERDUE]: { priority: HIGH, kind: "maintenance.overdue", says: "is overdue" },
  [ScheduleStatus.DUE]: { priority: MEDIUM, kind: "maintenance.due", says: "is due" },
  [ScheduleStatus.DUE_SOON]: { priority: LOW, kind: "maintenance.due_soon", says: "is due soon" },
} as const;

/** Schedules with reminders on that are due soon, due or overdue (date or km, whichever first). */
export function maintenanceCandidates(schedules: MaintenanceSchedule[]): Candidate[] {
  return schedules.flatMap((schedule) => {
    const status = schedule.due.status;
    if (!schedule.remindersEnabled || !(status in MAINTENANCE_STAGE)) return [];
    const stage = MAINTENANCE_STAGE[status as keyof typeof MAINTENANCE_STAGE];
    const { date, distance } = schedule.due;
    const when =
      date && distance
        ? `Due on ${day(date.nextDue)} or at ${km(distance.nextDueKm)}, whichever comes first`
        : date
          ? `Due on ${day(date.nextDue)}`
          : distance
            ? `Due at ${km(distance.nextDueKm)}`
            : null;
    return [
      {
        dedupeKey: `maintenance:${schedule.id}:${date?.nextDue ?? ""}|${distance?.nextDueKm ?? ""}:${status}`,
        category: NotificationCategory.MAINTENANCE,
        kind: stage.kind,
        priority: stage.priority,
        title: `${schedule.name} ${stage.says}`,
        body: when,
        href: `/maintenance/schedules/${schedule.id}`,
        vehicleId: schedule.vehicleId,
      },
    ];
  });
}

/** Recurring payments and EMIs in their reminder window, or overdue. */
export function paymentCandidates(payments: RecurringPayment[]): Candidate[] {
  return payments.flatMap((payment) => {
    const overdue = payment.state === PaymentState.OVERDUE;
    if (!overdue && payment.state !== PaymentState.DUE) return [];
    const amount = rupees(new Prisma.Decimal(payment.amount));
    return [
      {
        dedupeKey: `payment:${payment.recurringId}:${payment.dueDate}:${payment.state}`,
        category: NotificationCategory.EXPENSES,
        kind: overdue ? "payment.overdue" : "payment.due",
        priority: overdue ? HIGH : MEDIUM,
        title: overdue
          ? `${payment.title} is overdue (was due ${day(payment.date)})`
          : `${payment.title} is due on ${day(payment.date)}`,
        body: payment.loan
          ? `${amount} · EMI ${payment.loan.number} of ${payment.loan.of}`
          : amount,
        href: `/expenses/recurring?${new URLSearchParams({ pay: payment.recurringId, due: payment.dueDate }).toString()}`,
        vehicleId: payment.vehicleId,
      },
    ];
  });
}

/** Trip plans leaving soon, past plans not marked done, recent trips without costs. */
export function tripCandidates(reminders: TripReminder[]): Candidate[] {
  return reminders.map((reminder) => ({
    dedupeKey: `trip:${reminder.tripId}:${reminder.kind}:${reminder.date}`,
    category: NotificationCategory.TRIPS,
    kind: `trip.${reminder.kind}`,
    priority: reminder.kind === "departure" ? MEDIUM : LOW,
    title:
      reminder.kind === "departure"
        ? `${reminder.label} starts on ${day(reminder.date)}`
        : reminder.kind === "unconfirmed"
          ? `Did ${reminder.label} happen? Mark it done`
          : `Add the costs of ${reminder.label}`,
    body:
      reminder.kind === "departure"
        ? null
        : reminder.kind === "unconfirmed"
          ? `It was planned to end on ${day(reminder.date)}`
          : "Tolls, parking and stays recorded there count in its cost per km",
    href: reminder.link,
    vehicleId: reminder.vehicleId,
  }));
}

/** The latest full tank well below the vehicle's average, if it's recent. */
export function mileageCandidate(
  vehicleId: string,
  summary: FuelSummary,
  today: string,
): Candidate | null {
  const { lastMileage: last, averageMileage, mileageSequences } = summary;
  if (!last || !averageMileage || mileageSequences < MILEAGE_MIN_CYCLES) return null;
  const filled = last.date.slice(0, 10);
  if (daysBetween(filled, today) > MILEAGE_RECENT_DAYS) return null;
  const average = new Prisma.Decimal(averageMileage);
  const latest = new Prisma.Decimal(last.mileage);
  if (average.lte(0)) return null;
  const drop = average.minus(latest).div(average).times(100).toDecimalPlaces(0).toNumber();
  if (drop < MILEAGE_DROP_PERCENT) return null;
  const unit = `km/${FUEL_UNIT[summary.fuelType]}`;
  return {
    dedupeKey: `fuel:${vehicleId}:${last.date}`,
    category: NotificationCategory.FUEL,
    kind: "fuel.mileage_drop",
    priority: MEDIUM,
    title: `Mileage dropped to ${latest.toFixed(1)} ${unit}`,
    body: `On the full tank of ${day(filled)}: ${drop}% below the average of ${average.toFixed(1)} ${unit}`,
    href: "/fuel",
    vehicleId,
  };
}

/** Last month's spending across the user's vehicles (loan principal left out), once a month. */
export function summaryCandidate(
  month: string,
  totals: { spent: Prisma.Decimal; fuel: Prisma.Decimal; records: number; vehicles: number },
): Candidate | null {
  if (!totals.records) return null;
  const across = totals.vehicles === 1 ? "1 vehicle" : `${totals.vehicles} vehicles`;
  return {
    dedupeKey: `summary:${month}`,
    category: NotificationCategory.EXPENSES,
    kind: "summary.monthly",
    priority: LOW,
    title: `${monthName(month)} ${month.slice(0, 4)}: ${rupees(totals.spent)} spent`,
    body: `Fuel ${rupees(totals.fuel)} of it · across ${across}`,
    href: "/expenses",
    vehicleId: null,
  };
}

/** The user's own reminders in their window or overdue. */
export function reminderCandidates(reminders: Reminder[]): Candidate[] {
  return reminders.flatMap((reminder) => {
    const overdue = reminder.state === ReminderState.OVERDUE;
    if (!overdue && reminder.state !== ReminderState.DUE) return [];
    return [
      {
        dedupeKey: `reminder:${reminder.id}:${reminder.dueDate}:${reminder.state}`,
        category: NotificationCategory.REMINDERS,
        kind: overdue ? "reminder.overdue" : "reminder.due",
        priority: overdue ? HIGH : MEDIUM,
        title: `${reminder.title} ${overdue ? "was" : "is"} due on ${day(reminder.dueDate)}`,
        body: reminder.notes,
        href: `/notifications/reminders?reminder=${reminder.id}`,
        vehicleId: reminder.vehicleId,
      },
    ];
  });
}

/** A vehicle another account offered you: open until accepted, declined or expired. */
export function transferCandidates(
  transfers: {
    id: string;
    vehicleName: string;
    registrationNumber: string;
    expiresAt: Date;
    fromUser: { name: string };
  }[],
): Candidate[] {
  return transfers.map((transfer) => ({
    dedupeKey: `transfer:${transfer.id}`,
    category: NotificationCategory.REMINDERS,
    kind: "transfer.incoming",
    priority: NotificationPriority.HIGH,
    title: `${transfer.fromUser.name} wants to move ${transfer.vehicleName} to your garage`,
    body: `${transfer.registrationNumber}, with all its records and files. Accept or decline by ${day(transfer.expiresAt.toISOString().slice(0, 10))}.`,
    href: `/garage?transfer=${transfer.id}`,
    // The vehicle is still the sender's: never linked to it.
    vehicleId: null,
  }));
}

const DOCUMENT_DUE = /^\/documents\/[0-9a-f-]{36}$/;

/** A document expiring or expired opens its renewal (the Documents form with `?renew=1`). */
export function actionOf(kind: string, href: string | null): NotificationItem["action"] {
  if (
    (kind === "document.expiring" || kind === "document.expired") &&
    href &&
    DOCUMENT_DUE.test(href)
  ) {
    return { label: "Renew", href: `${href}/edit?renew=1` };
  }
  return null;
}
