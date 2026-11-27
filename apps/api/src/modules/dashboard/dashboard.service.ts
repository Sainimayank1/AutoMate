import {
  ACTIVITY_DEPTH,
  type ActivityItem,
  type DashboardActivityQuery,
  type DashboardInsights,
  type DashboardMaintenance,
  type DashboardOverview,
  type DashboardOverviewQuery,
  type DashboardSection,
  type DrivingOverview,
  type FuelOverview,
  istToday,
  pageMeta,
  type PeriodWindow,
  ReportingPeriod,
  resolvePeriod,
  type Vehicle,
  type VehicleStatus,
} from "@automate/shared";
import { Injectable, Logger } from "@nestjs/common";

import { Paginated } from "@/common/pagination/paginated";
import { ExpenseFiguresService } from "@/modules/expenses/expense-figures.service";
import { FuelService } from "@/modules/fuel/fuel.service";
import { MaintenanceService } from "@/modules/maintenance/maintenance.service";
import { ServiceRecordsService } from "@/modules/maintenance/service-records.service";
import { VehiclesService } from "@/modules/vehicles/vehicles.service";

import { expenseActivity, mergeNewest, serviceActivity } from "./activity";
import { buildInsights, type InsightInputs } from "./insights";
import { buildMetrics, type WindowFigures } from "./metrics";
import { drivingOverview, fuelOverview, spendingOverview, trendMonths } from "./spending";
import { expiryDates, type InsuranceOnRecord, vehicleStatus } from "./vehicle-status";

const SECTION_ERRORS = {
  status: "Couldn't work out the vehicle status.",
  metrics: "Couldn't load this period's figures.",
  spending: "Couldn't load the spending.",
  fuel: "Couldn't load the fuel figures.",
  maintenance: "Couldn't load maintenance.",
  expiries: "Couldn't load the expiry dates.",
  driving: "Couldn't load the driving figures.",
  insights: "Couldn't work out the insights.",
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
    private readonly records: ServiceRecordsService,
  ) {}

  async overview(
    userId: string,
    { vehicleId, period, from, to }: DashboardOverviewQuery,
  ): Promise<DashboardOverview> {
    const vehicle = await this.vehicles.get(userId, vehicleId);
    const now = new Date();
    const custom = period === ReportingPeriod.CUSTOM ? { from: from!, to: to! } : undefined;
    const window = resolvePeriod(period, now, custom);
    const today = istToday(now);
    // Loaded once and shared, since several sections read each: when records start, the insurance
    // policy, both windows' figures (the fuel engine runs once) and spending by category.
    const since = this.figures.firstDate(userId, vehicle.id);
    const insurance = this.figures.latestInsurance(userId, vehicle.id);
    const figures = this.windowFigures(userId, vehicle, window, since);
    const spent = this.spendingRows(userId, vehicle, window, since);
    const [status, metrics, spending, fuel, maintenance, expiries, driving, insights] =
      await Promise.all([
        this.section("status", () => this.status(userId, vehicle, insurance, today)),
        this.section("metrics", async () => {
          const both = await figures;
          // Compared only once records cover the whole earlier window (dashboard.md §1).
          return both && buildMetrics(both.now, both.before, both.since <= window.previous.from);
        }),
        this.section("spending", async () => {
          const rows = await spent;
          return rows && spendingOverview(rows.inPeriod, rows.monthly, rows.months);
        }),
        this.section("fuel", () => this.fuelSection(userId, vehicle, figures)),
        this.section("maintenance", () => this.maintenanceSection(userId, vehicle, window)),
        this.section("expiries", async () =>
          expiryDates({ vehicle, insurance: await insurance, today }),
        ),
        this.section("driving", () => this.driving(userId, vehicle, window, today, figures)),
        this.section("insights", async (): Promise<DashboardInsights> =>
          buildInsights({
            vehicleId: vehicle.id,
            window,
            figures: await figures,
            spending: await spent,
          }),
        ),
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
      insights,
    };
  }

  /**
   * What happened to the vehicle, newest first, a page at a time: fill-ups and expenses from
   * Expenses, service records from Maintenance. The feed goes back ACTIVITY_DEPTH events; older
   * ones are in each module.
   */
  async activity(
    userId: string,
    { vehicleId, page, pageSize }: DashboardActivityQuery,
  ): Promise<Paginated<ActivityItem>> {
    await this.vehicles.findOwned(userId, vehicleId);
    // shortcut: merges the newest page×size of each source in memory; fine within ACTIVITY_DEPTH,
    // use a UNION query if the feed ever needs to go deeper.
    const take = Math.min(page * pageSize, ACTIVITY_DEPTH);
    const [events, records] = await Promise.all([
      this.figures.events(userId, vehicleId, take),
      this.records.recent(userId, vehicleId, take),
    ]);
    const merged = mergeNewest(
      events.rows.map(expenseActivity),
      records.recent.map(serviceActivity),
    );
    const total = Math.min(events.count + records.count, ACTIVITY_DEPTH);
    const start = (page - 1) * pageSize;
    return new Paginated(
      start < total ? merged.slice(start, Math.min(start + pageSize, total)) : [],
      pageMeta({ page, pageSize }, total),
    );
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

  private async status(
    userId: string,
    vehicle: Vehicle,
    insurance: Promise<InsuranceOnRecord | null>,
    today: string,
  ): Promise<VehicleStatus> {
    const [policy, maintenance] = await Promise.all([
      insurance,
      this.maintenance.statusFor(userId, vehicle.id),
    ]);
    return vehicleStatus({ vehicle, insurance: policy, maintenance, today });
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

  /** From odometer readings (fill-ups and expenses); empty until the vehicle has one. */
  private async driving(
    userId: string,
    vehicle: Vehicle,
    window: PeriodWindow,
    today: string,
    figures: Promise<InsightInputs["figures"]>,
  ): Promise<DrivingOverview | null> {
    const [both, lastReading] = await Promise.all([
      figures,
      this.figures.lastReading(userId, vehicle.id, window.to),
    ]);
    return both && drivingOverview(both.now.usage, lastReading, window, today);
  }

  /**
   * Spending by category in the period and the window before, and by month over the trend months;
   * null until the vehicle has an expense (fill-ups included).
   */
  private async spendingRows(
    userId: string,
    vehicle: Vehicle,
    window: PeriodWindow,
    since: Promise<string | null>,
  ): Promise<InsightInputs["spending"]> {
    if (!(await since)) return null;
    const months = trendMonths(window);
    const [inPeriod, previous, monthly] = await Promise.all([
      this.figures.byCategory(userId, vehicle.id, window, false),
      this.figures.byCategory(userId, vehicle.id, window.previous, false),
      this.figures.byCategory(userId, vehicle.id, { from: `${months[0]}-01`, to: window.to }, true),
    ]);
    return { inPeriod, previous, monthly, months };
  }

  /** Empty until the vehicle has a fill-up; the period's figures are the metrics' own. */
  private async fuelSection(
    userId: string,
    vehicle: Vehicle,
    figures: Promise<InsightInputs["figures"]>,
  ): Promise<FuelOverview | null> {
    const [both, fills] = await Promise.all([figures, this.fuel.hasFills(userId, vehicle.id)]);
    return both && fills ? fuelOverview(both.now.fuel, both.now.totals.fuel) : null;
  }

  /** The period and its comparison window, from Expenses and Fuel; null with neither on record. */
  private async windowFigures(
    userId: string,
    vehicle: Vehicle,
    window: PeriodWindow,
    records: Promise<string | null>,
  ): Promise<InsightInputs["figures"]> {
    const since = await records;
    if (!since) return null;
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
    return { now, before, since };
  }
}
