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
    lazy: () => import("@/features/dashboard/route"),
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
    lazy: () => import("@/features/fuel/route"),
  },
  {
    id: "expenses",
    title: "Expenses",
    description: "Every rupee spent on your vehicle.",
    path: "/expenses",
    icon: ReceiptIndianRupee,
    navGroup: "management",
    lazy: () => import("@/features/expenses/route"),
  },
  {
    id: "maintenance",
    title: "Maintenance",
    description: "Service schedules, components and service history.",
    path: "/maintenance",
    icon: Wrench,
    navGroup: "management",
    lazy: () => import("@/features/maintenance/route"),
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
    lazy: () => import("@/features/trips/route"),
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
