import {
  Bell,
  Bot,
  Car,
  ChartNoAxesCombined,
  DatabaseBackup,
  FileText,
  Fuel,
  LayoutDashboard,
  type LucideIcon,
  Map,
  ReceiptIndianRupee,
  Settings,
  Wrench,
} from "lucide-react";
import type { ComponentType } from "react";
import type { RouteObject } from "react-router";

export type NavGroup = "overview" | "vehicles" | "management" | "intelligence" | "personal";

export type AppModule = {
  id: string;
  title: string;
  description: string;
  path: string;
  icon: LucideIcon;
  navGroup: NavGroup;
  /** Route module for `path`; must export `Component`. Each module becomes its own JS chunk. */
  lazy: () => Promise<{ Component: ComponentType }>;
  /** Sub-pages inside the app shell, relative to `path` (e.g. `:vehicleId`). */
  children?: RouteObject[];
  /** Full-page task flows outside the shell, with absolute paths (e.g. `/garage/new`). */
  taskRoutes?: RouteObject[];
};

/** Sidebar groups, in display order (Stitch dashboard). */
export const NAV_GROUP_LABELS: Record<NavGroup, string> = {
  overview: "Overview",
  vehicles: "My vehicles",
  management: "Management",
  intelligence: "Intelligence",
  personal: "Personal",
};

/**
 * Single source of truth for feature modules: the router and the sidebar are both built from it.
 * Adding a module = one entry here + src/features/<id>/route.tsx.
 */
export const appModules = [
  {
    id: "dashboard",
    title: "Dashboard",
    description: "Overview of your vehicle, costs and upcoming tasks.",
    path: "/dashboard",
    icon: LayoutDashboard,
    navGroup: "overview",
    lazy: () => import("@/features/dashboard/dashboard-route"),
  },
  {
    id: "garage",
    title: "Garage",
    description: "Your vehicles, their profiles and configuration.",
    path: "/garage",
    icon: Car,
    navGroup: "vehicles",
    lazy: () => import("@/features/garage/garage-route"),
    children: [
      {
        path: ":vehicleId",
        lazy: () => import("@/features/garage/vehicle-route"),
        handle: { title: "Vehicle details" },
      },
    ],
    taskRoutes: [
      { path: "/garage/new", lazy: () => import("@/features/garage/new-vehicle-route") },
      {
        path: "/garage/:vehicleId/edit",
        lazy: () => import("@/features/garage/edit-vehicle-route"),
      },
    ],
  },
  {
    id: "fuel",
    title: "Fuel",
    description: "Refills, mileage and fuel spending.",
    path: "/fuel",
    icon: Fuel,
    navGroup: "management",
    lazy: () => import("@/features/fuel/fuel-route"),
    taskRoutes: [
      { path: "/fuel/new", lazy: () => import("@/features/fuel/new-fuel-entry-route") },
      {
        path: "/fuel/:vehicleId/:entryId/edit",
        lazy: () => import("@/features/fuel/edit-fuel-entry-route"),
      },
    ],
  },
  {
    id: "expenses",
    title: "Expenses",
    description: "Every rupee spent on your vehicle.",
    path: "/expenses",
    icon: ReceiptIndianRupee,
    navGroup: "management",
    lazy: () => import("@/features/expenses/expenses-route"),
    children: [
      {
        path: "transactions",
        lazy: () => import("@/features/expenses/transactions-route"),
        handle: { title: "Transactions" },
        children: [
          {
            path: ":expenseId",
            lazy: () => import("@/features/expenses/expense-details-route"),
            handle: { title: "Expense" },
          },
        ],
      },
      {
        path: "categories",
        lazy: () => import("@/features/expenses/categories-route"),
        handle: { title: "Categories" },
      },
      {
        path: "recurring",
        lazy: () => import("@/features/expenses/recurring-route"),
        handle: { title: "Recurring" },
      },
      {
        path: "loans/:loanId",
        lazy: () => import("@/features/expenses/loan-details-route"),
        handle: { title: "Loan" },
      },
    ],
    taskRoutes: [
      { path: "/expenses/new", lazy: () => import("@/features/expenses/new-expense-route") },
      {
        path: "/expenses/recurring/new",
        lazy: () => import("@/features/expenses/recurring-form-route"),
      },
      {
        path: "/expenses/recurring/:recurringId/edit",
        lazy: () => import("@/features/expenses/recurring-form-route"),
      },
      { path: "/expenses/loans/new", lazy: () => import("@/features/expenses/loan-form-route") },
      {
        path: "/expenses/loans/:loanId/edit",
        lazy: () => import("@/features/expenses/loan-form-route"),
      },
      {
        path: "/expenses/:expenseId/edit",
        lazy: () => import("@/features/expenses/edit-expense-route"),
      },
    ],
  },
  {
    id: "maintenance",
    title: "Maintenance",
    description: "Service schedules, components and service history.",
    path: "/maintenance",
    icon: Wrench,
    navGroup: "management",
    lazy: () => import("@/features/maintenance/maintenance-route"),
    children: [
      {
        path: "schedules",
        lazy: () => import("@/features/maintenance/schedules-route"),
        handle: { title: "Schedules" },
        children: [
          {
            path: ":scheduleId",
            lazy: () => import("@/features/maintenance/schedule-details-route"),
            handle: { title: "Schedule" },
          },
        ],
      },
      {
        path: "history",
        lazy: () => import("@/features/maintenance/history-route"),
        handle: { title: "History" },
      },
      {
        path: "components",
        lazy: () => import("@/features/maintenance/components-route"),
        handle: { title: "Components" },
      },
      {
        path: "components/:componentId",
        lazy: () => import("@/features/maintenance/component-details-route"),
        handle: { title: "Component" },
      },
      {
        path: "records/:vehicleId/:recordId",
        lazy: () => import("@/features/maintenance/record-details-route"),
        handle: { title: "Service record" },
      },
      {
        path: "inspections",
        lazy: () => import("@/features/maintenance/inspections-route"),
        handle: { title: "Inspections" },
      },
      {
        path: "inspections/:inspectionId",
        lazy: () => import("@/features/maintenance/inspection-details-route"),
        handle: { title: "Inspection" },
      },
      {
        path: "workshops",
        lazy: () => import("@/features/maintenance/workshops-route"),
        handle: { title: "Workshops" },
      },
      {
        path: "workshops/:providerId",
        lazy: () => import("@/features/maintenance/workshop-details-route"),
        handle: { title: "Workshop" },
      },
    ],
    taskRoutes: [
      {
        path: "/maintenance/schedules/new",
        lazy: () => import("@/features/maintenance/new-schedule-route"),
      },
      {
        path: "/maintenance/schedules/:scheduleId/edit",
        lazy: () => import("@/features/maintenance/edit-schedule-route"),
      },
      {
        path: "/maintenance/components/new",
        lazy: () => import("@/features/maintenance/new-component-route"),
      },
      {
        path: "/maintenance/components/:componentId/edit",
        lazy: () => import("@/features/maintenance/edit-component-route"),
      },
      {
        path: "/maintenance/components/:componentId/replace",
        lazy: () => import("@/features/maintenance/replace-component-route"),
      },
      {
        path: "/maintenance/records/new",
        lazy: () => import("@/features/maintenance/new-record-route"),
      },
      {
        path: "/maintenance/records/:vehicleId/:recordId/edit",
        lazy: () => import("@/features/maintenance/edit-record-route"),
      },
      {
        path: "/maintenance/inspections/new",
        lazy: () => import("@/features/maintenance/new-inspection-route"),
      },
      {
        path: "/maintenance/inspections/:inspectionId/edit",
        lazy: () => import("@/features/maintenance/edit-inspection-route"),
      },
    ],
  },
  {
    id: "documents",
    title: "Documents",
    description: "RC, insurance, PUC and other documents with expiry reminders.",
    path: "/documents",
    icon: FileText,
    navGroup: "management",
    lazy: () => import("@/features/documents/route"),
  },
  {
    id: "trips",
    title: "Trips",
    description: "Journeys, distances and travel costs.",
    path: "/trips",
    icon: Map,
    navGroup: "management",
    lazy: () => import("@/features/trips/trips-route"),
    children: [
      {
        path: ":tripId",
        lazy: () => import("@/features/trips/trip-details-route"),
        handle: { title: "Trip" },
      },
    ],
    taskRoutes: [
      { path: "/trips/new", lazy: () => import("@/features/trips/new-trip-route") },
      { path: "/trips/:tripId/edit", lazy: () => import("@/features/trips/edit-trip-route") },
    ],
  },
  {
    id: "analytics",
    title: "Analytics",
    description: "Usage trends and total cost of ownership.",
    path: "/analytics",
    icon: ChartNoAxesCombined,
    navGroup: "intelligence",
    lazy: () => import("@/features/analytics/route"),
  },
  {
    id: "assistant",
    title: "AI Assistant",
    description: "Ask questions about your vehicle and its records.",
    path: "/assistant",
    icon: Bot,
    navGroup: "intelligence",
    lazy: () => import("@/features/assistant/route"),
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Reminders and alerts across all modules.",
    path: "/notifications",
    icon: Bell,
    navGroup: "personal",
    lazy: () => import("@/features/notifications/route"),
  },
  {
    id: "settings",
    title: "Settings",
    description: "Profile, preferences and security.",
    path: "/settings",
    icon: Settings,
    navGroup: "personal",
    lazy: () => import("@/features/settings/route"),
  },
  {
    id: "backup",
    title: "Backup & Export",
    description: "Export, back up and restore your data.",
    path: "/backup",
    icon: DatabaseBackup,
    navGroup: "personal",
    lazy: () => import("@/features/backup/route"),
  },
] as const satisfies readonly AppModule[];

export type ModuleId = (typeof appModules)[number]["id"];

export function getModule(id: ModuleId): AppModule {
  return appModules.find((module) => module.id === id)!;
}
