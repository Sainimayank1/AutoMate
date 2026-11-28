import {
  inQuietHours,
  NotificationPriority,
  type PushConfig,
  type PushPayload,
  type PushSubscriptionValues,
} from "@automate/shared";
import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import webpush, { WebPushError } from "web-push";

import type { Env } from "@/config/env.validation";
import { PrismaService } from "@/database/prisma.service";
import type { PushSubscription as SubscriptionRow } from "@/generated/prisma/client";
import { deviceName } from "@/modules/settings/device";
import { SettingsService } from "@/modules/settings/settings.service";

import { NotificationsService } from "./notifications.service";

/** More than this many at once arrive as one summary push. */
const MAX_SEPARATE = 3;
/** Push services may hold a push this long for an offline device. */
const TTL_SECONDS = 24 * 60 * 60;
const indiaTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * Web Push (notifications.md §1): devices subscribe with the browser's PushSubscription; a
 * scheduled job (`POST /internal/notifications/dispatch`) brings each subscribed user's inbox up
 * to date and pushes what's new, high and medium priority only, never twice, never during quiet
 * hours (they wait for the next run after). Off unless the VAPID keys are configured.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly vapid: { subject: string; publicKey: string; privateKey: string } | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    config: ConfigService<Env, true>,
  ) {
    const publicKey = config.get("PUSH_VAPID_PUBLIC_KEY", { infer: true });
    const privateKey = config.get("PUSH_VAPID_PRIVATE_KEY", { infer: true });
    const subject = config.get("PUSH_CONTACT", { infer: true });
    this.vapid = publicKey && privateKey && subject ? { subject, publicKey, privateKey } : null;
  }

  config(): PushConfig {
    return { publicKey: this.vapid?.publicKey ?? null };
  }

  /** This device, for this user (a device that changes accounts moves with the sign-in). */
  async subscribe(userId: string, values: PushSubscriptionValues, userAgent: string | null) {
    if (!this.vapid) throw new ServiceUnavailableException("Push notifications aren't set up yet.");
    const data = {
      userId,
      p256dh: values.keys.p256dh,
      auth: values.keys.auth,
      device: deviceName(userAgent),
    };
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: values.endpoint },
      create: { endpoint: values.endpoint, ...data },
      update: data,
    });
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  async dispatch(now = new Date()): Promise<{ users: number; pushed: number }> {
    if (!this.vapid) return { users: 0, pushed: 0 };
    const subscriptions = await this.prisma.pushSubscription.findMany({
      select: { userId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    // Only what appears after a user's first device subscribed: no backlog flood.
    const since = new Map<string, Date>();
    for (const row of subscriptions)
      if (!since.has(row.userId)) since.set(row.userId, row.createdAt);

    let pushed = 0;
    for (const [userId, from] of since) {
      try {
        pushed += await this.dispatchUser(userId, from, now);
      } catch (error) {
        this.logger.warn({ err: error, userId }, "Push dispatch failed for a user");
      }
    }
    return { users: since.size, pushed };
  }

  private async dispatchUser(userId: string, from: Date, now: Date): Promise<number> {
    const { notifications: prefs, quietHours } = await this.settings.preferences(userId);
    if (!prefs.enabled || inQuietHours(quietHours, indiaTime.format(now))) return 0;
    await this.notifications.sync(userId, { force: true });
    // Raised by that sync a moment after `now`, so compare against the time after it.
    const until = new Date();
    const pending = await this.prisma.notification.findMany({
      where: {
        userId,
        pushedAt: null,
        dismissedAt: null,
        readAt: null,
        activeAt: { gte: from, lte: until },
        priority: { in: [NotificationPriority.HIGH, NotificationPriority.MEDIUM] },
      },
      orderBy: [{ priority: "asc" }, { activeAt: "desc" }],
      take: 50,
    });
    if (!pending.length) return 0;
    const payloads: PushPayload[] =
      pending.length > MAX_SEPARATE
        ? [
            {
              title: `${pending.length} reminders need you`,
              body: pending
                .slice(0, 3)
                .map((item) => item.title)
                .join(" · "),
              href: "/notifications",
              tag: "automate-summary",
            },
          ]
        : pending.map((item) => ({
            title: item.title,
            body: item.body,
            href: item.href ?? "/notifications",
            tag: item.id,
          }));
    if (!(await this.sendTo(userId, payloads))) return 0;
    await this.prisma.notification.updateMany({
      where: { id: { in: pending.map((item) => item.id) } },
      data: { pushedAt: now },
    });
    return pending.length;
  }

  /** True when at least one device took the pushes; devices the push service dropped are removed. */
  private async sendTo(userId: string, payloads: PushPayload[]): Promise<boolean> {
    const devices = await this.prisma.pushSubscription.findMany({ where: { userId } });
    let delivered = false;
    for (const device of devices) {
      let gone = false;
      for (const payload of payloads) {
        const outcome = await this.deliver(device, payload);
        if (outcome === "gone") {
          gone = true;
          break;
        }
        if (outcome === "sent") delivered = true;
      }
      if (gone) await this.prisma.pushSubscription.deleteMany({ where: { id: device.id } });
      else
        await this.prisma.pushSubscription.update({
          where: { id: device.id },
          data: { lastPushAt: new Date() },
        });
    }
    return delivered;
  }

  /** One push to one device (tests replace this). */
  async deliver(
    device: SubscriptionRow,
    payload: PushPayload,
  ): Promise<"sent" | "gone" | "failed"> {
    try {
      await webpush.sendNotification(
        { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
        JSON.stringify(payload),
        { TTL: TTL_SECONDS, vapidDetails: this.vapid! },
      );
      return "sent";
    } catch (error) {
      if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
        return "gone";
      }
      this.logger.warn({ err: error }, "A push couldn't be delivered");
      return "failed";
    }
  }
}
