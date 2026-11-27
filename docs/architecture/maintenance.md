# Maintenance (M5): design and integration

Keeps each vehicle's servicing on time: schedules, service and repair records, components, inspections and workshops. Product scope: [MODULES.md M5](../MODULES.md#module-5--maintenance--service-management); money rules: [expenses.md](expenses.md); look: the Stitch "Maintenance" screens through the `automate-design` skill.

**Ownership:** Maintenance owns schedules, service records, components, inspections and workshops. Expenses owns the money: a service record with a cost has one linked expense (`source MAINTENANCE`, `sourceId` = the record), written through `LinkedExpensesService` in the same transaction. Spending figures are read from Expenses, never added up from service records.

## 1. Rules

- **Per vehicle, per user.** Every route checks the vehicle is the signed-in user's (404 otherwise). Writes take the vehicle's row lock (`lockOwned`).
- **Truthful data:** no health score and no diagnosis. "Nothing overdue" is never "healthy": with no schedules the overview says **Maintenance data incomplete**. Lifespans are labelled as estimates.
- **No universal intervals.** Every interval is the user's (or a template the user edited and applied, phase 8, labelled "generic starting point, check your owner's manual"). Nothing is hardcoded in the web.
- **Derived, not stored:** a schedule's last done, next due, remaining days and km, and status are computed on every read (`schedule-engine.ts`). Editing or deleting a record therefore recalculates its schedules, changing an interval never rewrites history, and nothing resets silently.
- **Odometer:** remaining km uses the vehicle's current reading (`vehicles.odometer_km`, the highest known). Service records join the one odometer history (phase 2).
- **Money:** `Decimal(12, 2)`, decimal strings in the API, paise in shared code. Planned costs are never counted as spent.

## 2. Schedule engine

A schedule either **repeats** (every `intervalKm` and/or `intervalMonths`) or happens **once** (at `dueDate` and/or `dueKm`). Each of its two tracks (date, distance) is computed on its own:

| Track    | Counted from (first that exists)                                                                                                 | Next due                                       |
| -------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Date     | the latest of: completions (service record items) and the "last done" date the user entered; else the day the schedule was added | + `intervalMonths` (IST, clamped to month end) |
| Distance | the highest of: completions' readings and the "last done" km; else the vehicle's odometer when the schedule was added            | + `intervalKm`                                 |

The response says which basis each track used, so the web can show how the next due was calculated ("Last done 18/05/2026 at 5,120 km + 10,000 km or 12 months").

**Status** (shared constants in `packages/shared/src/maintenance`, one per track, the more urgent track wins and is shown first; **whichever comes first**):

| Status         | When                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------- |
| Paused         | paused by the user (figures still shown, not counted)                                     |
| Completed      | a one-time schedule that a service record completed                                       |
| Overdue        | the due date has passed, or the odometer is past the due reading                          |
| Due            | ≤ 7 days or ≤ 500 km left (`DUE_WINDOW`)                                                  |
| Due soon       | inside the schedule's reminder lead (default 30 days / 1,000 km, `DEFAULT_REMINDER_LEAD`) |
| Upcoming       | ≤ 90 days or ≤ 3,000 km left (`UPCOMING_WINDOW`)                                          |
| Up to date     | otherwise                                                                                 |
| Not configured | neither track can be computed                                                             |

**Overview state:** any overdue → _Overdue maintenance_; else any due → _Attention required_; else any due soon / upcoming → _Upcoming maintenance_; else active schedules → _All caught up_; no active schedules → _Maintenance data incomplete_. Overdue items are listed whatever date range the spending section uses.

## 3. API

Nested under the vehicle (api-conventions.md §1). Every list is paginated.

| Route                                                                 | Notes                                                                                                                                                                                                                            |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /vehicles/:vehicleId/maintenance-overview`                       | `period` / `from` / `to` (the shared periods). State and counts, overdue (all), the next 5 due, spending (from Expenses: the Maintenance & servicing and Repairs categories, net of refunds) with the previous window and months |
| `GET /vehicles/:vehicleId/maintenance-schedules`                      | `status`, `search`; ordered by urgency                                                                                                                                                                                           |
| `POST /vehicles/:vehicleId/maintenance-schedules`                     | Client-generated `id` makes a retry return the same schedule                                                                                                                                                                     |
| `GET/PATCH/DELETE /vehicles/:vehicleId/maintenance-schedules/:id`     | PATCH merges and re-checks the whole schedule                                                                                                                                                                                    |
| `POST …/maintenance-schedules/:id/pause`, `…/resume`                  | Idempotent                                                                                                                                                                                                                       |
| `GET /vehicles/:vehicleId/service-records`                            | Newest first; `scheduleId` = the records that completed that schedule (its history)                                                                                                                                              |
| `POST /vehicles/:vehicleId/service-records`, `GET/PATCH/DELETE …/:id` | Client-generated `id`; PATCH merges, re-checks and replaces `items`; DELETE removes its expense too                                                                                                                              |
| `GET /maintenance-providers`                                          | The user's workshops by name (`search`), for the form's suggestions                                                                                                                                                              |

## 3a. Service and repair records

- **Any date:** historical records are welcome (never a future date). A record's reading joins the vehicle's **one odometer history**: Expenses' readings (fill-ups included) and service records (₹0 ones have no expense). A reading below one from an earlier day, or above one from a later day, is refused (409, on `odometerKm`). A new reading raises the vehicle's odometer; correcting one down follows the vehicle back to the highest remaining reading; deleting keeps it (as Fuel).
- **Completing schedules:** an item with a `scheduleId` completes that schedule (this vehicle's only, once per record). A schedule due by distance needs the reading (400). The same schedule can't be completed twice on one day (409). Editing or deleting the record recalculates the schedule (nothing is stored).
- **Money:** total = labour + parts + other + tax − discount (`serviceRecordTotal`, exact paise), or the total entered when there's no breakdown; a total that contradicts the breakdown is refused. A record with a cost has **one linked expense** (`source MAINTENANCE`, read-only in Expenses, "Edit in Maintenance"), written in the same transaction; a ₹0 record has none; deleting the record deletes its expense and that expense's refunds (the confirmation says so). Category (`maintenance-expense.ts`): repair types and repair work → Repairs; upgrades → Accessories · Modifications; cleaning → Daily usage · Washing & detailing; the rest → Maintenance & servicing by what was done. Parts and labour go to the expense only when they fit in what was paid (discounts).
- **Workshops:** typed by name; a new name becomes one of the user's workshops (unique per user, ignoring case). Profiles, preferred and spending arrive in phase 6.
- **Shortcut:** Expenses checks a manual expense's reading against expenses only, so it can't see a ₹0 service record's reading. Fix by moving the odometer history into one shared service when Trips adds readings too.

## 4. Phases

1 · Foundation, schedule engine and overview → 2 · Service and repair records (basic workshops, completion, linked expense, odometer history, dashboard wiring) → 3 · Service history → 4 · Component lifecycle → 5 · Inspections → 6 · Workshops → 7 · Analytics and insights (deterministic) → 8 · Planning and templates → 9 · Integrations, polish and verification. Each phase is approved before the next.

**Built:** phase 1 (schedules table and engine, the overview and schedule routes, the web Overview and Schedules tabs, the schedule form and details sheet; Stitch "Maintenance", "Maintenance Schedules", "Add Schedule", "Schedule Details") and phase 2 (service records with items, workshops by name, schedule completion, the linked expense, the odometer history, the dashboard status panel; Stitch "Add Service Record", "Service Record Details", "Delete Service Record Dialog").

## 5. Pending integrations (do these when the module they need is built)

These depend on modules that don't exist yet. **Whoever builds that module wires Maintenance in, in the same change,** and updates this table.

| Needs                               | Maintenance part waiting                                                                                                                                                                                                                                                                       | Until then                                                                                                                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Notifications (M10)**             | Reminder delivery: upcoming / due / overdue by date or km, component inspection and replacement, follow-ups; lead time per schedule, several reminders, snooze, dismissal, read/unread, de-duplication, preferences. M10 reads due items from `MaintenanceService` (no second reminder system) | Each schedule stores its reminder settings (`remindersEnabled`, `leadDays`, `leadKm`); "Due soon" uses the lead; due items show in the overview (and the dashboard from phase 2) |
| **Documents and file storage (M6)** | Attachments on service records, components and inspections (invoices, receipts, warranty cards, job cards, photos: PDF, JPEG, PNG, WebP), upload / preview / download / remove through the private storage flow in [backend.md §11](backend.md#11-file-storage-strategy)                       | No attachments; the record detail shows no file section                                                                                                                          |
| **AI Assistant (M9)**               | Verified maintenance data (schedules, history, insights) as assistant tools                                                                                                                                                                                                                    | Not shown                                                                                                                                                                        |
| **Trips (M7)**                      | Distance from trips is never used for due km (odometer only); trip-linked repairs if needed                                                                                                                                                                                                    | Odometer only                                                                                                                                                                    |
| **Settings (M11)**                  | Per-user defaults for reminder lead and status windows                                                                                                                                                                                                                                         | Shared constants                                                                                                                                                                 |

**Left out on purpose** (add when asked): day-based intervals, a rule other than "whichever comes first", custom maintenance category tables (custom work is a free-text title under "Other"), custom inspection templates.
