import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Tabs that exist today; later phases add Budgets, Ownership cost, Insights. */
const TABS = [
  { value: "overview", label: "Overview", path: "/expenses" },
  { value: "transactions", label: "Transactions", path: "/expenses/transactions" },
  { value: "recurring", label: "Recurring", path: "/expenses/recurring" },
  { value: "categories", label: "Categories", path: "/expenses/categories" },
] as const;

/**
 * Stitch "Expenses" screens: one header and the module's tabs above every tab page.
 * Tabs are links (each tab is a route), styled with the shared Tabs primitive.
 */
export function ExpensesLayout({
  tab,
  actions,
  children,
}: {
  tab: (typeof TABS)[number]["value"];
  /** Extra header actions, before "Add expense". */
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { search } = useLocation();
  return (
    <PageContainer>
      <PageHeader
        title="Expenses"
        description="Every rupee spent on your vehicles"
        actions={
          <>
            {actions}
            <Button asChild>
              <Link to="/expenses/new">
                <Plus data-icon="inline-start" />
                Add expense
              </Link>
            </Button>
          </>
        }
      />
      <Tabs value={tab}>
        <TabsList aria-label="Expense sections">
          {TABS.map((item) => (
            <TabsTrigger key={item.value} value={item.value} asChild>
              {/* Keep the vehicle scope and filters when switching tabs. */}
              <Link to={{ pathname: item.path, search }}>{item.label}</Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {children}
    </PageContainer>
  );
}
