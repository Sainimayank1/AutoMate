import {
  type NotificationPreferences,
  type ReminderTiming,
  ThemePreference,
} from "@automate/shared";
import { formatDistanceToNowStrict } from "date-fns";
import { ArrowRight, Laptop, Smartphone } from "lucide-react";
import { useTheme } from "next-themes";
import { useRef, useState } from "react";
import { Link } from "react-router";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { Pager } from "@/components/common/pager";
import { Segmented } from "@/components/common/segmented";
import { ErrorState } from "@/components/feedback/error-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useLogout } from "@/features/auth/hooks/use-auth";
import { vehicleName } from "@/features/garage/constants";
import { useVehicles } from "@/features/garage/hooks/use-vehicles";
import { usePushDevice } from "@/features/notifications/hooks/use-push";
import {
  ChangePasswordDialog,
  DeleteAccountDialog,
  EditProfileDialog,
} from "@/features/settings/components/account-dialogs";
import {
  usePreferences,
  useRemoveAvatar,
  useRevokeOthers,
  useRevokeSession,
  useSessions,
  useUpdatePreferences,
  useUploadAvatar,
} from "@/features/settings/hooks/use-settings";
import { useSessionStore } from "@/stores/session-store";
import { formatDate } from "@/utils/format";

const FIRST_VEHICLE = "first";
const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const REMINDERS: {
  key: Exclude<keyof NotificationPreferences, "enabled">;
  label: string;
  detail: string;
}[] = [
  {
    key: "documents",
    label: "Document expiry",
    detail: "Before RC, insurance, PUC and other papers expire, as set on each document",
  },
  { key: "maintenance", label: "Service due", detail: "By date or km, whichever comes first" },
  {
    key: "payments",
    label: "Recurring payments & EMIs",
    detail: "When a payment is due and when it's overdue",
  },
  { key: "trips", label: "Trip reminders", detail: "Before a planned trip" },
  {
    key: "fuel",
    label: "Mileage drops",
    detail: "When a full tank's mileage is well below your vehicle's average",
  },
  {
    key: "monthlySummary",
    label: "Monthly summary",
    detail: "An in-app summary of last month's running cost on the 1st",
  },
];

/**
 * `/settings` (Stitch "Settings — Security & Preferences"): the profile and photo, preferences
 * that follow the account, reminder switches (Notifications reads them), security and the
 * account. Deviations: switches instead of the design's checkboxes, each reminder with a line on
 * when it fires; no plan badge or phone number (we keep neither).
 */
export function Component() {
  const user = useSessionStore((state) => state.session?.user);
  const preferences = usePreferences();
  const [dialog, setDialog] = useState<"profile" | "password" | "delete" | null>(null);
  const logout = useLogout();

  if (!user) return null;
  return (
    <PageContainer className="max-w-5xl">
      <PageHeader
        title="Settings"
        description="Profile, preferences, reminders and account security"
      />
      <ProfileCard onEdit={() => setDialog("profile")} />
      {preferences.isError && !preferences.data ? (
        <ErrorState
          title="Couldn't load your preferences"
          error={preferences.error}
          onRetry={() => void preferences.refetch()}
        />
      ) : !preferences.data ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <>
          <PreferencesCard />
          <RemindersCard />
        </>
      )}
      <SecurityCard onChangePassword={() => setDialog("password")} />
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-heading text-base font-semibold">Your data</h2>
          <Link
            to="/backup"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline max-md:min-h-10"
          >
            Backup &amp; Export <ArrowRight className="size-4" aria-hidden />
          </Link>
        </CardContent>
      </Card>
      <Card className="border-destructive/50">
        <CardHeader className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle role="heading" aria-level={2} className="text-destructive">
              Account
            </CardTitle>
            <CardDescription>
              Sign out here, or delete your account and everything in it for good
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => logout.mutate()} disabled={logout.isPending}>
              Sign out
            </Button>
            <Button variant="destructive" onClick={() => setDialog("delete")}>
              Delete account
            </Button>
          </div>
        </CardHeader>
      </Card>

      {dialog === "profile" && (
        <EditProfileDialog user={user} open onOpenChange={(open) => !open && setDialog(null)} />
      )}
      {dialog === "password" && (
        <ChangePasswordDialog open onOpenChange={(open) => !open && setDialog(null)} />
      )}
      {dialog === "delete" && (
        <DeleteAccountDialog open onOpenChange={(open) => !open && setDialog(null)} />
      )}
    </PageContainer>
  );
}

function ProfileCard({ onEdit }: { onEdit: () => void }) {
  const user = useSessionStore((state) => state.session?.user)!;
  const upload = useUploadAvatar();
  const remove = useRemoveAvatar();
  const input = useRef<HTMLInputElement>(null);
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar className="size-16">
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
            <AvatarFallback className="border border-primary/25 bg-primary/15 text-lg text-primary">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="truncate font-heading text-lg font-semibold">{user.name}</h2>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            <p className="text-xs text-muted-foreground">
              Member since {formatDate(user.createdAt)}
            </p>
            <div className="mt-1 flex flex-wrap gap-3 text-sm">
              <button
                type="button"
                className="font-medium text-primary hover:underline disabled:opacity-50 max-md:min-h-10"
                disabled={upload.isPending}
                onClick={() => input.current?.click()}
              >
                {upload.isPending ? "Uploading…" : user.avatarUrl ? "Change photo" : "Add photo"}
              </button>
              {user.avatarUrl && (
                <button
                  type="button"
                  className="text-muted-foreground hover:underline max-md:min-h-10"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate()}
                >
                  Remove
                </button>
              )}
            </div>
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="Profile photo"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) upload.mutate(file);
                event.target.value = "";
              }}
            />
          </div>
        </div>
        <Button variant="outline" onClick={onEdit}>
          Edit profile
        </Button>
      </CardContent>
    </Card>
  );
}

function PreferencesCard() {
  const preferences = usePreferences().data!;
  const update = useUpdatePreferences();
  const vehicles = useVehicles();
  const { setTheme } = useTheme();
  const regional = [
    { label: "Currency", value: "₹ Indian rupee" },
    { label: "Distance", value: "Kilometres" },
    { label: "Fuel", value: "Litres, kg or kWh by fuel" },
    { label: "Dates", value: "DD/MM/YYYY" },
    { label: "Time zone", value: "India (IST)" },
    { label: "Language", value: "English (India)" },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Preferences
        </CardTitle>
        <CardDescription>Saved to your account, so they follow you to every device</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label id="theme-label">Theme</Label>
            <Segmented
              aria-labelledby="theme-label"
              className="grid grid-cols-3"
              value={preferences.theme}
              onChange={(theme) => {
                setTheme(theme.toLowerCase());
                update.mutate({ theme });
              }}
              options={[
                { value: ThemePreference.DARK, label: "Dark" },
                { value: ThemePreference.LIGHT, label: "Light" },
                { value: ThemePreference.SYSTEM, label: "System" },
              ]}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="default-vehicle">Default vehicle</Label>
            <Select
              value={preferences.defaultVehicleId ?? FIRST_VEHICLE}
              onValueChange={(value) =>
                update.mutate({ defaultVehicleId: value === FIRST_VEHICLE ? null : value })
              }
            >
              <SelectTrigger id="default-vehicle" className="w-full data-[size=default]:h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FIRST_VEHICLE}>The first vehicle in your garage</SelectItem>
                {(vehicles.data ?? []).map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicleName(vehicle)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-col gap-2 rounded-lg border bg-elevated p-4">
          <h3 className="text-sm font-medium">Regional format</h3>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
            {regional.map((row) => (
              <div key={row.label}>
                <dt className="text-xs text-muted-foreground">{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="border-t pt-2 text-xs text-muted-foreground">
            AutoMate is built for India; these are fixed for now.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function RemindersCard() {
  const preferences = usePreferences().data!;
  const update = useUpdatePreferences();
  const { notifications } = preferences;
  const set = (change: Partial<NotificationPreferences>) =>
    update.mutate({ notifications: change });
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle role="heading" aria-level={2}>
            Reminders &amp; alerts
          </CardTitle>
          <CardDescription>Choose what AutoMate reminds you about</CardDescription>
        </div>
        <Label className="flex items-center gap-2 font-normal">
          <Switch
            checked={notifications.enabled}
            onCheckedChange={(enabled) => set({ enabled })}
            aria-label="Notifications"
          />
          Notifications
        </Label>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y">
          {REMINDERS.map((reminder) => (
            <li key={reminder.key} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-medium">{reminder.label}</p>
                <p className="text-xs text-muted-foreground">{reminder.detail}</p>
              </div>
              <Switch
                checked={notifications[reminder.key]}
                disabled={!notifications.enabled}
                onCheckedChange={(checked) => set({ [reminder.key]: checked })}
                aria-label={reminder.label}
              />
            </li>
          ))}
        </ul>
        {!notifications.enabled && (
          <p className="pt-2 text-xs text-muted-foreground">
            Notifications are off: no reminders at all.
          </p>
        )}
        <div className="mt-3 flex flex-col divide-y rounded-lg border bg-elevated">
          <PushRow disabled={!notifications.enabled} />
          <QuietHoursRow />
          <ReminderTimingRow />
        </div>
      </CardContent>
    </Card>
  );
}

/** This browser or phone: push on or off (needs the server's keys and the browser's permission). */
function PushRow({ disabled }: { disabled: boolean }) {
  const push = usePushDevice();
  const reason = !push.supported
    ? "This browser can't receive push notifications."
    : !push.configured
      ? "Push isn't set up on the server yet."
      : push.blocked
        ? "Blocked for AutoMate in this browser's site settings."
        : "Reminders arrive here even when AutoMate is closed.";
  const unavailable = !push.supported || !push.configured || push.blocked;
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div>
        <p className="text-sm font-medium">Push to this device</p>
        <p className="text-xs text-muted-foreground">{reason}</p>
      </div>
      <Switch
        checked={push.on}
        disabled={disabled || unavailable || push.pending}
        onCheckedChange={(on) => (on ? push.enable() : push.disable())}
        aria-label="Push to this device"
      />
    </div>
  );
}

/** No pushes between two times (India time); they arrive when it ends. */
function QuietHoursRow() {
  const { quietHours } = usePreferences().data!;
  const update = useUpdatePreferences();
  const save = (start: string, end: string) => {
    if (start && end && start !== end) update.mutate({ quietHours: { start, end } });
  };
  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Quiet hours</p>
          <p className="text-xs text-muted-foreground">
            No pushes in between; they arrive when it ends.
          </p>
        </div>
        <Switch
          checked={!!quietHours}
          onCheckedChange={(on) =>
            update.mutate({ quietHours: on ? { start: "22:00", end: "07:00" } : null })
          }
          aria-label="Quiet hours"
        />
      </div>
      {quietHours && (
        <div className="grid grid-cols-2 gap-3 sm:max-w-xs">
          <Label className="flex flex-col items-start gap-1.5 text-xs font-normal text-muted-foreground">
            From
            <Input
              type="time"
              defaultValue={quietHours.start}
              className="h-10"
              onBlur={(event) => save(event.target.value, quietHours.end)}
            />
          </Label>
          <Label className="flex flex-col items-start gap-1.5 text-xs font-normal text-muted-foreground">
            Until
            <Input
              type="time"
              defaultValue={quietHours.end}
              className="h-10"
              onBlur={(event) => save(quietHours.start, event.target.value)}
            />
          </Label>
        </div>
      )}
    </div>
  );
}

/**
 * How early reminders come, per category; a record's own lead (a schedule's, a payment's) still
 * wins. Saved on blur; a value the API refuses snaps back.
 */
function ReminderTimingRow() {
  const { reminderTiming } = usePreferences().data!;
  const update = useUpdatePreferences();
  const save = (change: Partial<ReminderTiming>) => update.mutate({ reminderTiming: change });
  const whole = (value: string) => (/^\d+$/.test(value.trim()) ? Number(value) : null);
  const field = (
    label: string,
    key: "serviceLeadDays" | "serviceLeadKm" | "paymentDays",
    unit: string,
  ) => (
    <Label className="flex flex-col items-start gap-1.5 text-xs font-normal text-muted-foreground">
      {label}
      <span className="flex w-full items-center gap-2">
        <Input
          key={reminderTiming[key]}
          inputMode="numeric"
          defaultValue={reminderTiming[key]}
          className="h-10 tabular-nums"
          onBlur={(event) => {
            const value = whole(event.target.value);
            if (value === null) event.target.value = String(reminderTiming[key]);
            else if (value !== reminderTiming[key]) save({ [key]: value });
          }}
        />
        <span className="shrink-0">{unit}</span>
      </span>
    </Label>
  );
  const days = reminderTiming.documentDays.join(", ");
  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      <div>
        <p className="text-sm font-medium">Reminder timing</p>
        <p className="text-xs text-muted-foreground">
          Defaults for new records; a record&apos;s own setting wins.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="flex flex-col items-start gap-1.5 text-xs font-normal text-muted-foreground">
          Documents expiring (days before)
          <Input
            key={days}
            defaultValue={days}
            placeholder="30, 7, 1"
            className="h-10 tabular-nums"
            onBlur={(event) => {
              const parts = event.target.value.split(",").map(whole);
              if (!parts.length || parts.some((part) => part === null)) {
                event.target.value = days;
              } else if (parts.join(", ") !== days) {
                save({ documentDays: parts as number[] });
              }
            }}
          />
        </Label>
        {field("Payments due", "paymentDays", "days before")}
        {field("Service due", "serviceLeadDays", "days before")}
        {field("or", "serviceLeadKm", "km before")}
      </div>
    </div>
  );
}

function SecurityCard({ onChangePassword }: { onChangePassword: () => void }) {
  const [page, setPage] = useState(1);
  const sessions = useSessions(page);
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOthers();
  const items = sessions.data?.items ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Security
        </CardTitle>
        <CardDescription>Your password and the devices signed in to your account</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-elevated p-4">
          <div>
            <p className="text-sm font-medium">Password</p>
            <p className="text-xs text-muted-foreground">
              Changing it signs your other devices out
            </p>
          </div>
          <Button variant="outline" onClick={onChangePassword}>
            Change password
          </Button>
        </div>
        <section aria-labelledby="devices-title" className="flex flex-col gap-2">
          <h3 id="devices-title" className="text-sm font-medium">
            Signed-in devices
          </h3>
          {sessions.isError && !sessions.data ? (
            <ErrorState
              title="Couldn't load your devices"
              error={sessions.error}
              onRetry={() => void sessions.refetch()}
            />
          ) : !sessions.data ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <ul className="flex flex-col divide-y rounded-lg border bg-elevated">
              {items.map((session) => (
                <li
                  key={session.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <DeviceIcon device={session.device} />
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        {session.device}
                        {session.current && (
                          <Badge
                            variant="outline"
                            className="border-transparent bg-primary/15 text-primary"
                          >
                            This device
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {session.current
                          ? "Active now"
                          : `Last active ${formatDistanceToNowStrict(new Date(session.lastUsedAt), { addSuffix: true })}`}
                        {` · signed in ${formatDate(session.createdAt)}`}
                      </p>
                    </div>
                  </div>
                  {!session.current && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="max-md:h-10"
                      disabled={revoke.isPending}
                      onClick={() => revoke.mutate(session.id)}
                      aria-label={`Sign out ${session.device}`}
                    >
                      Sign out
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {(sessions.data?.meta.totalPages ?? 0) > 1 && (
            <Pager page={page} pageCount={sessions.data!.meta.totalPages} onPageChange={setPage} />
          )}
          {(sessions.data?.meta.total ?? 0) > 1 && (
            <Button
              variant="outline"
              className="self-start"
              disabled={revokeOthers.isPending}
              onClick={() => revokeOthers.mutate()}
            >
              Sign out of all other devices
            </Button>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

/** Phones and tablets by the name the API gives the device ("Safari on iPhone"). */
function DeviceIcon({ device }: { device: string }) {
  const Icon = /iphone|ipad|android/i.test(device) ? Smartphone : Laptop;
  return <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />;
}
