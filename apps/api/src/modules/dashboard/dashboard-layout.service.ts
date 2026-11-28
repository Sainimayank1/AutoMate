import {
  type DashboardLayout,
  type DismissDashboardItemValues,
  normalizeDashboardLayout,
} from "@automate/shared";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "@/database/prisma.service";

const DISMISSED_KEEP = 200;

/**
 * The user's dashboard layout (docs/architecture/dashboard.md §3): which sections show, in what
 * order, and which key figures. Kept in `user_preferences.dashboard`; read back through
 * `normalizeDashboardLayout` so sections added later still appear.
 */
@Injectable()
export class DashboardLayoutService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<DashboardLayout> {
    const saved = await this.prisma.userPreference.findUnique({
      where: { userId },
      select: { dashboard: true },
    });
    return normalizeDashboardLayout(saved?.dashboard);
  }

  /** Information-only items dismissed for one vehicle (their item ids). */
  async dismissed(userId: string, vehicleId: string): Promise<string[]> {
    const saved = await this.prisma.userPreference.findUnique({
      where: { userId },
      select: { dashboardDismissed: true },
    });
    const prefix = `${vehicleId}:`;
    return (saved?.dashboardDismissed ?? [])
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length));
  }

  async dismiss(userId: string, { vehicleId, itemId }: DismissDashboardItemValues): Promise<void> {
    const key = `${vehicleId}:${itemId}`;
    const saved = await this.prisma.userPreference.findUnique({
      where: { userId },
      select: { dashboardDismissed: true },
    });
    // The latest DISMISSED_KEEP only: old ones are for vehicles or items long gone.
    const keys = [...(saved?.dashboardDismissed ?? []).filter((item) => item !== key), key].slice(
      -DISMISSED_KEEP,
    );
    await this.prisma.userPreference.upsert({
      where: { userId },
      create: { userId, dashboardDismissed: keys },
      update: { dashboardDismissed: keys },
    });
  }

  /** Validated by `dashboardLayoutSchema`; saved in its canonical form. */
  async save(userId: string, layout: DashboardLayout): Promise<DashboardLayout> {
    const dashboard = normalizeDashboardLayout(layout);
    await this.prisma.userPreference.upsert({
      where: { userId },
      create: { userId, dashboard },
      update: { dashboard },
    });
    return dashboard;
  }
}
