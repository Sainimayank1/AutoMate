import type { NotificationItem } from "@automate/shared";
import { cn } from "cn";
import { addDays } from "date-fns";
import { AlarmClock, Check, EllipsisVertical, Mail, X } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CATEGORY_META, PRIORITY_META, relativeTime } from "@/features/notifications/constants";
import {
  useDismiss,
  useSetRead,
  useSnooze,
} from "@/features/notifications/hooks/use-notifications";
import { formatDateTime } from "@/utils/format";

const SNOOZE = [
  { days: 1, label: "1 day" },
  { days: 3, label: "3 days" },
  { days: 7, label: "1 week" },
];

/**
 * One notification (Stitch "Notifications"): the category icon tinted by priority, the title
 * (bold while unread, with the cyan dot), what it's about, the vehicle and when. "Open" goes to
 * the record and marks it read; the menu reads, snoozes or dismisses it.
 */
export function NotificationCard({
  item,
  snoozed = false,
}: {
  item: NotificationItem;
  /** Shown under "Snoozed": says when it comes back. */
  snoozed?: boolean;
}) {
  const setRead = useSetRead();
  const snooze = useSnooze();
  const dismiss = useDismiss();
  const { icon: Icon, label } = CATEGORY_META[item.category];
  const priority = PRIORITY_META[item.priority];
  const unread = !item.readAt;
  return (
    <article
      aria-label={item.title}
      className={cn(
        "flex items-start gap-3.5 rounded-xl border bg-card p-4",
        unread && priority.border,
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-md",
          priority.tile,
        )}
      >
        <Icon className="size-5" aria-hidden />
        <span className="sr-only">
          {label}, {priority.label}
        </span>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p
          className={cn("flex items-start gap-2 text-sm", unread ? "font-semibold" : "font-medium")}
        >
          {unread && (
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
          )}
          <span className="min-w-0">{item.title}</span>
        </p>
        {item.body && <p className="text-sm text-muted-foreground">{item.body}</p>}
        <p className="text-xs text-muted-foreground">
          {[
            item.vehicle?.name,
            snoozed ? `Back ${formatDateTime(item.activeAt)}` : relativeTime(item.activeAt),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {item.href && (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="max-md:h-10"
            onClick={() => unread && setRead.mutate({ id: item.id, read: true })}
          >
            <Link to={item.href}>Open</Link>
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-10 md:size-8"
              aria-label={`Actions for ${item.title}`}
            >
              <EllipsisVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setRead.mutate({ id: item.id, read: unread })}>
              {unread ? <Check /> : <Mail />}
              {unread ? "Mark as read" : "Mark as unread"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlarmClock className="size-3.5" aria-hidden /> Snooze for
            </DropdownMenuLabel>
            {SNOOZE.map((choice) => (
              <DropdownMenuItem
                key={choice.days}
                onSelect={() =>
                  snooze.mutate({
                    id: item.id,
                    until: addDays(new Date(), choice.days).toISOString(),
                  })
                }
              >
                {choice.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => dismiss.mutate(item.id)}>
              <X /> Dismiss
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}
