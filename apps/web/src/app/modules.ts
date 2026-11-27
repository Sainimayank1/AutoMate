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

export type NavGroup = "overview" | "vehicle" | "insights" | "account";

export type AppModule = {
  id: string;
  title: string;
  description: string;
  path: string;
  icon: LucideIcon;
  navGroup: NavGroup;
  /** Route module; must export `Component`. Each module becomes its own JS chunk. */
  lazy: () => Promise<{ Component: ComponentType }>;
};

export const NAV_GROUP_LABELS: Record<NavGroup, string> = {
  overview: "Overview",
  vehicle: "Vehicle",
  insights: "Insights",
  account: "Account",
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
    navGroup: "vehicle",
    lazy: () => import("@/features/garage/route"),
  },
  {
    id: "fuel",
    title: "Fuel",
    description: "Refills, mileage and fuel spending.",
    path: "/fuel",
    icon: Fuel,
    navGroup: "vehicle",
    lazy: () => import("@/features/fuel/route"),
  },
  {
    id: "expenses",
    title: "Expenses",
    description: "Every rupee spent on your vehicle.",
    path: "/expenses",
    icon: ReceiptIndianRupee,
    navGroup: "vehicle",
    lazy: () => import("@/features/expenses/route"),
  },
  {
    id: "maintenance",
    title: "Maintenance",
    description: "Service schedules, components and service history.",
    path: "/maintenance",
    icon: Wrench,
    navGroup: "vehicle",
    lazy: () => import("@/features/maintenance/route"),
  },
  {
    id: "documents",
    title: "Documents",
    description: "RC, insurance, PUC and other documents with expiry reminders.",
    path: "/documents",
    icon: FileText,
    navGroup: "vehicle",
    lazy: () => import("@/features/documents/route"),
  },
  {
    id: "trips",
    title: "Trips",
    description: "Journeys, distances and travel costs.",
    path: "/trips",
    icon: Map,
    navGroup: "vehicle",
    lazy: () => import("@/features/trips/route"),
  },
  {
    id: "analytics",
    title: "Analytics",
    description: "Usage trends and total cost of ownership.",
    path: "/analytics",
    icon: ChartNoAxesCombined,
    navGroup: "insights",
    lazy: () => import("@/features/analytics/route"),
  },
  {
    id: "assistant",
    title: "AI Assistant",
    description: "Ask questions about your vehicle and its records.",
    path: "/assistant",
    icon: Bot,
    navGroup: "insights",
    lazy: () => import("@/features/assistant/route"),
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Reminders and alerts across all modules.",
    path: "/notifications",
    icon: Bell,
    navGroup: "account",
    lazy: () => import("@/features/notifications/route"),
  },
  {
    id: "settings",
    title: "Settings",
    description: "Profile, preferences and security.",
    path: "/settings",
    icon: Settings,
    navGroup: "account",
    lazy: () => import("@/features/settings/route"),
  },
  {
    id: "backup",
    title: "Backup & Export",
    description: "Export, back up and restore your data.",
    path: "/backup",
    icon: DatabaseBackup,
    navGroup: "account",
    lazy: () => import("@/features/backup/route"),
  },
] as const satisfies readonly AppModule[];

export type ModuleId = (typeof appModules)[number]["id"];

export function getModule(id: ModuleId): AppModule {
  return appModules.find((module) => module.id === id)!;
}
