import { cn } from "cn";
import { Fuel, LayoutDashboard, Menu, Plus, ReceiptIndianRupee } from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router";

import { QuickAddSheet } from "@/components/layout/quick-add";
import { useSidebar } from "@/components/ui/sidebar";

const LINKS = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/fuel", label: "Fuel", icon: Fuel },
  { to: "/expenses", label: "Expenses", icon: ReceiptIndianRupee },
] as const;

const slot =
  "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-md text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Phones only (application-navigation.md, Stitch mobile screens): Home · Fuel · Add · Expenses ·
 * More. "Add" opens the quick-add sheet; "More" opens the full grouped nav in the sidebar drawer.
 * Forms and wizards render outside the shell, so it never sits under a form's own action bar.
 * Deviation: Stitch's older bar had Garage, Service and Co-Pilot; the AI assistant was dropped
 * and Add and More follow the navigation spec.
 */
export function BottomNav() {
  const { setOpenMobile } = useSidebar();
  const [adding, setAdding] = useState(false);
  const link = (item: (typeof LINKS)[number]) => (
    <NavLink
      key={item.to}
      to={item.to}
      className={({ isActive }) =>
        cn(slot, isActive ? "text-primary" : "text-muted-foreground hover:text-foreground")
      }
    >
      <item.icon className="size-5" aria-hidden />
      {item.label}
    </NavLink>
  );
  return (
    <>
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 items-center border-t bg-card/95 px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur supports-backdrop-filter:bg-card/80 md:hidden"
      >
        {link(LINKS[0])}
        {link(LINKS[1])}
        <button
          type="button"
          className={cn(slot, adding ? "text-primary" : "text-muted-foreground")}
          aria-haspopup="dialog"
          aria-expanded={adding}
          onClick={() => setAdding(true)}
        >
          <span className="-mt-5 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-4 ring-background">
            <Plus className="size-6" aria-hidden />
          </span>
          Add
        </button>
        {link(LINKS[2])}
        <button
          type="button"
          className={cn(slot, "text-muted-foreground hover:text-foreground")}
          onClick={() => setOpenMobile(true)}
        >
          <Menu className="size-5" aria-hidden />
          More
        </button>
      </nav>
      <QuickAddSheet open={adding} onOpenChange={setAdding} />
    </>
  );
}
