import type { ReactNode } from "react";
import { Link } from "react-router";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Tabs that exist today; a later phase adds Analytics. */
const TABS = [
  { value: "overview", label: "Overview", path: "/maintenance" },
  { value: "schedules", label: "Schedules", path: "/maintenance/schedules" },
  { value: "history", label: "History", path: "/maintenance/history" },
  { value: "components", label: "Components", path: "/maintenance/components" },
  { value: "inspections", label: "Inspections", path: "/maintenance/inspections" },
  { value: "workshops", label: "Workshops", path: "/maintenance/workshops" },
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
      <Tabs value={tab}>
        <TabsList aria-label="Maintenance sections">
          {TABS.map((item) => (
            <TabsTrigger key={item.value} value={item.value} asChild>
              <Link to={item.path}>{item.label}</Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {children}
    </PageContainer>
  );
}
