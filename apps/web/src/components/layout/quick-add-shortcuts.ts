import {
  BellPlus,
  FileUp,
  Fuel,
  type LucideIcon,
  ReceiptIndianRupee,
  Route,
  Wrench,
} from "lucide-react";

export type Shortcut = { label: string; icon: LucideIcon; href: string };

/** The add forms, in the order of application-navigation.md, each for the active vehicle. */
export function shortcuts(vehicleId: string | undefined): Shortcut[] {
  const forVehicle = vehicleId ? `vehicle=${vehicleId}` : "";
  return [
    { label: "Fuel entry", icon: Fuel, href: "/fuel/new" },
    { label: "Expense", icon: ReceiptIndianRupee, href: "/expenses/new" },
    { label: "Service record", icon: Wrench, href: "/maintenance/records/new" },
    { label: "Trip", icon: Route, href: `/trips/new${forVehicle && `?${forVehicle}`}` },
    { label: "Document", icon: FileUp, href: "/documents/new" },
    {
      label: "Reminder",
      icon: BellPlus,
      href: `/notifications/reminders?new=1${forVehicle && `&${forVehicle}`}`,
    },
  ];
}
