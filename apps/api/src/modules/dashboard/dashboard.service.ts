import {
  type DashboardMaintenance,
  type DashboardMetrics,
  type DashboardOverview,
  type DashboardOverviewQuery,
  type DashboardSection,
  type DrivingOverview,
  type ExpiryItem,
  type FuelOverview,
  istToday,
  type PeriodWindow,
  ReportingPeriod,
  resolvePeriod,
  type SpendingOverview,
  type Vehicle,
  type VehicleStatus,
} from "@automate/shared";
import { Injectable, Logger } from "@nestjs/common";

import { Prisma } from "@/generated/prisma/client";
import { ExpenseFiguresService } from "@/modules/expenses/expense-figures.service";
import { FuelService } from "@/modules/fuel/fuel.service";
import { MaintenanceService } from "@/modules/maintenance/maintenance.service";
import { VehiclesService } from "@/modules/vehicles/vehicles.service";

import { buildMetrics, type WindowFigures } from "./metrics";
import { drivingOverview, fuelOverview, spendingOverview, trendMonths } from "./spending";
import { expiryDates, vehicleStatus } from "./vehicle-status";

const SECTION_ERRORS = {
  status: "Couldn't work out the vehicle status.",
  metrics: "Couldn't load this period's figures.",
  spending: "Couldn't load the spending.",
  fuel: "Couldn't load the fuel figures.",
  maintenance: "Couldn't load maintenance.",
  expiries: "Couldn't load the expiry dates.",
  driving: "Couldn't load the driving figures.",
} as const;

/**
 * The dashboard for one vehicle (docs/architecture/dashboard.md): it owns no records and computes
 * nothing itself; each section asks the module that owns the figures.
 */
@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly vehicles: VehiclesService,
    private readonly figures: ExpenseFiguresService,
    private readonly fuel: FuelService,
    private readonly maintenance: MaintenanceService,
  ) {}

  async overview(
    userId: string,
    { vehicleId, period, from, to }: DashboardOverviewQuery,
  ): Promise<DashboardOverview> {
    const vehicle = await this.vehicles.get(userId, vehicleId);
    const now = new Date();
    const custom = period === ReportingPeriod.CUSTOM ? { from: from!, to: to! } : undefined;
    const window = resolvePeriod(period, now, custom);
    const [status, metrics, spending, fuel, maintenance, expiries, driving] = await Promise.all([
      this.section("status", () => this.status(userId, vehicle, now)),
      this.section("metrics", () => this.metrics(userId, vehicle, window)),
      this.section("spending", () => this.spending(userId, vehicle, window)),
      this.section("fuel", () => this.fuelSection(userId, vehicle, window)),
      this.section("maintenance", () => this.maintenanceSection(userId, vehicle, window)),
      this.section("expiries", () => this.expiries(userId, vehicle, now)),
      this.section("driving", () => this.driving(userId, vehicle, window, now)),
    ]);
    return {
      vehicle,
      period: window,
      status,
      metrics,
      spending,
      fuel,
      maintenance,
      expiries,
      driving,
    };
  }

  /** One section, isolated: a failure is logged and shown in that section only. */
  private async section<T>(
    name: keyof typeof SECTION_ERRORS,
    compute: () => Promise<T | null>,
  ): Promise<DashboardSection<T>> {
    try {
      const data = await compute();
      return data === null ? { state: "empty" } : { state: "ok", data };
    } catch (error) {
      this.logger.error(
        `Dashboard section "${name}" failed`,
        error instanceof Error ? error.stack : String(error),
      );
      return { state: "error", message: SECTION_ERRORS[name] };
    }
  }

  private async status(userId: string, vehicle: Vehicle, now: Date): Promise<VehicleStatus> {
    const [insurance, maintenance] = await Promise.all([
      this.figures.latestInsurance(userId, vehicle.id),
      this.maintenance.statusFor(userId, vehicle.id),
    ]);
    return vehicleStatus({ vehicle, insurance, maintenance, today: istToday(now) });
  }

  /** From the Maintenance module; empty until the vehicle has a schedule or a service record. */
  private async maintenanceSection(
    userId: string,
    vehicle: Vehicle,
    window: PeriodWindow,
  ): Promise<DashboardMaintenance | null> {
    const overview = await this.maintenance.overview(userId, vehicle.id, {
      period: window.period,
      from: window.from,
      to: window.to,
    });
    const schedules = Object.values(overview.counts).reduce((sum, count) => sum + count, 0);
    if (!schedules && !overview.recordCount) return null;
    return {
      state: overview.state,
      overdue: overview.counts.OVERDUE,
      dueSoon: overview.counts.DUE + overview.counts.DUE_SOON,
      schedules: [...overview.overdue, ...overview.upcoming].slice(0, 4),
      lastService: overview.recent[0] ?? null,
    };
  }

  private async expiries(userId: string, vehicle: Vehicle, now: Date): Promise<ExpiryItem[]> {
    const insurance = await this.figures.latestInsurance(userId, vehicle.id);
    return expiryDates({ vehicle, insurance, today: istToday(now) });
  }

  /** From odometer readings; empty until the vehicle has one. */
  private async driving(
    userId: string,
    vehicle: Vehicle,
    window: PeriodWindow,
    now: Date,
  ): Promise<DrivingOverview | null> {
    const [usage, lastReading] = await Promise.all([
      this.figures.usage(userId, vehicle.id, window, new Prisma.Decimal(0)),
      this.figures.lastReading(userId, vehicle.id, window.to),
    ]);
    return drivingOverview(usage, lastReading, window, istToday(now));
  }

  /** Empty until the vehicle has an expense (fill-ups included). */
  private async spending(
    userId: string,
    vehicle: Vehicle,
    window: PeriodWindow,
  ): Promise<SpendingOverview | null> {
    if (!(await this.figures.hasAny(userId, vehicle.id))) return null;
    const months = trendMonths(window);
    const [inPeriod, monthly] = await Promise.all([
      this.figures.byCategory(userId, vehicle.id, window, false),
      this.figures.byCategory(userId, vehicle.id, { from: `${months[0]}-01`, to: window.to }, true),
    ]);
    return spendingOverview(inPeriod, monthly, months);
  }

  /** Empty until the vehicle has a fill-up. */
  private async fuelSection(
    userId: string,
    vehicle: Vehicle,
    window: PeriodWindow,
  ): Promise<FuelOverview | null> {
    if (!(await this.fuel.hasFills(userId, vehicle.id))) return null;
    const [[fuel], totals] = await Promise.all([
      this.fuel.inWindows(userId, vehicle.id, [window]),
      this.figures.totals(userId, vehicle.id, window),
    ]);
    return fuelOverview(fuel!, totals.fuel);
  }

  /** Empty until the vehicle has a fill-up or an expense. */
  private async metrics(
    userId: string,
    vehicle: Vehicle,
    window: PeriodWindow,
  ): Promise<DashboardMetrics | null> {
    if (!(await this.figures.hasAny(userId, vehicle.id))) return null;
    const [fuelNow, fuelBefore] = await this.fuel.inWindows(userId, vehicle.id, [
      window,
      window.previous,
    ]);
    const figures = async (range: { from: string; to: string }, fuel: WindowFigures["fuel"]) => {
      const totals = await this.figures.totals(userId, vehicle.id, range);
      const usage = await this.figures.usage(userId, vehicle.id, range, totals.operating);
      return { totals, usage, fuel };
    };
    const [now, before] = await Promise.all([
      figures(window, fuelNow!),
      figures(window.previous, fuelBefore!),
    ]);
    return buildMetrics(now, before);
  }
}
