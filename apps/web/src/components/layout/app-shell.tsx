import { Outlet } from "react-router";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { PreferenceSync } from "@/features/settings/components/preference-sync";

// shadcn's SidebarProvider writes this cookie but only Next.js reads it back; restore it here.
const sidebarStartsOpen = () => !document.cookie.includes("sidebar_state=false");

/** Authenticated layout: sidebar (drawer on mobile) + header + routed page. */
export function AppShell() {
  return (
    <SidebarProvider defaultOpen={sidebarStartsOpen()}>
      <AppSidebar />
      {/* Room for the phone's bottom nav, so nothing hides behind it. */}
      <SidebarInset className="min-w-0 pb-20 md:pb-0">
        <AppHeader />
        <PreferenceSync />
        <Outlet />
      </SidebarInset>
      <BottomNav />
    </SidebarProvider>
  );
}
