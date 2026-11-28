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

| Route                                                                 | Notes                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /vehicles/:vehicleId/maintenance-overview`                       | `period` / `from` / `to` (the shared periods). State and counts, overdue (all), the next 5 due, spending (from Expenses: the Maintenance & servicing and Repairs categories, net of refunds) with the previous window and months                                                                              |
| `GET /vehicles/:vehicleId/maintenance-schedules`                      | `status`, `search`; ordered by urgency                                                                                                                                                                                                                                                                        |
| `POST /vehicles/:vehicleId/maintenance-schedules`                     | Client-generated `id` makes a retry return the same schedule                                                                                                                                                                                                                                                  |
| `GET/PATCH/DELETE /vehicles/:vehicleId/maintenance-schedules/:id`     | PATCH merges and re-checks the whole schedule                                                                                                                                                                                                                                                                 |
| `POST …/maintenance-schedules/:id/pause`, `…/resume`                  | Idempotent                                                                                                                                                                                                                                                                                                    |
| `GET /vehicles/:vehicleId/service-records`                            | Newest first. Filters (applied before paging): `search` (title, workshop, items and part numbers, technician, description, notes, category name), `from`/`to`, `group`, `type`, `providerId`, `minAmount`/`maxAmount`, `minKm`/`maxKm`; `scheduleId` = the records that completed that schedule (its history) |
| `GET /vehicles/:vehicleId/service-records/summary`                    | The same filters: how many records match and their total (every page)                                                                                                                                                                                                                                         |
| `POST /vehicles/:vehicleId/service-records`, `GET/PATCH/DELETE …/:id` | Client-generated `id`; PATCH merges, re-checks and replaces `items`; DELETE removes its expense too                                                                                                                                                                                                           |
| `GET /maintenance-providers`                                          | The user's workshops, preferred first then by name: `search` (name, city), `preferred`, `archived` (only archived ones; default: those in use, also the forms' suggestions). Each with its stats                                                                                                              |
| `POST /maintenance-providers`, `GET/PATCH/DELETE …/:id`               | Client-generated `id`; names unique per user ignoring case (409 on `name`); DELETE only when no record, component or inspection mentions it (409: archive instead)                                                                                                                                            |
| `POST …/maintenance-providers/:id/archive`, `…/restore`               | Idempotent. Archived: out of the suggestions, history kept                                                                                                                                                                                                                                                    |
| `GET …/maintenance-providers/:id/service-records`                     | Its visits across the user's vehicles, newest first                                                                                                                                                                                                                                                           |
| `GET /vehicles/:vehicleId/components`                                 | `state` = `installed` (most in need first) or `history` (replaced and removed, latest first), `search`                                                                                                                                                                                                        |
| `POST /vehicles/:vehicleId/components`, `GET/PATCH/DELETE …/:id`      | GET returns the lifecycle `history`; PATCH changes the profile only; DELETE removes the part and its events (records and schedules that mention it are kept)                                                                                                                                                  |
| `POST …/components/:id/inspect`, `…/replace`, `…/remove`              | The user's own check (sets the condition); replacement (see §3b); removed without a successor                                                                                                                                                                                                                 |
| `GET /vehicles/:vehicleId/inspections`                                | Newest first; `kind` = `SELF_CHECK` or `PROFESSIONAL`. Each with its items, counts and the follow-up schedules' status                                                                                                                                                                                        |
| `POST /vehicles/:vehicleId/inspections`, `GET/PATCH/DELETE …/:id`     | Client-generated `id`; PATCH merges, re-checks and replaces `items` (items sent with their `id` are kept, so follow-up links survive); DELETE keeps schedules created from its findings                                                                                                                       |

## 3a. Service and repair records

- **Any date:** historical records are welcome (never a future date). A record's reading joins the vehicle's **one odometer history** (`OdometerHistoryService`): Expenses' readings (fill-ups included), service records (₹0 ones have no expense) and trips. A reading below one from an earlier day, or above one from a later day, is refused (409, on `odometerKm`). A new reading raises the vehicle's odometer; correcting one down follows the vehicle back to the highest remaining reading; deleting keeps it (as Fuel).
- **Completing schedules:** an item with a `scheduleId` completes that schedule (this vehicle's only, once per record). A schedule due by distance needs the reading (400). The same schedule can't be completed twice on one day (409). Editing or deleting the record recalculates the schedule (nothing is stored).
- **Money:** total = labour + parts + other + tax − discount (`serviceRecordTotal`, exact paise), or the total entered when there's no breakdown; a total that contradicts the breakdown is refused. A record with a cost has **one linked expense** (`source MAINTENANCE`, read-only in Expenses, "Edit in Maintenance"), written in the same transaction; a ₹0 record has none; deleting the record deletes its expense and that expense's refunds (the confirmation says so). Category (`maintenance-expense.ts`): repair types and repair work → Repairs; upgrades → Accessories · Modifications; cleaning → Daily usage · Washing & detailing; the rest → Maintenance & servicing by what was done. Parts and labour go to the expense only when they fit in what was paid (discounts).
- **Workshops:** typed by name; a new name becomes one of the user's workshops (unique per user, ignoring case). Profiles, preferred and spending: §3d.

## 3b. Components

- **A part is fitted, inspected, then replaced or removed.** A replaced part is kept (`state REPLACED`, `replacedById` → its successor); history is never overwritten. Its lifecycle = the install (from the part), inspection / replaced / removed events, and the service records whose items name it.
- **Replacing** fits the new part (lifespan carried over unless changed) and logs a **"Component replacement" service record** in the same transaction: its cost becomes the linked expense, its items complete the schedules watching the part (which then watch the new part), its reading joins the odometer history. The kind decides the record's category (`COMPONENT_KINDS`).
- **Estimated life** from the lifespan the user set (km and/or months from the install point), per track, the one nearer its end deciding; measured at removal for a part taken off. Always labelled an estimate. **Status** (computed): replaced / removed › failed › replace soon or ≥ 90% of estimated life (`LIFE_NOTICE`) › a watching schedule due › the recorded condition.
- **Warranty** active while both its date and km hold (whichever ends first).
- Schedules may **watch** one fitted part of the same vehicle (`componentId`); removing the part unlinks them.

## 3c. Inspections

- **Two kinds, kept apart:** the user's own check (`SELF_CHECK`, always labelled "not a professional inspection") and a workshop's (`PROFESSIONAL`, workshop by name as in §3a). No scores, no pass/fail, no diagnosis: each item records what was seen (`GOOD`, `NORMAL`, `MONITOR`, `ATTENTION`, `REPLACE_SOON`, `REPLACED`, `NOT_INSPECTED`), notes and a recommended action.
- **Checklists** start from a template in `@automate/shared` (`INSPECTION_TEMPLATES`: quick walk-around, monthly, before a long trip, workshop, blank); items can be added and removed (up to 60). Templates imply no intervals or thresholds.
- **Counts** (`inspectionCounts`, shared by API and form): issues = attention + replace soon; to monitor; fine = good, normal, replaced; not inspected.
- **Findings link both ways:** an item can name one of the vehicle's parts (it then shows in the part's lifecycle with what was found), and "Create schedule" makes a one-time schedule from it (due on the follow-up date, category from the area, `inspectionItemId` links it). "Log repair" starts a repair record with the issues as items (a follow-up schedule's item completes it).
- An inspection has no cost; a paid workshop inspection is logged as a service record (type Inspection).

## 3d. Workshops

- **Per user, shared by all their vehicles:** type (authorised service centre, multi-brand garage, tyre, battery, body shop, detailing, roadside help, other), phone, email, address, city, notes, **preferred** (first in lists and suggestions). No ratings.
- **Stats** (computed on read): visits = its service records on any of the user's vehicles, first and last visit, and **spent = those records' expenses net of refunds** (`LinkedExpensesService.netBySource`), so a refund lowers it and ₹0 records add nothing.
- **Archive, don't delete:** a workshop with history can only be archived (hidden from suggestions, its visits kept); typing an archived name in a form links that workshop again. One nothing mentions can be deleted.
- Renaming changes the name shown on its records; their expenses keep the vendor they were saved with.

- **One odometer history:** service records are checked against `OdometerHistoryService` (vehicles module: expenses with fill-ups, service records and trips), the same history Expenses and Trips use ([trips.md](trips.md) §1).

## 3e. Analytics (phase 7)

`GET /vehicles/:vehicleId/maintenance-analytics?period=last_12_months|this_year|all_time` (`MaintenanceAnalyticsService`, pure `buildAnalytics` in `maintenance-analytics.ts`, tested). Spending comes from Expenses (Maintenance and Repairs, net of refunds, by month and by subcategory); visits and their frequency from service records (same-day records are one visit; repair types are REPAIR, EMERGENCY_REPAIR, WARRANTY_REPAIR); replacements from parts removed with a replacement, life = removal km − install km against the estimate; distance and cost per km from the odometer readings Expenses uses; the vehicle comparison covers every active vehicle when there's more than one. Insights are fixed rules over those numbers (repair share and spend against the period before, a replaced part's life, the average gap), labelled "Based on your records".

## 3f. Planning and templates (phase 8)

- **Planned jobs** are one-time schedules with an optional `estimatedCost` (`Decimal(12,2)`), never counted as spend. `GET …/maintenance-schedules?once=true` lists them; `GET /vehicles/:vehicleId/maintenance-plan` gives open jobs, the total of their estimates and how many have none (paused and completed jobs excluded).
- **Templates** live in `@automate/shared` (`MAINTENANCE_TEMPLATES`: petrol car, diesel SUV, CNG car, electric car, two-wheeler), shown with `TEMPLATE_CAUTION` ("Generic starting point — check your owner's manual"). The user ticks and edits each interval, then `POST …/maintenance-schedules/bulk` (up to 20, one transaction, all or none) adds them.

## 4. Phases

1 · Foundation, schedule engine and overview → 2 · Service and repair records (basic workshops, completion, linked expense, odometer history, dashboard wiring) → 3 · Service history → 4 · Component lifecycle → 5 · Inspections → 6 · Workshops → 7 · Analytics and insights (deterministic) → 8 · Planning and templates → 9 · Integrations, polish and verification. Each phase is approved before the next.

**Built:** phase 1 (schedules table and engine, the overview and schedule routes, the web Overview and Schedules tabs, the schedule form and details sheet; Stitch "Maintenance", "Maintenance Schedules", "Add Schedule", "Schedule Details") and phase 2 (service records with items, workshops by name, schedule completion, the linked expense, the odometer history, the dashboard status panel; Stitch "Add Service Record", "Service Record Details", "Delete Service Record Dialog") and phase 3 (the History tab: timeline by month or list, search and filters in the URL, the filtered count and total; Stitch "Service History") and phase 4 (components: tracking, inspections, replacement through a service record, removal, estimated life, warranty, schedules watching a part; Stitch "Maintenance Components", "Component Details", "Add Component", "Replace Component") and phase 5 (inspections: own and workshop checklists from templates, findings with actions, counts, findings followed up by linked schedules or a repair record, findings in a part's lifecycle; Stitch "Maintenance Inspections", "Inspection Checklist", "Inspection Details") and phase 6 (workshops: profiles, types, preferred, archive, visits across vehicles, spending from Expenses; Stitch "Maintenance Workshops", "Workshop Details", "Add Workshop Dialog" / "Add Workshop Sheet"). Phase 9 came next (the dashboard `snapshot()`, inspection-edit fix, verification), then phases 7 and 8 on 28/11/2026 (§3e, §3f; Stitch "Maintenance Analytics", "Maintenance Planner").

## 5. Pending integrations (do these when the module they need is built)

These depend on modules that don't exist yet. **Whoever builds that module wires Maintenance in, in the same change,** and updates this table.

| Needs                               | Maintenance part waiting                                                                                                                                                                                                           | Until then                                                                                                          |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Notifications (M10)**             | **Wired:** due soon, due and overdue schedules with reminders on (`MaintenanceService.reminders`) raise notifications, one per stage and cycle ([notifications.md](notifications.md))                                              | Snooze, dismissal and read state live in Notifications; per-schedule lead and reminders switch stay on the schedule |
| **Documents and file storage (M6)** | **Wired:** invoices, job cards, warranty cards and photos on service records, components and inspections (`/attachments`, the shared `AttachmentsPanel` on each details page; [documents.md §2](documents.md#2-files-and-storage)) | —                                                                                                                   |
| **Trips (M7)**                      | Distance from trips is never used for due km (odometer only); trip-linked repairs if needed                                                                                                                                        | Odometer only                                                                                                       |
| **Settings (M11)**                  | **Wired:** the user's service reminder lead (days and km, Settings → Reminder timing) applies where a schedule has none of its own; status windows stay shared constants                                                           | —                                                                                                                   |

**Left out on purpose** (add when asked): day-based intervals, a rule other than "whichever comes first", custom maintenance category tables (custom work is a free-text title under "Other"), custom inspection templates, workshop ratings.
