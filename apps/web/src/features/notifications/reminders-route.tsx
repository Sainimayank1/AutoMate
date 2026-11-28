import { type Reminder, ReminderState } from "@automate/shared";
import { cn } from "cn";
import { BellPlus, CalendarClock, EllipsisVertical, Plus } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Pager } from "@/components/common/pager";
import { Segmented } from "@/components/common/segmented";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { vehicleName } from "@/features/garage/constants";
import { useVehicles } from "@/features/garage/hooks/use-vehicles";
import { NotificationsLayout } from "@/features/notifications/components/notifications-layout";
import { ReminderDialog } from "@/features/notifications/components/reminder-dialog";
import { REMINDER_STATE, REPEAT_LABELS } from "@/features/notifications/constants";
import {
  useDeleteReminder,
  useReminderDone,
  useReminders,
} from "@/features/notifications/hooks/use-notifications";
import { formatDate } from "@/utils/format";

const badge = (reminder: Reminder) => {
  const left = reminder.daysLeft;
  switch (reminder.state) {
    case ReminderState.OVERDUE:
      return "Overdue";
    case ReminderState.DUE:
      return left === 0 ? "Due today" : left === 1 ? "Due tomorrow" : `Due in ${left} days`;
    case ReminderState.UPCOMING:
      return "Upcoming";
    default:
      return "Done";
  }
};
const lead = (days: number) =>
  days === 0 ? "On the day" : `${days} day${days === 1 ? "" : "s"} before`;

/**
 * `/notifications/reminders` (Stitch "Notifications — Reminders"): reminders you set yourself,
 * open (soonest first) or done. `?new=1&vehicle=` opens the dialog for a vehicle (the dashboard's
 * "Add reminder"); `?reminder=<id>` opens one to edit (from its notification).
 */
export function Component() {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<"open" | "done">("open");
  const [page, setPage] = useState(1);
  const list = useReminders({ status, page, pageSize: 20 });
  const vehicles = useVehicles();
  const done = useReminderDone();
  const remove = useDeleteReminder();
  const [deleting, setDeleting] = useState<Reminder | null>(null);
  const items = list.data?.items ?? [];
  const editingId = params.get("reminder");
  const editing = items.find((reminder) => reminder.id === editingId);
  const creating = params.get("new") === "1";
  const closeDialog = () =>
    setParams(
      (current) => {
        current.delete("new");
        current.delete("vehicle");
        current.delete("reminder");
        return current;
      },
      { replace: true },
    );
  const nameOf = (id: string | null) => {
    const vehicle = id && vehicles.data?.find((item) => item.id === id);
    return vehicle ? vehicleName(vehicle) : null;
  };
  const add = (
    <Button onClick={() => setParams({ new: "1" })}>
      <Plus data-icon="inline-start" />
      Add reminder
    </Button>
  );

  return (
    <NotificationsLayout
      tab="reminders"
      description="Reminders you set yourself, alongside the ones AutoMate raises"
      actions={add}
    >
      <Segmented
        aria-label="Reminders"
        className="self-start"
        value={status}
        onChange={(next) => {
          setStatus(next);
          setPage(1);
        }}
        options={[
          { value: "open", label: "Open" },
          { value: "done", label: "Done" },
        ]}
      />
      {list.isError && !list.data ? (
        <ErrorState
          title="Couldn't load your reminders"
          error={list.error}
          onRetry={() => void list.refetch()}
        />
      ) : !list.data ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : !items.length ? (
        <EmptyState
          icon={BellPlus}
          title={status === "open" ? "No reminders yet" : "Nothing done yet"}
          description="Anything worth remembering: a renewal, a booking, a payment that isn't in AutoMate."
          action={status === "open" ? add : undefined}
        />
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {items.map((reminder) => {
            const state = REMINDER_STATE[reminder.state];
            const vehicle = nameOf(reminder.vehicleId);
            return (
              <li key={reminder.id} className="flex items-start gap-3.5 px-4 py-3.5">
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-md",
                    state.tile,
                  )}
                >
                  <CalendarClock className="size-5" aria-hidden />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{reminder.title}</p>
                    <StatusBadge tone={state.tone} icon={CalendarClock} label={badge(reminder)} />
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {[
                      `${formatDate(reminder.dueDate)} · ${lead(reminder.remindDaysBefore)}`,
                      reminder.repeat !== "NONE"
                        ? REPEAT_LABELS[reminder.repeat].toLowerCase()
                        : null,
                      vehicle,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {reminder.notes && (
                    <p className="text-xs text-muted-foreground">{reminder.notes}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="max-md:h-10"
                    disabled={done.isPending}
                    onClick={() => done.mutate({ id: reminder.id, done: status === "open" })}
                  >
                    {status === "open" ? "Mark done" : "Reopen"}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-10 md:size-8"
                        aria-label={`Actions for ${reminder.title}`}
                      >
                        <EllipsisVertical />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setParams({ reminder: reminder.id })}>
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setDeleting(reminder)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {(list.data?.meta.totalPages ?? 0) > 1 && (
        <Pager page={page} pageCount={list.data!.meta.totalPages} onPageChange={setPage} />
      )}

      {(creating || editing) && (
        <ReminderDialog
          open
          onOpenChange={(open) => !open && closeDialog()}
          vehicles={vehicles.data ?? []}
          vehicleId={params.get("vehicle")}
          editing={editing}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this reminder?"
        description={deleting ? `"${deleting.title}" and its notification go for good.` : ""}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (deleting) await remove.mutateAsync(deleting.id);
        }}
      />
    </NotificationsLayout>
  );
}
