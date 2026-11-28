import type { ReactNode } from "react";
import { Link } from "react-router";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = [
  { value: "overview", label: "Overview", path: "/maintenance" },
  { value: "schedules", label: "Schedules", path: "/maintenance/schedules" },
  { value: "history", label: "History", path: "/maintenance/history" },
  { value: "components", label: "Components", path: "/maintenance/components" },
  { value: "inspections", label: "Inspections", path: "/maintenance/inspections" },
  { value: "workshops", label: "Workshops", path: "/maintenance/workshops" },
  { value: "analytics", label: "Analytics", path: "/maintenance/analytics" },
  { value: "planner", label: "Planner", path: "/maintenance/planner" },
] as const;

/**
 * Stitch "Maintenance": one header and the module's tabs above every tab page.
 * Tabs are links (each tab is a route), styled with the shared Tabs primitive.
 */
export function MaintenanceLayout({
  tab,
  description,
  actions,
  children,
}: {
  tab: (typeof TABS)[number]["value"];
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <PageContainer>
      <PageHeader title="Maintenance" description={description} actions={actions} />
      {/* Eight tabs don't fit a phone: they scroll sideways on their own, never the page. */}
      <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <Tabs value={tab}>
          <TabsList aria-label="Maintenance sections">
            {TABS.map((item) => (
              <TabsTrigger key={item.value} value={item.value} asChild>
                <Link to={item.path}>{item.label}</Link>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      {children}
    </PageContainer>
  );
}
