# Notifications & reminders (M10): design

One in-app inbox for everything that needs attention, raised from the records the other modules keep, plus reminders the user sets. Product scope: [MODULES.md M10](../MODULES.md#module-10--notifications-center).

## 1. Rules

- **No second reminder system.** Each module already knows what's due; Notifications asks it and words the result (`notification-rules.ts`, tested in `notification-rules.spec.ts`):

  | Source (switch in Settings)              | Raised when                                                                                                            | Priority                                |
  | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
  | Documents (`documents`)                  | the nearest of the document's own reminder days is reached, it has expired, or its remind-on date has come             | expired high; ≤ 7 days medium; else low |
  | Maintenance (`maintenance`)              | a schedule with reminders on is due soon, due or overdue (date or km, whichever comes first)                           | overdue high; due medium; soon low      |
  | Recurring payments and EMIs (`payments`) | in its reminder window, or overdue                                                                                     | overdue high; due medium                |
  | Trips (`trips`)                          | a plan leaves within 7 days, a past plan wasn't marked done, a recent trip has no costs (`TripPlansService.reminders`) | departure medium; others low            |
  | Fuel (`fuel`)                            | the latest full tank (within 30 days) is 15% or more below the vehicle's average over 3+ cycles                        | medium                                  |
  | Monthly summary (`monthlySummary`, off)  | last month had records: what was spent (loan principal out) and the fuel part, across vehicles                         | low                                     |
  | Your reminders (always, unless all off)  | its window has started (`remindDaysBefore`), or it's overdue                                                           | overdue high; due medium                |

- **Raised on read, not by a job.** Reading the inbox or the bell brings it up to date at most once a minute per user (`POST /notifications/refresh` forces it). Each source lists what applies now; new dedupe keys are added; a row whose key no longer applies is removed (done, paid, renewed, switched off). The key names the source and its stage (`document:<id>:<expiry>:7`, `maintenance:<id>:<date>|<km>:OVERDUE`), so a new stage is a new notification and a renewed document or the next service starts fresh. A source that fails keeps its rows as they were.
- **Events stay.** Mileage drops and monthly summaries aren't "resolved" by anything: they stay until dismissed.
- **Text uses absolute dates** ("expires on 10 Dec 2026"), so a stored notification stays true.
- **Read / snooze / dismiss.** Opening a notification marks it read. Snoozing (1 day, 3 days, 1 week; up to 90 days) hides it and brings it back unread at that time. Dismissing hides it while it still applies; a later stage (due soon → overdue) is new and shows. "Delete" is the same as dismiss: the row is kept only so the reminder isn't raised again. Master switch off: nothing is raised and current reminders go (events stay).
- **Your reminders**: a title, a date, how many days before (0–365, default 1), an optional vehicle and notes. Mark done (its notification goes), reopen, edit, delete. A reminder change brings the inbox up to date on its next read.
- **Repeating reminders**: none, weekly, monthly or yearly. Done on a repeating one moves it to its next date (missed dates skipped) instead of closing it (`nextReminderDate`).
- **Web Push** (`PushService`): a device subscribes from Settings ("Push to this device": permission, the service worker `public/sw.js`, the browser's PushSubscription). An hourly job (`.github/workflows/notify.yml` calls `POST /internal/notifications/dispatch` with `Authorization: Bearer <DISPATCH_SECRET>`) brings each subscribed user's inbox up to date and pushes new high and medium priority notifications, each once (`pushed_at`), and only those that appeared after the user's first device subscribed (no backlog flood). More than three at once arrive as one summary. A device the push service has dropped (404/410) is removed. Off until the VAPID keys are configured; the click opens the notification's link.
- **Quiet hours** (Settings, India time, may cross midnight; `inQuietHours`): no pushes in between; they go with the first run after. The inbox itself isn't affected.
- **Dashboard** (dashboard.md §6): a vehicle's due and overdue reminders are action-centre items ("Open reminder"); information-only items (severity `info`, such as a valid warranty) can be dismissed per vehicle (`user_preferences.dashboard_dismissed`), never anything to do; the hero has "Add reminder".

## 2. API

| Endpoint                                                                                                           | Notes                                                                                    |
| ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `GET /notifications`                                                                                               | Paginated; `filter` (`all`, `unread`, `snoozed`), `category`, `vehicleId`. Newest first. |
| `GET /notifications/summary`                                                                                       | The bell: unread count and the latest six, unread first.                                 |
| `POST /notifications/refresh`                                                                                      | Up to date now, then the summary.                                                        |
| `POST /notifications/read-all`                                                                                     | Optional `category`; `{ updated }`.                                                      |
| `PATCH /notifications/:id`                                                                                         | `{ read }`.                                                                              |
| `POST /notifications/:id/snooze`                                                                                   | `{ until }` (ISO, future, ≤ 90 days).                                                    |
| `DELETE /notifications/:id`                                                                                        | Dismiss; `204`.                                                                          |
| `GET` / `POST /reminders`, `GET` / `PATCH` / `DELETE /reminders/:id`, `POST /reminders/:id/done`, `…/reopen`       | The user's reminders; the list is paginated, `status` `open` or `done`.                  |
| `GET /notifications/push/config`, `POST /notifications/push/subscriptions`, `POST /notifications/push/unsubscribe` | The VAPID public key (null while push is off); add or remove this device.                |
| `POST /internal/notifications/dispatch`                                                                            | The hourly job only (bearer `DISPATCH_SECRET`); not found without one.                   |
| `POST /dashboard/dismissals`                                                                                       | `{ vehicleId, itemId }`: hide an information-only action-centre item.                    |

Tested in `test/notifications.e2e-spec.ts`, `test/push.e2e-spec.ts`, `vehicle-status.spec.ts` and `notifications.test.tsx`.

## 3. Not built

Local notifications from a native app (there is none: Web Push covers phones, on iPhone from the home-screen app), and email digests (no email provider).

**Since built:** per-category reminder timing (Settings → Reminder timing: documents' days before, payments' days before, service lead in days and km; defaults for new records, and the service lead applies where a schedule has none of its own), the details sheet (the card's title opens Stitch "Notification Details": the whole message, category, priority, vehicle, raised and last-shown times, read state, snooze, open, dismiss) incoming vehicle transfers (`transfer:` notices), and a next step on a notification: an expiring or expired document carries `action` ("Renew", opening its renewal in Documents, `?renew=1`), shown first on the card and in the details sheet (`actionOf` in `notification-rules.ts`). Reads that arrive together (the bell and the list) wait for the same sync instead of one skipping it.
