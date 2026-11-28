import { istToday, NotificationCategory, type NotificationItem } from "@automate/shared";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { BellOff, Settings } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { Link } from "react-router";

import { Pager } from "@/components/common/pager";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { NotificationCard } from "@/features/notifications/components/notification-card";
import { NotificationDetails } from "@/features/notifications/components/notification-details";
import { NotificationsLayout } from "@/features/notifications/components/notifications-layout";
import { CATEGORY_META } from "@/features/notifications/constants";
import {
  useNotifications,
  useNotificationSummary,
  useReadAll,
} from "@/features/notifications/hooks/use-notifications";

const CHIPS = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  ...Object.values(NotificationCategory).map((category) => ({
    value: category,
    label: CATEGORY_META[category].label,
  })),
  { value: "snoozed", label: "Snoozed" },
];
const GROUPS = ["Today", "This week", "Earlier"] as const;

/** Today, this week (the last 7 days) or earlier, by the day it (re)appeared in India. */
function groupOf(item: NotificationItem, today: string): (typeof GROUPS)[number] {
  const days = differenceInCalendarDays(
    parseISO(today),
    parseISO(istToday(new Date(item.activeAt))),
  );
  return days <= 0 ? "Today" : days < 7 ? "This week" : "Earlier";
}

/**
 * `/notifications` (Stitch "Notifications"): one calm inbox raised from your records. Filter
 * chips in the URL; Today / This week / Earlier; snoozed ones on their own chip with their wake
 * time. An expiring document's card offers "Renew" (Stitch's "Renew plan" / "Upload PUC"); other
 * cards open their record. The title opens Stitch "Notification Details".
 */
export function Component() {
  const [params, setParams] = useSearchParams();
  const chip = params.get("show") ?? "all";
  const page = Number(params.get("page") ?? 1);
  const category = Object.values(NotificationCategory).find((value) => value === chip);
  const filter = chip === "unread" || chip === "snoozed" ? chip : "all";
  const list = useNotifications({ filter, category, page, pageSize: 20 });
  const summary = useNotificationSummary();
  const readAll = useReadAll();
  const [selected, setSelected] = useState<string | null>(null);
  const unread = summary.data?.unread ?? 0;
  const today = istToday(new Date());
  const items = list.data?.items ?? [];
  const set = (next: Record<string, string | null>) =>
    setParams(
      (current) => {
        for (const [key, value] of Object.entries(next)) {
          if (value === null) current.delete(key);
          else current.set(key, value);
        }
        return current;
      },
      { replace: true },
    );

  return (
    <NotificationsLayout
      tab="inbox"
      description={unread ? `${unread} unread` : "Reminders and alerts from your vehicles' records"}
      actions={
        <>
          <Button variant="outline" asChild>
            <Link to="/settings">
              <Settings data-icon="inline-start" />
              Preferences
            </Link>
          </Button>
          <Button
            variant="outline"
            disabled={!unread || readAll.isPending}
            onClick={() => readAll.mutate(undefined)}
          >
            Mark all as read
          </Button>
        </>
      }
    >
      <ToggleGroup
        type="single"
        variant="outline"
        aria-label="Show"
        value={chip}
        onValueChange={(value) =>
          value && set({ show: value === "all" ? null : value, page: null })
        }
        className="flex flex-wrap justify-start gap-2"
      >
        {CHIPS.map((item) => (
          <ToggleGroupItem
            key={item.value}
            value={item.value}
            className="h-9 rounded-full px-3.5 text-xs data-[state=on]:border-primary/40 data-[state=on]:text-primary max-md:h-10"
          >
            {item.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {list.isError && !list.data ? (
        <ErrorState
          title="Couldn't load your notifications"
          error={list.error}
          onRetry={() => void list.refetch()}
        />
      ) : !list.data ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : !items.length ? (
        <EmptyState
          icon={BellOff}
          title={chip === "all" ? "You're all caught up" : "Nothing here"}
          description={
            chip === "snoozed"
              ? "Snoozed notifications wait here until they come back."
              : "New reminders appear here as your records call for them."
          }
        />
      ) : filter === "snoozed" ? (
        <section aria-label="Snoozed" className="flex flex-col gap-3">
          {items.map((item) => (
            <NotificationCard
              key={item.id}
              item={item}
              snoozed
              onSelect={() => setSelected(item.id)}
            />
          ))}
        </section>
      ) : (
        GROUPS.map((group) => {
          const inGroup = items.filter((item) => groupOf(item, today) === group);
          if (!inGroup.length) return null;
          return (
            <section key={group} aria-labelledby={`group-${group}`} className="flex flex-col gap-3">
              <h2 id={`group-${group}`} className="text-xs font-medium text-muted-foreground">
                {group}
              </h2>
              {inGroup.map((item) => (
                <NotificationCard key={item.id} item={item} onSelect={() => setSelected(item.id)} />
              ))}
            </section>
          );
        })
      )}
      <NotificationDetails
        item={items.find((item) => item.id === selected) ?? null}
        onClose={() => setSelected(null)}
      />
      {(list.data?.meta.totalPages ?? 0) > 1 && (
        <Pager
          page={page}
          pageCount={list.data!.meta.totalPages}
          onPageChange={(next) => set({ page: String(next) })}
        />
      )}
    </NotificationsLayout>
  );
}
