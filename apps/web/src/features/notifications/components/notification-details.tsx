import type { NotificationItem } from "@automate/shared";
import { cn } from "cn";
import { addDays } from "date-fns";
import { AlarmClock } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CATEGORY_META, PRIORITY_META } from "@/features/notifications/constants";
import {
  useDismiss,
  useSetRead,
  useSnooze,
} from "@/features/notifications/hooks/use-notifications";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatDateTime, formatRegistration } from "@/utils/format";

const SNOOZE = [
  { days: 1, label: "1 day" },
  { days: 3, label: "3 days" },
  { days: 7, label: "1 week" },
];

/**
 * Stitch "Notification Details": one notification in a side sheet over the inbox (a bottom
 * sheet on phones): the whole message, its category, priority and vehicle, when it was raised
 * and last shown, and the actions. Opening it doesn't mark it read (the sheet says which it is).
 */
export function NotificationDetails({
  item,
  onClose,
}: {
  item: NotificationItem | null;
  onClose: () => void;
}) {
  const mobile = useIsMobile();
  return (
    <Sheet open={!!item} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={mobile ? "bottom" : "right"}
        className="w-full gap-0 overflow-y-auto max-md:max-h-[90svh] sm:max-w-md"
      >
        {item && <Details item={item} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function Details({ item, onClose }: { item: NotificationItem; onClose: () => void }) {
  const setRead = useSetRead();
  const snooze = useSnooze();
  const dismiss = useDismiss();
  const { icon: Icon, label: category } = CATEGORY_META[item.category];
  const priority = PRIORITY_META[item.priority];
  const unread = !item.readAt;
  const snoozed = item.snoozedUntil && new Date(item.snoozedUntil) > new Date();
  const busy = setRead.isPending || snooze.isPending || dismiss.isPending;

  return (
    <>
      <SheetHeader className="gap-4 p-6 pb-4">
        <span className="text-xs font-medium text-muted-foreground">Notification details</span>
        <div className="flex items-start gap-3.5">
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-md",
              priority.tile,
            )}
          >
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-col gap-2">
            <SheetTitle className="text-lg text-balance">{item.title}</SheetTitle>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className={priority.tile}>
                {priority.label}
              </Badge>
              <Badge variant="outline">{category}</Badge>
            </div>
          </div>
        </div>
        <SheetDescription className="sr-only">
          {category} notification, {priority.label}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-5 px-6 pb-6">
        {snoozed && (
          <p className="flex items-center gap-2.5 rounded-lg border bg-muted/40 px-3.5 py-2.5 text-sm tabular-nums">
            <AlarmClock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            Snoozed until {formatDateTime(item.snoozedUntil)}
          </p>
        )}
        {item.body && (
          <section className="flex flex-col gap-1.5">
            <h3 className="text-xs font-medium text-muted-foreground">Message</h3>
            <p className="text-sm text-pretty text-muted-foreground">{item.body}</p>
          </section>
        )}
        <dl className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
          {item.vehicle && (
            <Row label="Vehicle">
              {item.vehicle.name} · {formatRegistration(item.vehicle.registrationNumber)}
            </Row>
          )}
          <Row label="Category">{category}</Row>
          <Row label="Raised">
            <span className="tabular-nums">{formatDateTime(item.createdAt)}</span>
          </Row>
          <Row label="Last shown">
            <span className="tabular-nums">{formatDateTime(item.activeAt)}</span>
          </Row>
          <Row label="Read state">
            {unread ? (
              <span className="inline-flex items-center gap-1.5 text-primary">
                <span className="size-2 rounded-full bg-primary" aria-hidden />
                Unread
              </span>
            ) : (
              "Read"
            )}
          </Row>
        </dl>
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-medium text-muted-foreground">Snooze</h3>
          <div className="grid grid-cols-3 gap-2">
            {SNOOZE.map((choice) => (
              <Button
                key={choice.days}
                variant="outline"
                className="max-md:h-10"
                disabled={busy}
                onClick={() =>
                  snooze.mutate(
                    { id: item.id, until: addDays(new Date(), choice.days).toISOString() },
                    { onSuccess: onClose },
                  )
                }
              >
                {choice.label}
              </Button>
            ))}
          </div>
        </section>
      </div>

      <SheetFooter className="mt-auto gap-2.5 border-t p-6 pt-4">
        {item.action && (
          <Button
            asChild
            className="max-md:h-10"
            onClick={() => unread && setRead.mutate({ id: item.id, read: true })}
          >
            <Link to={item.action.href}>{item.action.label}</Link>
          </Button>
        )}
        {item.href && (
          <Button
            asChild
            variant={item.action ? "outline" : "default"}
            className="max-md:h-10"
            onClick={() => unread && setRead.mutate({ id: item.id, read: true })}
          >
            <Link to={item.href}>Open record</Link>
          </Button>
        )}
        <Button
          variant="outline"
          className="max-md:h-10"
          disabled={busy}
          onClick={() => setRead.mutate({ id: item.id, read: unread })}
        >
          {unread ? "Mark as read" : "Mark as unread"}
        </Button>
        <Button
          variant="ghost"
          className="max-md:h-10"
          disabled={busy}
          onClick={() => dismiss.mutate(item.id, { onSuccess: onClose })}
        >
          Dismiss
        </Button>
      </SheetFooter>
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
