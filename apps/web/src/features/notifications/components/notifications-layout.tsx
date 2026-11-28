import type { ReactNode } from "react";
import { Link } from "react-router";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = [
  { value: "inbox", label: "Inbox", path: "/notifications" },
  { value: "reminders", label: "Reminders", path: "/notifications/reminders" },
] as const;

/** Stitch "Notifications" and "Notifications — Reminders": one header and the two tabs. */
export function NotificationsLayout({
  tab,
  description,
  actions,
  children,
}: {
  tab: (typeof TABS)[number]["value"];
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <PageContainer className="max-w-4xl">
      <PageHeader title="Notifications" description={description} actions={actions} />
      <Tabs value={tab}>
        <TabsList aria-label="Notification sections">
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
