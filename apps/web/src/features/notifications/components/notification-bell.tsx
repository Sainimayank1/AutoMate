import { cn } from "cn";
import { Bell, BellOff } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CATEGORY_META, PRIORITY_META, relativeTime } from "@/features/notifications/constants";
import {
  useNotificationSummary,
  useReadAll,
  useSetRead,
} from "@/features/notifications/hooks/use-notifications";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * The header bell (Stitch "Notifications Popover"): the unread count ("9+" past nine); on
 * desktop a popover with the latest six, unread first, "Mark all as read" and "View all"; on a
 * phone it goes straight to the inbox.
 */
export function NotificationBell() {
  const summary = useNotificationSummary();
  const readAll = useReadAll();
  const setRead = useSetRead();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const unread = summary.data?.unread ?? 0;
  const latest = summary.data?.latest ?? [];
  const label = unread ? `Notifications, ${unread} unread` : "Notifications";
  const icon = (
    <span className="relative">
      <Bell />
      {unread > 0 && (
        <span className="absolute -top-1.5 -right-2 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 font-semibold text-primary-foreground tabular-nums">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </span>
  );

  if (isMobile) {
    return (
      <Button variant="ghost" size="icon" className="size-10" asChild>
        <Link to="/notifications" aria-label={label}>
          {icon}
        </Link>
      </Button>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label={label}>
          {icon}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-heading text-sm font-semibold">Notifications</p>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            disabled={!unread || readAll.isPending}
            onClick={() => readAll.mutate(undefined)}
          >
            Mark all as read
          </Button>
        </div>
        {latest.length ? (
          <ul className="flex flex-col divide-y">
            {latest.map((item) => {
              const { icon: Icon } = CATEGORY_META[item.category];
              const read = !!item.readAt;
              const body = (
                <>
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-md",
                      PRIORITY_META[item.priority].tile,
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span
                      className={cn(
                        "flex items-center gap-1.5 truncate text-sm",
                        read ? "font-normal" : "font-semibold",
                      )}
                    >
                      {!read && (
                        <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                      )}
                      <span className="truncate">{item.title}</span>
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {[item.vehicle?.name, relativeTime(item.activeAt)]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </>
              );
              return (
                <li key={item.id}>
                  <Link
                    to={item.href ?? "/notifications"}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                    onClick={() => {
                      if (!read) setRead.mutate({ id: item.id, read: true });
                      setOpen(false);
                    }}
                  >
                    {body}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-sm text-muted-foreground">
            <BellOff className="size-5" aria-hidden />
            You&apos;re all caught up
          </div>
        )}
        <Link
          to="/notifications"
          onClick={() => setOpen(false)}
          className="block border-t px-4 py-2.5 text-center text-sm font-medium text-primary hover:underline"
        >
          View all notifications
        </Link>
      </PopoverContent>
    </Popover>
  );
}
