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
- **Dashboard** (dashboard.md §6): a vehicle's due and overdue reminders are action-centre items ("Open reminder"); information-only items (severity `info`, such as a valid warranty) can be dismissed per vehicle (`user_preferences.dashboard_dismissed`), never anything to do; the hero has "Add reminder".

## 2. API

| Endpoint                                                                                                     | Notes                                                                                    |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `GET /notifications`                                                                                         | Paginated; `filter` (`all`, `unread`, `snoozed`), `category`, `vehicleId`. Newest first. |
| `GET /notifications/summary`                                                                                 | The bell: unread count and the latest six, unread first.                                 |
| `POST /notifications/refresh`                                                                                | Up to date now, then the summary.                                                        |
| `POST /notifications/read-all`                                                                               | Optional `category`; `{ updated }`.                                                      |
| `PATCH /notifications/:id`                                                                                   | `{ read }`.                                                                              |
| `POST /notifications/:id/snooze`                                                                             | `{ until }` (ISO, future, ≤ 90 days).                                                    |
| `DELETE /notifications/:id`                                                                                  | Dismiss; `204`.                                                                          |
| `GET` / `POST /reminders`, `GET` / `PATCH` / `DELETE /reminders/:id`, `POST /reminders/:id/done`, `…/reopen` | The user's reminders; the list is paginated, `status` `open` or `done`.                  |
| `POST /dashboard/dismissals`                                                                                 | `{ vehicleId, itemId }`: hide an information-only action-centre item.                    |

Tested in `test/notifications.e2e-spec.ts`, `vehicle-status.spec.ts` and `notifications.test.tsx`.

## 3. Not built

Push (web push needs a service worker and keys) and local (mobile app) notifications, email digests (no email provider), quiet hours, per-category lead times beyond each record's own (documents' reminder days, schedules' leads, payments' reminder windows), repeating custom reminders, a details sheet (the card holds the whole message) and insurance or PUC renewal from the notification itself (it opens the document).
