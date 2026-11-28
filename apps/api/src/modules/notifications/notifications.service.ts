import {
  addDays,
  istToday,
  type NotificationItem,
  type NotificationListQuery,
  type NotificationPreferences,
  type NotificationSummary,
  pageMeta,
  type ReadAllNotificationsValues,
} from "@automate/shared";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";

import { pageArgs, Paginated } from "@/common/pagination/paginated";
import { PrismaService } from "@/database/prisma.service";
import { Prisma } from "@/generated/prisma/client";
import { DocumentsService } from "@/modules/documents/documents.service";
import { ExpenseFiguresService } from "@/modules/expenses/expense-figures.service";
import { RecurringExpensesService } from "@/modules/expenses/recurring-expenses.service";
import { FuelService } from "@/modules/fuel/fuel.service";
import { MaintenanceService } from "@/modules/maintenance/maintenance.service";
import { SettingsService } from "@/modules/settings/settings.service";
import { TripPlansService } from "@/modules/trips/trip-plans.service";

import {
  actionOf,
  type Candidate,
  documentCandidates,
  EVENT_PREFIXES,
  maintenanceCandidates,
  mileageCandidate,
  paymentCandidates,
  reminderCandidates,
  summaryCandidate,
  transferCandidates,
  tripCandidates,
} from "./notification-rules";
import { RemindersService } from "./reminders.service";

const NOT_FOUND = "Notification not found";
/** How often the inbox is brought up to date from the records (any read within it reuses it). */
const SYNC_EVERY_MS = 60 * 1000;
const LATEST = 6;
const WITH_VEHICLE = {
  vehicle: {
    select: { id: true, make: true, model: true, variant: true, registrationNumber: true },
  },
} as const satisfies Prisma.NotificationInclude;
type Row = Prisma.NotificationGetPayload<{ include: typeof WITH_VEHICLE }>;

function toItem(row: Row): NotificationItem {
  const { vehicle } = row;
  return {
    id: row.id,
    category: row.category,
    kind: row.kind,
    priority: row.priority,
    title: row.title,
    body: row.body,
    href: row.href,
    action: actionOf(row.kind, row.href),
    vehicle: vehicle && {
      id: vehicle.id,
      name: [vehicle.make, vehicle.model, vehicle.variant].filter(Boolean).join(" "),
      registrationNumber: vehicle.registrationNumber,
    },
    activeAt: row.activeAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
    snoozedUntil: row.snoozedUntil?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

type Source = {
  /** Dedupe-key prefix: a source that fails keeps its rows as they are. */
  prefix: string;
  enabled: boolean;
  run: () => Promise<(Candidate | null)[]>;
};

/**
 * Notifications (M10, docs/architecture/notifications.md). The inbox is raised from the modules'
 * records when it's read (at most once a minute per user): each source lists what applies now,
 * new keys are added, and rows whose reminder no longer applies (done, paid, renewed, switched
 * off) are removed. Events (mileage drops, monthly summaries) stay until dismissed. No cron or
 * queue: an inbox nobody opens needs no work.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  // shortcut: a per-process throttle; with several API instances each one syncs on its own, which
  // is harmless (a sync is idempotent). Move to a stored timestamp if that ever matters.
  private readonly syncedAt = new Map<string, number>();
  /** A sync on its way: concurrent reads (the bell and the list) wait for it, not skip it. */
  private readonly running = new Map<string, Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly documents: DocumentsService,
    private readonly maintenance: MaintenanceService,
    private readonly payments: RecurringExpensesService,
    private readonly tripPlans: TripPlansService,
    private readonly fuel: FuelService,
    private readonly figures: ExpenseFiguresService,
    private readonly reminders: RemindersService,
  ) {}

  /** The next read brings the inbox up to date (after the user changes a reminder). */
  forget(userId: string) {
    this.syncedAt.delete(userId);
  }

  async sync(userId: string, { force = false } = {}): Promise<void> {
    const inFlight = this.running.get(userId);
    if (inFlight) return inFlight;
    const now = Date.now();
    if (!force && now - (this.syncedAt.get(userId) ?? 0) < SYNC_EVERY_MS) return;
    this.syncedAt.set(userId, now);
    const run = this.raise(userId, now).finally(() => this.running.delete(userId));
    this.running.set(userId, run);
    return run;
  }

  /** Brings the stored inbox in line with the records (one sync's work). */
  private async raise(userId: string, now: number): Promise<void> {
    const { notifications: prefs } = await this.settings.preferences(userId);
    const failed: string[] = [];
    const candidates: Candidate[] = [];
    if (prefs.enabled) {
      const results = await Promise.all(
        this.sources(userId, prefs).map(async (source) => {
          if (!source.enabled) return [];
          try {
            return (await source.run()).filter((item): item is Candidate => item !== null);
          } catch (error) {
            failed.push(source.prefix);
            this.logger.warn({ err: error, source: source.prefix }, "A notification source failed");
            return [];
          }
        }),
      );
      candidates.push(...results.flat());
    }

    if (candidates.length) {
      await this.prisma.notification.createMany({
        data: candidates.map((candidate) => ({ ...candidate, userId, activeAt: new Date(now) })),
        skipDuplicates: true,
      });
    }
    const keep = [...EVENT_PREFIXES, ...failed];
    await this.prisma.notification.deleteMany({
      where: {
        userId,
        dedupeKey: { notIn: candidates.map((candidate) => candidate.dedupeKey) },
        NOT: keep.map((prefix) => ({ dedupeKey: { startsWith: prefix } })),
      },
    });
  }

  async list(userId: string, query: NotificationListQuery): Promise<Paginated<NotificationItem>> {
    await this.sync(userId);
    const where = this.where(userId, query, new Date());
    const [rows, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        include: WITH_VEHICLE,
        // Snoozed: the soonest to come back first; otherwise the newest.
        orderBy:
          query.filter === "snoozed"
            ? [{ activeAt: "asc" }, { id: "asc" }]
            : [{ activeAt: "desc" }, { id: "desc" }],
        ...pageArgs(query),
      }),
      this.prisma.notification.count({ where }),
    ]);
    return new Paginated(rows.map(toItem), pageMeta(query, total));
  }

  /** The header bell: unread count and the latest few, unread first. */
  async summary(userId: string, { force = false } = {}): Promise<NotificationSummary> {
    await this.sync(userId, { force });
    const now = new Date();
    const visible = this.where(userId, { filter: "all" }, now);
    const unreadWhere = { ...visible, readAt: null };
    const [unread, unreadRows] = await Promise.all([
      this.prisma.notification.count({ where: unreadWhere }),
      this.prisma.notification.findMany({
        where: unreadWhere,
        include: WITH_VEHICLE,
        orderBy: [{ activeAt: "desc" }, { id: "desc" }],
        take: LATEST,
      }),
    ]);
    const readRows =
      unreadRows.length < LATEST
        ? await this.prisma.notification.findMany({
            where: { ...visible, readAt: { not: null } },
            include: WITH_VEHICLE,
            orderBy: [{ activeAt: "desc" }, { id: "desc" }],
            take: LATEST - unreadRows.length,
          })
        : [];
    return { unread, latest: [...unreadRows, ...readRows].map(toItem) };
  }

  async setRead(userId: string, id: string, read: boolean): Promise<NotificationItem> {
    await this.owned(userId, id);
    return toItem(
      await this.prisma.notification.update({
        where: { id },
        data: { readAt: read ? new Date() : null },
        include: WITH_VEHICLE,
      }),
    );
  }

  /** Back as unread at `until`. */
  async snooze(userId: string, id: string, until: string): Promise<NotificationItem> {
    await this.owned(userId, id);
    const at = new Date(until);
    return toItem(
      await this.prisma.notification.update({
        where: { id },
        data: { snoozedUntil: at, activeAt: at, readAt: null },
        include: WITH_VEHICLE,
      }),
    );
  }

  /** Gone from the inbox; the row stays only so the same reminder isn't raised again. */
  async dismiss(userId: string, id: string): Promise<void> {
    await this.owned(userId, id);
    await this.prisma.notification.update({ where: { id }, data: { dismissedAt: new Date() } });
  }

  async readAll(userId: string, { category }: ReadAllNotificationsValues) {
    const { count } = await this.prisma.notification.updateMany({
      where: { ...this.where(userId, { filter: "unread", category }, new Date()) },
      data: { readAt: new Date() },
    });
    return { updated: count };
  }

  private where(
    userId: string,
    { filter, category, vehicleId }: Partial<NotificationListQuery>,
    now: Date,
  ): Prisma.NotificationWhereInput {
    return {
      userId,
      dismissedAt: null,
      ...(category && { category }),
      ...(vehicleId && { vehicleId }),
      // A snooze moves `activeAt` to when it comes back.
      activeAt: filter === "snoozed" ? { gt: now } : { lte: now },
      ...(filter === "unread" && { readAt: null }),
    };
  }

  private async owned(userId: string, id: string) {
    const row = await this.prisma.notification.findFirst({
      where: { id, userId, dismissedAt: null },
      select: { id: true },
    });
    if (!row) throw new NotFoundException(NOT_FOUND);
  }

  private sources(userId: string, prefs: NotificationPreferences): Source[] {
    const today = istToday(new Date());
    const vehicles = () =>
      this.prisma.vehicle.findMany({
        where: { userId, archivedAt: null },
        select: { id: true },
      });
    return [
      {
        prefix: "document:",
        enabled: prefs.documents,
        run: async () => documentCandidates(await this.documents.toRemind(userId), today),
      },
      {
        prefix: "maintenance:",
        enabled: prefs.maintenance,
        run: async () => {
          const list = await vehicles();
          const due = await Promise.all(
            list.map((vehicle) => this.maintenance.reminders(userId, vehicle.id)),
          );
          return maintenanceCandidates(due.flat());
        },
      },
      {
        prefix: "payment:",
        enabled: prefs.payments,
        // shortcut: the first 100 upcoming payments (90 days); a person has a handful of schedules.
        run: async () =>
          paymentCandidates(
            (await this.payments.payments(userId, { view: "upcoming", page: 1, pageSize: 100 }))
              .items,
          ),
      },
      {
        prefix: "trip:",
        enabled: prefs.trips,
        run: async () => tripCandidates(await this.tripPlans.reminders(userId, {})),
      },
      {
        prefix: "fuel:",
        enabled: prefs.fuel,
        run: async () =>
          Promise.all(
            (await vehicles()).map(async (vehicle) =>
              mileageCandidate(vehicle.id, await this.fuel.summary(userId, vehicle.id), today),
            ),
          ),
      },
      {
        prefix: "summary:",
        enabled: prefs.monthlySummary,
        run: async () => {
          const firstOfMonth = `${today.slice(0, 8)}01`;
          const from = `${addDays(firstOfMonth, -1).slice(0, 8)}01`;
          const window = { from, to: addDays(firstOfMonth, -1) };
          const list = await vehicles();
          const totals = await Promise.all(
            list.map((vehicle) => this.figures.totals(userId, vehicle.id, window)),
          );
          const zero = new Prisma.Decimal(0);
          return [
            summaryCandidate(from.slice(0, 7), {
              spent: totals.reduce((sum, item) => sum.plus(item.spent), zero),
              fuel: totals.reduce((sum, item) => sum.plus(item.fuel), zero),
              records: totals.reduce((sum, item) => sum + item.records, 0),
              vehicles: totals.filter((item) => item.records > 0).length,
            }),
          ];
        },
      },
      {
        prefix: "transfer:",
        enabled: true,
        run: async () => {
          const { email } = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
          return transferCandidates(
            await this.prisma.vehicleTransfer.findMany({
              where: {
                toEmail: email.toLowerCase(),
                status: "PENDING",
                expiresAt: { gt: new Date() },
              },
              include: { fromUser: { select: { name: true } } },
            }),
          );
        },
      },
      {
        prefix: "reminder:",
        enabled: true,
        run: async () => reminderCandidates(await this.reminders.open(userId)),
      },
    ];
  }
}
