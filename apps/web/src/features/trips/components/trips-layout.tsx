import type { ReactNode } from "react";
import { Link } from "react-router";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Tabs that exist today; Planner and Analytics arrive in later phases. */
const TABS = [
  { value: "overview", label: "Overview", path: "/trips" },
  { value: "history", label: "History", path: "/trips/history" },
  { value: "costs", label: "Costs", path: "/trips/costs" },
] as const;

/** Stitch "Trips Overview": one header and the module's tabs (each a route) above every tab. */
export function TripsLayout({
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
      <PageHeader title="Trips" description={description} actions={actions} />
      <Tabs value={tab}>
        <TabsList aria-label="Trips sections">
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
