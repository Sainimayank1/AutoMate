import { type DashboardLayout, normalizeDashboardLayout } from "@automate/shared";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "@/database/prisma.service";

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
